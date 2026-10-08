import * as functions from "firebase-functions";
import { requireSantriOrStaff, requireStaff } from "./access";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getActiveStudentCount } from "./counterUtils";
import { syncSantriTanggunganBulk } from "./santriTanggungan";

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
  semester?: string;
  jenjangPendidikan: string;
  programStudi?: string;
  nomorWalisantri: string;
  nomorTelpon?: string;
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
  systemManaged?: boolean;
  systemType?: string;
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

    if (invoiceData.systemManaged || invoiceData.systemType === 'registration_fee') {
      functions.logger.info(
        `Skipping automatic payment-status generation for system invoice: ${invoiceId}`,
        { structuredData: true }
      );
      return;
    }
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
              semester: data.semester || '',
              jenjangPendidikan: data.jenjangPendidikan || '',
              programStudi: data.programStudi || '',
              nomorWalisantri: data.nomorWalisantri || '',
              nomorTelpon: data.nomorTelpon || '',
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
          semester: data.semester || '',
          jenjangPendidikan: data.jenjangPendidikan || '',
          programStudi: data.programStudi || '',
          nomorWalisantri: data.nomorWalisantri || '',
          nomorTelpon: data.nomorTelpon || '',
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

    // 5. Get santri data to ensure we have correct semester and kelas fields
    // We need to do this separately because batch operations don't work with async operations inside loops
    const updatedSantriData = new Map();
    
    functions.logger.info(
      `Fetching updated santri data for ${santriList.length} santris`,
      { structuredData: true }
    );
    
    // Fetch all santri documents in parallel to get the correct semester fields
    const updateSantriPromises = santriList.map(async (santri) => {
      const santriDoc = await db.collection("SantriCollection").doc(santri.id).get();
      if (santriDoc.exists) {
        const data = santriDoc.data();
        updatedSantriData.set(santri.id, {
          semester: data.semester || '',
          kelas: data.kelas || '',
          nomorTelpon: data.nomorTelpon || '',
        });
        
        functions.logger.info(
          `Santri data for ${santri.id}: kelas=${data.kelas || 'N/A'}, semester=${data.semester || 'N/A'}`,
          { structuredData: true }
        );
      }
    });
    
    await Promise.all(updateSantriPromises);
    
    // Create payment status documents in batches
    // This ensures we don't exceed Firestore's write limits
    for (let i = 0; i < santriList.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const currentBatch = santriList.slice(i, i + BATCH_SIZE);

      for (const santri of currentBatch) {
        const paymentStatusId = `${invoiceId}_${santri.id}`;
        const paymentStatusRef = db
          .collection("PaymentStatuses")
          .doc(paymentStatusId);
        
        // Get the updated santri data or fall back to original data
        const updatedData = updatedSantriData.get(santri.id) || { semester: '', kelas: '' };
        
        // Determine educationGrade with priority: updatedData.semester, then updatedData.kelas, then empty string
        const educationGrade = updatedData.semester || updatedData.kelas || '';
        
        functions.logger.info(
          `Setting educationGrade for ${santri.id} to: ${educationGrade}`,
          { structuredData: true }
        );
        
        batch.set(paymentStatusRef, {
          invoiceId: invoiceId,
          santriId: santri.id,
          santriName: santri.nama,
          educationGrade: educationGrade,
          educationLevel: santri.jenjangPendidikan,
          programStudi: santri.programStudi || '',
          kamar: santri.kamar,
          nomorWaliSantri: santri.nomorWalisantri,
          nomorTelpon: santri.nomorTelpon || '',
          status: "Belum Lunas",
          paid: 0,
          total: nominal,
          history: {},
          createdAt: FieldValue.serverTimestamp(),
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

    // 6. Recompute statusTanggungan / jumlahTunggakan from the payment records now
    // that the new ones exist (never adjusted by a +1 counter).
    await syncSantriTanggunganBulk(santriList.map((santri) => santri.id));
  } catch (error) {
    functions.logger.error("Error creating payment statuses:", error);
    throw new Error(`Failed to create payment statuses: ${error}`);
  }
};

/**
 * Deletes an invoice and all associated payment statuses
 */
export const deleteInvoice = functions.region(region).https.onCall(async (data, context) => {
  await requireStaff(context);
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

    if (invoiceDoc.data()?.systemManaged || invoiceDoc.data()?.systemType === 'registration_fee') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'System-managed invoices cannot be deleted.'
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
      // 3. Delete the payment statuses, remembering which santri were affected
      const batch = db.batch();
      const affectedSantriIds = new Set<string>();

      paymentStatusesQuery.forEach((doc) => {
        batch.delete(doc.ref);
        affectedSantriIds.add(doc.data().santriId);
      });

      // 4. Commit the batch deletion of payment statuses
      await batch.commit();

      // 5. Recompute each affected santri's tanggungan from their remaining records
      await syncSantriTanggunganBulk([...affectedSantriIds]);
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
  await requireStaff(context);
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
    if (invoiceData.systemManaged || invoiceData.systemType === 'registration_fee') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Santri membership of a system-managed invoice cannot be edited manually.'
      );
    }
    const kodeAsrama = invoiceData.kodeAsrama;
    const nominal = invoiceData.nominal;
    
    // 2. Fetch the santri data for all santris to be added
    functions.logger.info(`Fetching ${santriIds.length} santri documents to add to invoice ${invoiceId}`, 
      { structuredData: true });
    
    const fetchPromises = santriIds.map(santriId => 
      db.collection("SantriCollection").doc(santriId).get()
    );
    
    const santriDocs = await Promise.all(fetchPromises);
    let santriList: SantriData[] = [];
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
            semester: data.semester || '',
            jenjangPendidikan: data.jenjangPendidikan || '',
            programStudi: data.programStudi || '',
            nomorWalisantri: data.nomorWalisantri || '',
            nomorTelpon: data.nomorTelpon || '',
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

    // Skip santri who already have a payment record on this invoice. Writing a
    // fresh record would reset their paid amount and payment history.
    const existingRecords = await db.getAll(
      ...santriList.map((santri) =>
        db.collection("PaymentStatuses").doc(`${invoiceId}_${santri.id}`)
      )
    );
    const alreadyOnInvoice = new Set(
      existingRecords.filter((record) => record.exists).map((record) => record.id)
    );
    if (alreadyOnInvoice.size > 0) {
      functions.logger.warn(
        `${alreadyOnInvoice.size} santris already have a payment record on invoice ${invoiceId}. Skipping.`,
        { structuredData: true }
      );
      santriList = santriList.filter(
        (santri) => !alreadyOnInvoice.has(`${invoiceId}_${santri.id}`)
      );
    }
    if (santriList.length === 0) {
      return {
        success: true,
        message: 'All selected santris are already on this invoice.',
        addedCount: 0
      };
    }

    // 3. Get santri data to ensure we have correct semester and kelas fields
    const updatedSantriData = new Map();
    
    functions.logger.info(
      `Fetching updated santri data for ${santriList.length} santris`,
      { structuredData: true }
    );
    
    // Fetch all santri documents in parallel to get the correct semester fields
    const detailPromises = santriList.map(async (santri) => {
      const santriDoc = await db.collection("SantriCollection").doc(santri.id).get();
      if (santriDoc.exists) {
        const data = santriDoc.data();
        updatedSantriData.set(santri.id, {
          semester: data.semester || '',
          kelas: data.kelas || '',
          nomorTelpon: data.nomorTelpon || '',
        });
        
        functions.logger.info(
          `Santri data for ${santri.id}: kelas=${data.kelas || 'N/A'}, semester=${data.semester || 'N/A'}`,
          { structuredData: true }
        );
      }
    });
    
    await Promise.all(detailPromises);
    
    // Create payment status documents for each new santri
    const batch = db.batch();
    
    for (const santri of santriList) {
      const paymentStatusId = `${invoiceId}_${santri.id}`;
      const paymentStatusRef = db
        .collection("PaymentStatuses")
        .doc(paymentStatusId);

      // Get the updated santri data or fall back to original data
      const updatedData = updatedSantriData.get(santri.id) || { semester: '', kelas: '' };
      
      // Determine educationGrade with priority: updatedData.semester, then updatedData.kelas, then empty string
      const educationGrade = updatedData.semester || updatedData.kelas || '';
      
      functions.logger.info(
        `Setting educationGrade for ${santri.id} to: ${educationGrade}`,
        { structuredData: true }
      );
      
      // create() (not set()) so a record added by a concurrent call is never overwritten
      batch.create(paymentStatusRef, {
        invoiceId: invoiceId,
        santriId: santri.id,
        santriName: santri.nama,
        nama: santri.nama,
        educationGrade: educationGrade,
        educationLevel: santri.jenjangPendidikan,
        programStudi: santri.programStudi || '',
        kamar: santri.kamar,
        nomorWaliSantri: santri.nomorWalisantri,
        nomorTelpon: santri.nomorTelpon || '',
        status: "Belum Lunas",
        paid: 0,
        total: nominal,
        history: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Commit all the new payment statuses
    await batch.commit();

    // 4. Recompute the added santri's tanggungan now that their records exist
    await syncSantriTanggunganBulk(santriList.map((santri) => santri.id));

    // 5. Update the invoice with new santri count
    await db.collection('Invoices').doc(invoiceId).update({
      numberOfSantriInvoiced: FieldValue.increment(santriList.length),
      selectedSantriIds: FieldValue.arrayUnion(...santriList.map(s => s.id))
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
  await requireStaff(context);
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


    if (invoiceDoc.data()?.systemManaged || invoiceDoc.data()?.systemType === 'registration_fee') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Santri membership of a system-managed invoice cannot be edited manually.'
      );
    }
    
    // 2. Delete the payment status documents for each santri
    const batch = db.batch();
    let deletedCount = 0;
    const removedSantriIds: string[] = [];

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
          removedSantriIds.push(santriId);
        } else {
          functions.logger.warn(
            `Cannot remove santri ${santriId} from invoice ${invoiceId} because payment status is ${status}`,
            { structuredData: true }
          );
        }
      }
    }
    
    // Commit the batch deletion of payment statuses, then recompute the removed
    // santri's tanggungan from the records they still have
    if (deletedCount > 0) {
      await batch.commit();
      await syncSantriTanggunganBulk(removedSantriIds);
    }

    // 3. Update the invoice with new santri count and remove santri IDs from the list
    await db.collection('Invoices').doc(invoiceId).update({
      numberOfSantriInvoiced: FieldValue.increment(-deletedCount),
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
  await requireSantriOrStaff(context, String(data?.santriId || ''));
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
  await requireStaff(context);
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
