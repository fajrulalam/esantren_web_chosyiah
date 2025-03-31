import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getActiveStudentCount } from "./counterUtils";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const BATCH_SIZE = 500; // Firestore batch write limit

// Add exports for HTTP callable functions
export const region = 'us-central1';

// Type definitions
interface SantriData {
  id: string;
  nama: string;
  kamar: string;
  kelas: string;
  jenjangPendidikan: string;
  programStudi?: string;
  nomorWalisantri: string;
  kodeAsrama: string;
  jumlahTunggakan?: number;
}

interface InvoiceData {
  invoiceId: string;
  kodeAsrama: string;
  nominal: number;
  paymentName: string;
  timestamp: admin.firestore.Timestamp;
  numberOfSantriInvoiced: number;
  selectedSantriIds?: string[]; // Optional array of santri IDs for selective invoicing
}

/**
 * Cloud Function that creates payment status documents for all active students
 * or for selected students when a new invoice is created in the Invoices collection.
 */
export const createPaymentStatusesOnInvoiceCreation = async (
  snapshot: functions.firestore.QueryDocumentSnapshot,
  context: functions.EventContext
): Promise<void> => {
  try {
    const invoiceData = snapshot.data() as InvoiceData;
    const invoiceId = context.params.invoiceId;
    const { kodeAsrama, nominal } = invoiceData;
    
    // Check if specific santriIds were selected for this invoice
    const selectedSantriIds = invoiceData.selectedSantriIds || [];
    const isSelective = selectedSantriIds.length > 0;

    functions.logger.info(
      `Processing invoice creation: ${invoiceId} for asrama: ${kodeAsrama} ${isSelective ? `(selective: ${selectedSantriIds.length} santris)` : '(all active santri)'}`,
      { structuredData: true }
    );

    // 1. For non-selective invoices, get and set the expected count from the counter
    // For selective invoicing, the numberOfSantriInvoiced should only count selected santris
    if (!isSelective) {
      const expectedStudentCount = await getActiveStudentCount(kodeAsrama);
      functions.logger.info(`Expected student count from counter: ${expectedStudentCount}`, { structuredData: true });
      
      // Update the invoice with the expected number from the counter
      if (expectedStudentCount > 0) {
        await snapshot.ref.update({
          numberOfSantriInvoiced: expectedStudentCount,
        });
      }
    } else {
      // For selective invoicing, ensure numberOfSantriInvoiced is set to the number of selected santris
      // This ensures the invoice correctly reflects only the selected students
      functions.logger.info(`Selective invoice with ${selectedSantriIds.length} santris selected`, { structuredData: true });
    }

    // 2. Query santri based on whether this is selective or for all active students
    let santriQuery;
    if (isSelective) {
      // For selective mode, we'll fetch the specified santri documents individually
      functions.logger.info(
        `Selective invoice mode: ${selectedSantriIds.length} santri targeted`,
        { structuredData: true }
      );
      
      // We don't do a direct query here, we'll fetch the documents individually below
      santriQuery = null;
    } else {
      // For all active students mode
      santriQuery = await db
        .collection("SantriCollection")
        .where("kodeAsrama", "==", kodeAsrama)
        .where("statusAktif", "==", "Aktif")
        .get();
        
      if (santriQuery.empty) {
        functions.logger.warn(
          `No active students found for asrama: ${kodeAsrama}. Skipping payment status creation.`,
          { structuredData: true }
        );
        return;
      }
    }

    // 3. Collect the santri data
    const santriList: SantriData[] = [];
    
    if (isSelective) {
      // Fetch each selected santri individually
      functions.logger.info(`Fetching ${selectedSantriIds.length} selected santri documents`, { structuredData: true });
      
      const promises = selectedSantriIds.map(santriId => 
        db.collection("SantriCollection").doc(santriId).get()
      );
      
      const santriDocs = await Promise.all(promises);
      let missingCount = 0;
      
      santriDocs.forEach(doc => {
        if (doc.exists) {
          const data = doc.data();
          // Verify the santri is from the same asrama (additional safety check)
          if (data?.kodeAsrama === kodeAsrama) {
            santriList.push({
              id: doc.id,
              nama: data.nama || 'Unknown',
              kamar: data.kamar || '',
              kelas: data.kelas || '',
              jenjangPendidikan: data.jenjangPendidikan || '',
              programStudi: data.programStudi || '',
              nomorWalisantri: data.nomorWalisantri || '',
              kodeAsrama: data.kodeAsrama,
              jumlahTunggakan: data.jumlahTunggakan || 0
            });
          } else {
            functions.logger.warn(
              `Selected santri ${doc.id} has different kodeAsrama: ${data?.kodeAsrama} than invoice: ${kodeAsrama}. Skipping.`,
              { structuredData: true }
            );
            missingCount++;
          }
        } else {
          functions.logger.warn(`Selected santri ${doc.id} not found. Skipping.`, { structuredData: true });
          missingCount++;
        }
      });
      
      if (missingCount > 0) {
        functions.logger.warn(
          `${missingCount} out of ${selectedSantriIds.length} selected santris were skipped (not found or wrong asrama)`,
          { structuredData: true }
        );
      }
    } else {
      // Process all active santri from the query
      santriQuery!.forEach((doc) => {
        const data = doc.data();
        santriList.push({
          id: doc.id,
          nama: data.nama || 'Unknown',
          kamar: data.kamar || '',
          kelas: data.kelas || '',
          jenjangPendidikan: data.jenjangPendidikan || '',
          programStudi: data.programStudi || '',
          nomorWalisantri: data.nomorWalisantri || '',
          kodeAsrama: data.kodeAsrama || kodeAsrama,
          jumlahTunggakan: data.jumlahTunggakan || 0
        });
      });
    }
    
    // If we didn't find any valid santri to process, exit
    if (santriList.length === 0) {
      functions.logger.warn(
        `No valid santri found to process for invoice: ${invoiceId}. Skipping payment status creation.`,
        { structuredData: true }
      );
      return;
    }

    // 4. Update the invoice with the actual number of santri
    // For selective invoicing, we always want to use santriList.length as that's the number of valid selected santris
    // For non-selective, we want to update if the actual count differs from what's already set
    functions.logger.info(
      `Updating invoice with actual santri count: ${santriList.length}`,
      { structuredData: true }
    );
    
    await snapshot.ref.update({
      numberOfSantriInvoiced: santriList.length,
    });

    // 5. Update all selected students' statusTanggungan and increment jumlahTunggakan
    // We only process the santris in the santriList - which is either:
    // - All active santris (for non-selective)
    // - Only the selected santris (for selective)
    functions.logger.info(
      `Updating statusTanggungan for ${santriList.length} santris`,
      { structuredData: true }
    );
    
    const updateStatusPromises = santriList.map((santri) => {
      return db.collection("SantriCollection").doc(santri.id).update({
        statusTanggungan: "Belum Lunas",
        jumlahTunggakan: admin.firestore.FieldValue.increment(1)
      });
    });

    // Execute all status updates in parallel
    await Promise.all(updateStatusPromises);

    // 6. Create payment status documents in batches
    // This ensures we don't exceed Firestore's write limits
    for (let i = 0; i < santriList.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const currentBatch = santriList.slice(i, i + BATCH_SIZE);

      for (const santri of currentBatch) {
        const paymentStatusId = `${invoiceId}_${santri.id}`;
        const paymentStatusRef = db
          .collection("PaymentStatuses")
          .doc(paymentStatusId);

        batch.set(paymentStatusRef, {
          invoiceId: invoiceId,
          santriId: santri.id,
          santriName: santri.nama,
          educationGrade: santri.kelas,
          educationLevel: santri.jenjangPendidikan,
          programStudi: santri.programStudi || '',
          kamar: santri.kamar,
          nomorWaliSantri: santri.nomorWalisantri,
          status: "Belum Lunas",
          paid: 0,
          total: nominal,
          history: {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Commit the batch
      await batch.commit();
      functions.logger.info(
        `Processed batch ${i / BATCH_SIZE + 1} with ${currentBatch.length} payment statuses`,
        { structuredData: true }
      );
    }

    functions.logger.info(
      `Successfully created ${santriList.length} payment status documents for invoice: ${invoiceId}`,
      { structuredData: true }
    );
  } catch (error) {
    functions.logger.error("Error creating payment statuses:", error);
    throw new Error(`Failed to create payment statuses: ${error}`);
  }
};

/**
 * Deletes an invoice and all associated payment statuses
 */
export const deleteInvoice = functions.region(region).https.onCall(async (data, context) => {
  const { invoiceId } = data;
  
  if (!invoiceId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with an invoiceId.'
    );
  }

  try {
    // 1. Get the invoice to delete
    const invoiceRef = db.collection('Invoices').doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();
    
    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'The specified invoice was not found.'
      );
    }

    // 2. Get all payment statuses for this invoice
    const paymentStatusesQuery = await db
      .collection('PaymentStatuses')
      .where('invoiceId', '==', invoiceId)
      .get();

    if (paymentStatusesQuery.empty) {
      functions.logger.warn(
        `No payment statuses found for invoice: ${invoiceId}. Proceeding with invoice deletion only.`,
        { structuredData: true }
      );
    } else {
      // 3. For each payment status, update the santri's jumlahTunggakan
      const batch = db.batch();
      
      // Keep track of santris to update
      const santriUpdates = new Map();
      
      paymentStatusesQuery.forEach((doc) => {
        const data = doc.data();
        const santriId = data.santriId;
        
        // Delete the payment status
        batch.delete(doc.ref);
        
        // Add santri to updates list
        if (!santriUpdates.has(santriId)) {
          santriUpdates.set(santriId, {
            ref: db.collection('SantriCollection').doc(santriId),
            currentStatus: data.status
          });
        }
      });
      
      // 4. Commit the batch deletion of payment statuses
      await batch.commit();
      
      // 5. Update each santri's jumlahTunggakan and statusTanggungan
      for (const [_, santriData] of santriUpdates.entries()) {
        const santriDoc = await santriData.ref.get();
        
        if (santriDoc.exists) {
          const santriDocData = santriDoc.data();
          const currentTunggakan = santriDocData.jumlahTunggakan || 0;
          
          // Decrement jumlahTunggakan
          const newTunggakan = Math.max(0, currentTunggakan - 1);
          
          // Update santri document
          await santriData.ref.update({
            jumlahTunggakan: newTunggakan,
            // If no more outstanding payments, set status to Lunas
            statusTanggungan: newTunggakan === 0 ? "Lunas" : "Belum Lunas"
          });
        }
      }
    }
    
    // 6. Finally, delete the invoice
    await invoiceRef.delete();
    
    return { success: true, message: 'Invoice and associated payment statuses deleted successfully' };
  } catch (error) {
    functions.logger.error("Error deleting invoice:", error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to delete invoice: ${error}`
    );
  }
});

/**
 * Adds new santris to an existing invoice
 */
export const addSantrisToInvoice = functions.region(region).https.onCall(async (data, context) => {
  const { invoiceId, santriIds } = data;
  
  if (!invoiceId || !santriIds || !Array.isArray(santriIds) || santriIds.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with invoiceId and a non-empty santriIds array.'
    );
  }

  try {
    // 1. Get the invoice details
    const invoiceDoc = await db.collection('Invoices').doc(invoiceId).get();
    
    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'The specified invoice was not found.'
      );
    }

    const invoiceData = invoiceDoc.data() as InvoiceData;
    const kodeAsrama = invoiceData.kodeAsrama;
    const nominal = invoiceData.nominal;
    
    // 2. Fetch the santri data for all santris to be added
    functions.logger.info(`Fetching ${santriIds.length} santri documents to add to invoice ${invoiceId}`, 
      { structuredData: true });
    
    const santriPromises = santriIds.map(santriId => 
      db.collection("SantriCollection").doc(santriId).get()
    );
    
    const santriDocs = await Promise.all(santriPromises);
    const santriList: SantriData[] = [];
    let missingCount = 0;
    
    santriDocs.forEach(doc => {
      if (doc.exists) {
        const data = doc.data();
        
        // Verify the santri is from the same asrama as the invoice
        if (data?.kodeAsrama === kodeAsrama) {
          santriList.push({
            id: doc.id,
            nama: data.nama || 'Unknown',
            kamar: data.kamar || '',
            kelas: data.kelas || '',
            jenjangPendidikan: data.jenjangPendidikan || '',
            programStudi: data.programStudi || '',
            nomorWalisantri: data.nomorWalisantri || '',
            kodeAsrama: data.kodeAsrama,
            jumlahTunggakan: data.jumlahTunggakan || 0
          });
        } else {
          functions.logger.warn(
            `Santri ${doc.id} has different kodeAsrama: ${data?.kodeAsrama} than invoice: ${kodeAsrama}. Skipping.`,
            { structuredData: true }
          );
          missingCount++;
        }
      } else {
        functions.logger.warn(`Santri ${doc.id} not found. Skipping.`, { structuredData: true });
        missingCount++;
      }
    });
    
    if (missingCount > 0) {
      functions.logger.warn(
        `${missingCount} out of ${santriIds.length} santris were skipped (not found or wrong asrama)`,
        { structuredData: true }
      );
    }
    
    // If we didn't find any valid santri to process, return early
    if (santriList.length === 0) {
      return { 
        success: false, 
        message: 'No valid santri records found to add to the invoice.' 
      };
    }

    // 3. Update all selected students' statusTanggungan and increment jumlahTunggakan
    functions.logger.info(
      `Updating statusTanggungan for ${santriList.length} santris`,
      { structuredData: true }
    );
    
    const updateStatusPromises = santriList.map((santri) => {
      return db.collection("SantriCollection").doc(santri.id).update({
        statusTanggungan: "Belum Lunas",
        jumlahTunggakan: admin.firestore.FieldValue.increment(1)
      });
    });

    // Execute all status updates in parallel
    await Promise.all(updateStatusPromises);
    
    // 4. Create payment status documents for each new santri
    const batch = db.batch();
    
    for (const santri of santriList) {
      const paymentStatusId = `${invoiceId}_${santri.id}`;
      const paymentStatusRef = db
        .collection("PaymentStatuses")
        .doc(paymentStatusId);

      batch.set(paymentStatusRef, {
        invoiceId: invoiceId,
        santriId: santri.id,
        santriName: santri.nama,
        nama: santri.nama,
        educationGrade: santri.kelas,
        educationLevel: santri.jenjangPendidikan,
        programStudi: santri.programStudi || '',
        kamar: santri.kamar,
        nomorWaliSantri: santri.nomorWalisantri,
        status: "Belum Lunas",
        paid: 0,
        total: nominal,
        history: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Commit all the new payment statuses
    await batch.commit();
    
    // 5. Update the invoice with new santri count
    await db.collection('Invoices').doc(invoiceId).update({
      numberOfSantriInvoiced: admin.firestore.FieldValue.increment(santriList.length),
      selectedSantriIds: admin.firestore.FieldValue.arrayUnion(...santriList.map(s => s.id))
    });

    return { 
      success: true, 
      message: `Successfully added ${santriList.length} santris to invoice`,
      addedCount: santriList.length
    };
  } catch (error) {
    functions.logger.error("Error adding santris to invoice:", error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to add santris to invoice: ${error}`
    );
  }
});

/**
 * Removes santris from an existing invoice
 */
export const removeSantrisFromInvoice = functions.region(region).https.onCall(async (data, context) => {
  const { invoiceId, santriIds } = data;
  
  if (!invoiceId || !santriIds || !Array.isArray(santriIds) || santriIds.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with invoiceId and a non-empty santriIds array.'
    );
  }

  try {
    // 1. Get the invoice details
    const invoiceDoc = await db.collection('Invoices').doc(invoiceId).get();
    
    if (!invoiceDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'The specified invoice was not found.'
      );
    }
    
    // 2. Delete the payment status documents for each santri
    const batch = db.batch();
    let deletedCount = 0;
    
    for (const santriId of santriIds) {
      const paymentStatusId = `${invoiceId}_${santriId}`;
      const paymentStatusRef = db.collection("PaymentStatuses").doc(paymentStatusId);
      
      // Check if the payment status exists
      const paymentStatus = await paymentStatusRef.get();
      
      if (paymentStatus.exists) {
        // Only allow deletion if status is not "Lunas" or "Menunggu Verifikasi"
        // This prevents deleting records that have already been paid
        const status = paymentStatus.data()?.status;
        
        if (status !== "Lunas" && status !== "Menunggu Verifikasi") {
          batch.delete(paymentStatusRef);
          deletedCount++;
          
          // Update the santri's jumlahTunggakan and statusTanggungan
          const santriRef = db.collection("SantriCollection").doc(santriId);
          const santriDoc = await santriRef.get();
          
          if (santriDoc.exists) {
            const santriData = santriDoc.data();
            const currentTunggakan = santriData?.jumlahTunggakan || 0;
            
            // Decrement jumlahTunggakan
            const newTunggakan = Math.max(0, currentTunggakan - 1);
            
            // Update santri document
            await santriRef.update({
              jumlahTunggakan: newTunggakan,
              // If no more outstanding payments, set status to Lunas
              statusTanggungan: newTunggakan === 0 ? "Lunas" : "Belum Lunas"
            });
          }
        } else {
          functions.logger.warn(
            `Cannot remove santri ${santriId} from invoice ${invoiceId} because payment status is ${status}`,
            { structuredData: true }
          );
        }
      }
    }
    
    // Commit the batch deletion of payment statuses
    if (deletedCount > 0) {
      await batch.commit();
    }
    
    // 3. Update the invoice with new santri count and remove santri IDs from the list
    await db.collection('Invoices').doc(invoiceId).update({
      numberOfSantriInvoiced: admin.firestore.FieldValue.increment(-deletedCount),
      selectedSantriIds: invoiceDoc.data()?.selectedSantriIds.filter(
        (id: string) => !santriIds.includes(id)
      ) || []
    });

    return { 
      success: true, 
      message: `Successfully removed ${deletedCount} santris from invoice`,
      removedCount: deletedCount
    };
  } catch (error) {
    functions.logger.error("Error removing santris from invoice:", error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to remove santris from invoice: ${error}`
    );
  }
});

/**
 * Returns all payment statuses for a specific santri
 */
export const getSantriPaymentHistory = functions.region(region).https
  .onCall(async (data, context) => {
  const { santriId } = data;
  
  if (!santriId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a santriId.'
    );
  }

  try {
    // Query payment statuses for the specified santri
    const paymentStatusesQuery = await db
      .collection('PaymentStatuses')
      .where('santriId', '==', santriId)
      .get();

    if (paymentStatusesQuery.empty) {
      return [];
    }

    // Get all invoices data to include paymentName
    const invoiceIds = new Set<string>();
    paymentStatusesQuery.forEach(doc => {
      const data = doc.data();
      if (data.invoiceId) {
        invoiceIds.add(data.invoiceId);
      }
    });

    // Get invoice data
    const invoicesData: { [key: string]: any } = {};
    await Promise.all(
      Array.from(invoiceIds).map(async (invoiceId) => {
        const invoiceDoc = await db.collection('Invoices').doc(invoiceId).get();
        if (invoiceDoc.exists) {
          invoicesData[invoiceId] = invoiceDoc.data();
        }
      })
    );

    // Map payment statuses with invoice data
    const paymentStatuses = paymentStatusesQuery.docs.map(doc => {
      const data = doc.data();
      const invoice = invoicesData[data.invoiceId] || {};
      
      return {
        id: doc.id,
        invoiceId: data.invoiceId,
        paymentName: invoice.paymentName || 'Unknown Payment',
        santriId: data.santriId,
        nama: data.nama || data.santriName,
        status: data.status,
        paid: data.paid || 0,
        total: data.total || 0,
        educationLevel: data.educationLevel,
        educationGrade: data.educationGrade,
        kamar: data.kamar,
        nomorWaliSantri: data.nomorWaliSantri,
        history: data.history || {},
        timestamp: invoice.timestamp?.toMillis() || Date.now(),
        kodeAsrama: data.kodeAsrama || invoice.kodeAsrama
      };
    });

    return paymentStatuses;
  } catch (error) {
    functions.logger.error("Error fetching santri payment history:", error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to fetch payment history: ${error}`
    );
  }
});

/**
 * Returns all payment statuses for a specific invoice
 */
export const getInvoicePaymentStatuses = functions.region(region).https
  .onCall(async (data, context) => {
  const { invoiceId, filters } = data;
  
  if (!invoiceId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with an invoiceId.'
    );
  }

  try {
    // Start with base query
    let query = db
      .collection('PaymentStatuses')
      .where('invoiceId', '==', invoiceId);

    // Add filters if provided
    if (filters) {
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters.kamar) {
        query = query.where('kamar', '==', filters.kamar);
      }
      if (filters.educationLevel) {
        query = query.where('educationLevel', '==', filters.educationLevel);
      }
    }

    const paymentStatusesQuery = await query.get();

    if (paymentStatusesQuery.empty) {
      return [];
    }

    const paymentStatuses = paymentStatusesQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        invoiceId: data.invoiceId,
        santriId: data.santriId,
        nama: data.nama || data.santriName,
        status: data.status,
        paid: data.paid || 0,
        total: data.total || 0,
        educationLevel: data.educationLevel,
        educationGrade: data.educationGrade,
        kamar: data.kamar,
        nomorWaliSantri: data.nomorWaliSantri,
        history: data.history || {}
      };
    });

    return paymentStatuses;
  } catch (error) {
    functions.logger.error("Error fetching invoice payment statuses:", error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to fetch payment statuses: ${error}`
    );
  }
});