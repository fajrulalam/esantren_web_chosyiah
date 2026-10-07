import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  createPaymentStatusesOnInvoiceCreation,
  deleteInvoice,
  addSantrisToInvoice,
  removeSantrisFromInvoice,
  getSantriPaymentHistory as getSantriPaymentHistoryFunc,
  getInvoicePaymentStatuses as getInvoicePaymentStatusesFunc
} from "./invoiceFunction";
import {
  updateCounterOnSantriStatusChange,
  incrementCounterOnNewSantri,
  decrementCounterOnDeletedSantri
} from "./santriStatusFunction";
import {
  getSantriPaymentHistory as getSantriPaymentHistoryQuery,
  getInvoicePaymentStatuses as getInvoicePaymentStatusesQuery
} from "./queryUtils";
import { corsHandler } from "./corsConfig";
import { linkSantriAccount as linkSantriAccountFunc } from "./santriAccount";
import { requireSantriOrStaff, requireStaff, staffRequestError } from "./access";
import { syncSantriTanggunganBulk } from "./santriTanggungan";
import {
  deriveSantriTanggungan,
  PaymentStatusSummaryInput,
} from "./santriTanggunganMath";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export the invoice creation function
export const processInvoiceCreation = functions.firestore
    .document("Invoices/{invoiceId}")
    .onCreate(createPaymentStatusesOnInvoiceCreation);

// Links a santri's Google / email-link account to their SantriCollection record
export const linkSantriAccount = linkSantriAccountFunc;

// Export the counter maintenance functions
export const updateSantriCounter = updateCounterOnSantriStatusChange;
export const incrementSantriCounter = incrementCounterOnNewSantri;
export const decrementSantriCounter = decrementCounterOnDeletedSantri;

// Export HTTP callable functions for querying (from queryUtils)
export const getSantriPayments = getSantriPaymentHistoryQuery;
export const getInvoicePayments = getInvoicePaymentStatusesQuery;

// Export HTTP callable functions from invoiceFunction (with CORS support)
export const getSantriPaymentHistory = getSantriPaymentHistoryFunc;
export const getInvoicePaymentStatuses = getInvoicePaymentStatusesFunc;

// Keep the existing callable function
export const deleteInvoiceFunction = deleteInvoice;

// Create a new HTTP function with CORS support
export const deleteInvoiceHttp = functions.https.onRequest((request, response) => {
  return corsHandler(request, response, async () => {
    const denied = await staffRequestError(request);
    if (denied) return response.status(denied.status).json(denied.body);

    try {
      // Extract data from the request
      const { invoiceId } = request.body.data || {};

      if (!invoiceId) {
        return response.status(400).json({
          error: 'invalid-argument',
          message: 'The function must be called with an invoiceId.'
        });
      }

      // Use the original function logic directly
      try {
        // 1. Get the invoice to delete
        const invoiceRef = admin.firestore().collection('Invoices').doc(invoiceId);
        const invoiceDoc = await invoiceRef.get();

        if (!invoiceDoc.exists) {
          return response.status(404).json({
            error: 'not-found',
            message: 'The specified invoice was not found.'
          });
        }

        if (invoiceDoc.data()?.systemManaged || invoiceDoc.data()?.systemType === 'registration_fee') {
          return response.status(409).json({
            error: 'failed-precondition',
            message: 'System-managed invoices cannot be deleted.'
          });
        }

        // 2. Get all payment statuses for this invoice
        const paymentStatusesQuery = await admin.firestore()
            .collection('PaymentStatuses')
            .where('invoiceId', '==', invoiceId)
            .get();

        if (paymentStatusesQuery.empty) {
          console.warn(`No payment statuses found for invoice: ${invoiceId}. Proceeding with invoice deletion only.`);
        } else {
          // 3. Delete the payment statuses, remembering which santri were affected
          const batch = admin.firestore().batch();
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

        return response.status(200).json({
          success: true,
          message: 'Invoice and associated payment statuses deleted successfully'
        });
      } catch (innerError) {
        console.error("Error deleting invoice:", innerError);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in deleteInvoiceFunction:', error);
      return response.status(500).json({
        error: 'internal',
        message: `Failed to delete invoice: ${error}`
      });
    }
  });
});

// Keep the existing callable functions
export const addSantrisToInvoiceFunction = addSantrisToInvoice;
export const removeSantrisFromInvoiceFunction = removeSantrisFromInvoice;

// Create new HTTP functions with CORS support
export const addSantrisToInvoiceHttp = functions.https.onRequest((request, response) => {
  return corsHandler(request, response, async () => {
    const denied = await staffRequestError(request);
    if (denied) return response.status(denied.status).json(denied.body);

    try {
      // Extract data from the request
      const { invoiceId, santriIds } = request.body.data || {};

      if (!invoiceId || !santriIds || !Array.isArray(santriIds) || santriIds.length === 0) {
        return response.status(400).json({
          error: 'invalid-argument',
          message: 'The function must be called with invoiceId and a non-empty santriIds array.'
        });
      }

      // Implement function logic directly
      try {
        // 1. Get the invoice details
        const invoiceDoc = await admin.firestore().collection('Invoices').doc(invoiceId).get();

        if (!invoiceDoc.exists) {
          return response.status(404).json({
            error: 'not-found',
            message: 'The specified invoice was not found.'
          });
        }

        const invoiceData = invoiceDoc.data();
        if (invoiceData?.systemManaged || invoiceData?.systemType === 'registration_fee') {
          return response.status(409).json({
            error: 'failed-precondition',
            message: 'Santri membership of a system-managed invoice cannot be edited manually.'
          });
        }
        const kodeAsrama = invoiceData.kodeAsrama;
        const nominal = invoiceData.nominal;

        // 2. Fetch the santri data for all santris to be added
        console.log(`Fetching ${santriIds.length} santri documents to add to invoice ${invoiceId}`,
            { structuredData: true });

        const fetchSantriPromises = santriIds.map(santriId =>
            admin.firestore().collection("SantriCollection").doc(santriId).get()
        );

        const santriDocs = await Promise.all(fetchSantriPromises);
        let santriList = [];
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
              console.warn(
                  `Santri ${doc.id} has different kodeAsrama: ${data?.kodeAsrama} than invoice: ${kodeAsrama}. Skipping.`,
                  { structuredData: true }
              );
              missingCount++;
            }
          } else {
            console.warn(`Santri ${doc.id} not found. Skipping.`, { structuredData: true });
            missingCount++;
          }
        });

        if (missingCount > 0) {
          console.warn(
              `${missingCount} out of ${santriIds.length} santris were skipped (not found or wrong asrama)`,
              { structuredData: true }
          );
        }

        // If we didn't find any valid santri to process, return early
        if (santriList.length === 0) {
          return response.status(200).json({
            success: false,
            message: 'No valid santri records found to add to the invoice.'
          });
        }

        // Skip santri who already have a payment record on this invoice. Writing a
        // fresh record would reset their paid amount and payment history.
        const existingRecords = await admin.firestore().getAll(
          ...santriList.map((santri) =>
            admin.firestore().collection("PaymentStatuses").doc(`${invoiceId}_${santri.id}`)
          )
        );
        const alreadyOnInvoice = new Set(
          existingRecords.filter((record) => record.exists).map((record) => record.id)
        );
        if (alreadyOnInvoice.size > 0) {
          console.warn(
              `${alreadyOnInvoice.size} santris already have a payment record on invoice ${invoiceId}. Skipping.`,
              { structuredData: true }
          );
          santriList = santriList.filter(
            (santri) => !alreadyOnInvoice.has(`${invoiceId}_${santri.id}`)
          );
        }
        if (santriList.length === 0) {
          return response.status(200).json({
            success: true,
            message: 'All selected santris are already on this invoice.',
            addedCount: 0
          });
        }

        // 3. First fetch all santri documents to ensure we have the latest data
        console.log(`Fetching updated santri data for ${santriList.length} santris`);
        
        // Create a map to store the updated santri data
        const updatedSantriData = new Map();
        
        // Fetch all santri documents in parallel
        const santriDetailPromises = santriList.map(async (santri) => {
          const santriDoc = await admin.firestore().collection('SantriCollection').doc(santri.id).get();
          if (santriDoc.exists) {
            const data = santriDoc.data();
            updatedSantriData.set(santri.id, {
              semester: data.semester || '',
              kelas: data.kelas || '',
              nomorTelpon: data.nomorTelpon || ''
            });
            
            console.log(`Santri data for ${santri.id}: semester=${data.semester || 'N/A'}, kelas=${data.kelas || 'N/A'}`);
          }
        });
        
        // Wait for all fetches to complete
        await Promise.all(santriDetailPromises);
        
        // 5. Now create payment status documents in a batch
        const batch = admin.firestore().batch();
        
        for (const santri of santriList) {
          const paymentStatusId = `${invoiceId}_${santri.id}`;
          const paymentStatusRef = admin.firestore()
              .collection("PaymentStatuses")
              .doc(paymentStatusId);
          
          // Get the updated data if available
          const updatedData = updatedSantriData.get(santri.id) || { semester: '', kelas: '' };
          
          // Use semester with fallback to kelas - prioritize the latest data from Firestore
          const educationGrade = updatedData.semester || santri.semester || updatedData.kelas || santri.kelas || '';
          
          console.log(`Setting educationGrade for ${santri.id} to: ${educationGrade}`);
          
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
            nomorTelpon: santri.nomorTelpon,
            status: "Belum Lunas",
            paid: 0,
            total: nominal,
            history: {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        
        // Commit all the new payment statuses
        await batch.commit();

        // 4. Recompute the added santri's tanggungan now that their records exist
        await syncSantriTanggunganBulk(santriList.map((santri) => santri.id));

        // 5. Update the invoice with new santri count
        await admin.firestore().collection('Invoices').doc(invoiceId).update({
          numberOfSantriInvoiced: admin.firestore.FieldValue.increment(santriList.length),
          selectedSantriIds: admin.firestore.FieldValue.arrayUnion(...santriList.map(s => s.id))
        });

        return response.status(200).json({
          success: true,
          message: `Successfully added ${santriList.length} santris to invoice`,
          addedCount: santriList.length
        });
      } catch (innerError) {
        console.error("Error adding santris to invoice:", innerError);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in addSantrisToInvoiceFunction:', error);
      return response.status(500).json({
        error: 'internal',
        message: `Failed to add santris to invoice: ${error}`
      });
    }
  });
});

export const removeSantrisFromInvoiceHttp = functions.https.onRequest((request, response) => {
  return corsHandler(request, response, async () => {
    const denied = await staffRequestError(request);
    if (denied) return response.status(denied.status).json(denied.body);

    try {
      // Extract data from the request
      const { invoiceId, santriIds } = request.body.data || {};

      if (!invoiceId || !santriIds || !Array.isArray(santriIds) || santriIds.length === 0) {
        return response.status(400).json({
          error: 'invalid-argument',
          message: 'The function must be called with invoiceId and a non-empty santriIds array.'
        });
      }

      // Implement function logic directly
      try {
        // 1. Get the invoice details
        const invoiceDoc = await admin.firestore().collection('Invoices').doc(invoiceId).get();

        if (!invoiceDoc.exists) {
          return response.status(404).json({
            error: 'not-found',
            message: 'The specified invoice was not found.'
          });
        }


        if (invoiceDoc.data()?.systemManaged || invoiceDoc.data()?.systemType === 'registration_fee') {
          return response.status(409).json({
            error: 'failed-precondition',
            message: 'Santri membership of a system-managed invoice cannot be edited manually.'
          });
        }

        // 2. Delete the payment status documents for each santri
        const batch = admin.firestore().batch();
        let deletedCount = 0;
        const removedSantriIds: string[] = [];

        for (const santriId of santriIds) {
          const paymentStatusId = `${invoiceId}_${santriId}`;
          const paymentStatusRef = admin.firestore().collection("PaymentStatuses").doc(paymentStatusId);

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
              console.warn(
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
        await admin.firestore().collection('Invoices').doc(invoiceId).update({
          numberOfSantriInvoiced: admin.firestore.FieldValue.increment(-deletedCount),
          selectedSantriIds: invoiceDoc.data()?.selectedSantriIds.filter(
              (id) => !santriIds.includes(id)
          ) || []
        });

        return response.status(200).json({
          success: true,
          message: `Successfully removed ${deletedCount} santris from invoice`,
          removedCount: deletedCount
        });
      } catch (innerError) {
        console.error("Error removing santris from invoice:", innerError);
        throw innerError;
      }
    } catch (error) {
      console.error('Error in removeSantrisFromInvoiceFunction:', error);
      return response.status(500).json({
        error: 'internal',
        message: `Failed to remove santris from invoice: ${error}`
      });
    }
  });
});

// Test CORS endpoint
export const testCors = functions.https.onRequest((request, response) => {
  // Enable CORS using the corsHandler
  return corsHandler(request, response, () => {
    response.status(200).json({
      message: 'CORS is working correctly!',
      origin: request.headers.origin || 'No origin header found'
    });
  });
});

// Debug function to check santri document structure
export const debugSantriStructure = functions.region('us-central1').https.onCall(async (data, context) => {
  await requireStaff(context);
  try {
    const { santriId } = data;
    
    if (!santriId) {
      throw new functions.https.HttpsError(
        'invalid-argument', 
        'The function must be called with a santriId parameter.'
      );
    }
    
    // Get the santri document
    const santriDoc = await admin.firestore().collection('SantriCollection').doc(santriId).get();
    
    if (!santriDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `Santri with ID ${santriId} not found.`
      );
    }
    
    // Get the data and log all fields for debugging
    const santriData = santriDoc.data();
    console.log('Complete santri document structure:', JSON.stringify(santriData, null, 2));
    
    // Return the full document for analysis
    return {
      id: santriId,
      data: santriData,
      fieldNames: Object.keys(santriData || {}),
      hasJenjangPendidikan: santriData?.hasOwnProperty('jenjangPendidikan'),
      hasSemester: santriData?.hasOwnProperty('semester'),
      hasKelas: santriData?.hasOwnProperty('kelas'),
      jenjangPendidikanValue: santriData?.jenjangPendidikan || 'N/A',
      semesterValue: santriData?.semester || 'N/A',
      kelasValue: santriData?.kelas || 'N/A'
    };
  } catch (error) {
    console.error('Error in debugSantriStructure:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error debugging santri structure: ${error}`
    );
  }
});

// Shared function for santri registration
const registerSantriImpl = async (data: any) => {
  const registrationTotal = 3960000;
  const amount = Number(data.registrationPaidAmount);
  const inputSantri = data.santriData || data;
  const kodeAsrama = data.kodeAsrama || inputSantri.kodeAsrama;
  const paymentProofUrl = data.paymentProofUrl || inputSantri.paymentProofUrl;

  if (!inputSantri.nama || !inputSantri.email || !kodeAsrama || !paymentProofUrl) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Data santri dan bukti pembayaran harus lengkap.'
    );
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > registrationTotal) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Nominal pembayaran harus berupa rupiah bulat antara Rp1 dan Rp3.960.000.'
    );
  }

  const firestore = admin.firestore();
  const santriRef = data.santriId
    ? firestore.collection('SantriCollection').doc(data.santriId)
    : firestore.collection('SantriCollection').doc();
  const invoiceId = `registration_fee_${kodeAsrama}`;
  const paymentStatusId = `${invoiceId}_${santriRef.id}`;
  const attemptId = `payment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const invoiceRef = firestore.collection('Invoices').doc(invoiceId);
  const paymentRef = firestore.collection('PaymentStatuses').doc(paymentStatusId);
  const nowIso = new Date().toISOString();

  await firestore.runTransaction(async (transaction) => {
    const [santriSnapshot, invoiceSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(santriRef),
      transaction.get(invoiceRef),
      transaction.get(paymentRef),
    ]);
    if (santriSnapshot.exists || paymentSnapshot.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'Pendaftaran ini sudah pernah disimpan.'
      );
    }

    const santriData = {
      ...inputSantri,
      kodeAsrama,
      statusTanggungan: 'Menunggu Verifikasi',
      statusAktif: 'Pending',
      jumlahTunggakan: 1,
      paymentProofUrl,
      registrationFeeTotal: registrationTotal,
      registrationSubmittedAmount: amount,
      registrationPaymentStatusId: paymentStatusId,
      registrationInitialPaymentId: attemptId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const existingIds = invoiceSnapshot.exists
      ? invoiceSnapshot.data()?.selectedSantriIds || []
      : [];
    const selectedSantriIds = existingIds.includes(santriRef.id)
      ? existingIds
      : [...existingIds, santriRef.id];

    transaction.set(santriRef, santriData);
    transaction.set(invoiceRef, {
      paymentName: 'Biaya Pendaftaran',
      nominal: registrationTotal,
      kodeAsrama,
      systemManaged: true,
      systemType: 'registration_fee',
      selectedSantriIds,
      numberOfSantriInvoiced: selectedSantriIds.length,
      numberOfPaid: invoiceSnapshot.exists
        ? Number(invoiceSnapshot.data()?.numberOfPaid || 0)
        : 0,
      numberOfWaitingVerification:
        (invoiceSnapshot.exists
          ? Number(invoiceSnapshot.data()?.numberOfWaitingVerification || 0)
          : 0) + 1,
      timestamp: invoiceSnapshot.exists
        ? invoiceSnapshot.data()?.timestamp || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
      createdAt: invoiceSnapshot.exists
        ? invoiceSnapshot.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(paymentRef, {
      invoiceId,
      paymentName: 'Biaya Pendaftaran',
      santriId: santriRef.id,
      santriName: inputSantri.nama,
      nama: inputSantri.nama,
      educationGrade: inputSantri.semester || inputSantri.kelas || '1',
      educationLevel: inputSantri.jenjangPendidikan || 'Perguruan Tinggi',
      programStudi: inputSantri.programStudi || '',
      kamar: inputSantri.kamar || '-',
      nomorWaliSantri: inputSantri.nomorWalisantri || '',
      nomorTelpon: inputSantri.nomorTelpon || '',
      status: 'Menunggu Verifikasi',
      paid: 0,
      pendingAmount: amount,
      total: registrationTotal,
      schemaVersion: 2,
      systemType: 'registration_fee',
      history: {
        [attemptId]: {
          id: attemptId,
          date: nowIso,
          type: amount === registrationTotal ? 'Bayar Lunas' : 'Bayar Sebagian',
          amount,
          status: 'Menunggu Verifikasi',
          imageUrl: paymentProofUrl,
          paymentMethod: 'transfer',
          inputtedBy: 'Pendaftar',
        },
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(`New santri registration: ${santriRef.id}`);

  return {
    success: true,
    id: santriRef.id,
    paymentStatusId,
    message: 'Pendaftaran berhasil! Silakan menunggu konfirmasi dari admin.'
  };
};

// Public API endpoint for registering new santri (callable function)
export const registerSantri = functions.https.onCall(async (data, context) => {
  try {
    return await registerSantriImpl(data);
  } catch (error) {
    console.error('Error registering santri:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
        'internal',
        'Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti.'
    );
  }
});

// Public submission endpoint used by the wali-santri session. The session is
// intentionally not Firebase Auth-backed in the current application, so all
// balance enforcement happens again inside this Admin SDK transaction.
export const submitPaymentInstallment = functions.https.onCall(async (data, context) => {
  const paymentStatusId = String(data.paymentStatusId || '');
  // Only the santri who owns this payment (or staff) may submit against it.
  if (paymentStatusId) {
    const payment = await admin.firestore().collection('PaymentStatuses').doc(paymentStatusId).get();
    await requireSantriOrStaff(context, String(payment.data()?.santriId || ''));
  }
  const attemptId = String(data.attemptId || '');
  const amount = Number(data.amount);
  const imageUrl = String(data.imageUrl || '');
  const paymentMethod = String(data.paymentMethod || 'transfer');
  const inputtedBy = String(data.inputtedBy || 'Wali Santri');

  if (!paymentStatusId || !attemptId || !imageUrl) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Data bukti pembayaran tidak lengkap.'
    );
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Nominal pembayaran harus berupa rupiah bulat dan lebih dari Rp0.'
    );
  }

  const firestore = admin.firestore();
  const paymentRef = firestore.collection('PaymentStatuses').doc(paymentStatusId);
  await firestore.runTransaction(async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Data pembayaran tidak ditemukan.');
    }

    const payment = paymentSnapshot.data() || {};
    const history = { ...(payment.history || {}) };
    if (history[attemptId]) {
      const existing = history[attemptId];
      if (Number(existing.amount) === amount && existing.imageUrl === imageUrl) return;
      throw new functions.https.HttpsError(
        'already-exists',
        'ID pengajuan pembayaran sudah digunakan.'
      );
    }
    if (payment.requiresAmountConfirmation) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Nominal pembayaran awal masih menunggu konfirmasi Super Admin.'
      );
    }

    const pendingAttempts = Object.values(history).filter((item: any) =>
      (item.type === 'Bayar Lunas' || item.type === 'Bayar Sebagian') &&
      item.status === 'Menunggu Verifikasi'
    ) as any[];
    const pendingAmount = Number.isFinite(payment.pendingAmount)
      ? Math.max(0, Number(payment.pendingAmount))
      : (!payment.schemaVersion && payment.status !== 'Menunggu Verifikasi')
      ? 0
      : pendingAttempts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paid = Math.max(0, Number(payment.paid || 0));
    const total = Math.max(0, Number(payment.total || 0));
    const available = Math.max(0, total - paid - pendingAmount);
    if (amount > available) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Jumlah maksimal yang dapat diajukan adalah Rp${available.toLocaleString('id-ID')}.`
      );
    }

    const invoiceRef = payment.invoiceId
      ? firestore.collection('Invoices').doc(payment.invoiceId)
      : null;
    const santriRef = payment.santriId
      ? firestore.collection('SantriCollection').doc(payment.santriId)
      : null;
    const invoiceSnapshot = invoiceRef ? await transaction.get(invoiceRef) : null;
    const santriSnapshot = santriRef ? await transaction.get(santriRef) : null;

    history[attemptId] = {
      id: attemptId,
      date: new Date().toISOString(),
      type: amount === available ? 'Bayar Lunas' : 'Bayar Sebagian',
      amount,
      status: 'Menunggu Verifikasi',
      imageUrl,
      paymentMethod,
      inputtedBy,
    };
    transaction.update(paymentRef, {
      history,
      pendingAmount: pendingAmount + amount,
      status: 'Menunggu Verifikasi',
      schemaVersion: 2,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (invoiceRef && invoiceSnapshot?.exists && pendingAmount === 0) {
      transaction.update(invoiceRef, {
        numberOfWaitingVerification:
          Math.max(0, Number(invoiceSnapshot.data()?.numberOfWaitingVerification || 0)) + 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (santriRef && santriSnapshot?.exists) {
      transaction.update(santriRef, {
        statusTanggungan: 'Menunggu Verifikasi',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { success: true, attemptId };
});

const getCurrentAcademicSemesterKeyForRegistration = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const isGenap = month >= 3 && month <= 8;
  const academicYearStart = isGenap || month <= 2 ? year - 1 : year;
  return `${academicYearStart}-${academicYearStart + 1}-${isGenap ? 'genap' : 'ganjil'}`;
};

export const reviewPaymentInstallment = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Login staf diperlukan.');
  }
  const firestore = admin.firestore();
  const reviewerSnapshot = await firestore
    .collection('PengurusCollection')
    .doc(context.auth.uid)
    .get();
  const reviewerRole = reviewerSnapshot.data()?.role;
  if (!['pengurus', 'pengasuh', 'superAdmin'].includes(reviewerRole)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Akun ini tidak memiliki izin untuk meninjau pembayaran.'
    );
  }

  const paymentStatusId = String(data.paymentStatusId || '');
  const attemptId = String(data.attemptId || '');
  const action = String(data.action || '');
  const reviewedBy = String(data.reviewedBy || reviewerSnapshot.data()?.name || 'Admin');
  const reason = data.reason ? String(data.reason) : undefined;
  const confirmedAmount = Number(data.confirmedAmount);
  if (!paymentStatusId || !attemptId || !['approve', 'reject', 'revoke'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Aksi pembayaran tidak valid.');
  }
  if ((action === 'reject' || action === 'revoke') && !reason?.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'Alasan tindakan harus diisi.');
  }

  const paymentRef = firestore.collection('PaymentStatuses').doc(paymentStatusId);
  await firestore.runTransaction(async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Data pembayaran tidak ditemukan.');
    }
    const payment = paymentSnapshot.data() || {};
    const santriId = payment.santriId || '';
    const history = { ...(payment.history || {}) };
    const attempt = history[attemptId];
    if (!attempt || !['Bayar Lunas', 'Bayar Sebagian'].includes(attempt.type)) {
      throw new functions.https.HttpsError('not-found', 'Bukti pembayaran tidak ditemukan.');
    }

    const invoiceRef = payment.invoiceId
      ? firestore.collection('Invoices').doc(payment.invoiceId)
      : null;
    const santriRef = santriId
      ? firestore.collection('SantriCollection').doc(santriId)
      : null;
    const invoiceSnapshot = invoiceRef ? await transaction.get(invoiceRef) : null;
    const santriSnapshot = santriRef ? await transaction.get(santriRef) : null;
    const shouldActivate =
      action === 'approve' &&
      payment.systemType === 'registration_fee' &&
      santriSnapshot?.exists &&
      santriSnapshot.data()?.statusAktif === 'Pending';
    const counterRef = shouldActivate
      ? firestore.collection('Counters').doc('activeSantri')
      : null;
    const counterSnapshot = counterRef ? await transaction.get(counterRef) : null;
    const santriPaymentStatusesSnapshot = santriId
      ? await transaction.get(
          firestore.collection('PaymentStatuses').where('santriId', '==', santriId)
        )
      : null;

    const pendingAttempts = Object.values(history).filter((item: any) =>
      ['Bayar Lunas', 'Bayar Sebagian'].includes(item.type) &&
      item.status === 'Menunggu Verifikasi'
    ) as any[];
    const oldPending = Number.isFinite(payment.pendingAmount)
      ? Math.max(0, Number(payment.pendingAmount))
      : (!payment.schemaVersion && payment.status !== 'Menunggu Verifikasi')
      ? 0
      : pendingAttempts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const needsAmount =
      payment.requiresAmountConfirmation ||
      attempt.legacyAmountConfirmationRequired ||
      !Number.isFinite(attempt.amount);
    if (needsAmount && action === 'approve' && reviewerRole !== 'superAdmin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Hanya Super Admin yang dapat mengonfirmasi nominal pembayaran lama.'
      );
    }
    const amount = needsAmount && action === 'reject'
      ? 0
      : needsAmount
      ? confirmedAmount
      : Number(attempt.amount);
    const total = Math.max(0, Number(payment.total || 0));
    if (
      !(needsAmount && action === 'reject') &&
      (!Number.isInteger(amount) || amount <= 0 || amount > total)
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Nominal harus antara Rp1 dan Rp${total.toLocaleString('id-ID')}.`
      );
    }

    let paid = Math.max(0, Number(payment.paid || 0));
    if (action === 'approve') {
      if (attempt.status !== 'Menunggu Verifikasi') {
        throw new functions.https.HttpsError('failed-precondition', 'Bukti sudah ditangani.');
      }
      if (paid + amount > total) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Verifikasi ini akan membuat pembayaran melebihi total.'
        );
      }
      paid += amount;
      history[attemptId] = {
        ...attempt,
        amount,
        status: 'Terverifikasi',
        reviewedAt: new Date().toISOString(),
        reviewedBy,
        legacyAmountConfirmationRequired: false,
      };
    } else if (action === 'reject') {
      if (attempt.status !== 'Menunggu Verifikasi') {
        throw new functions.https.HttpsError('failed-precondition', 'Bukti sudah ditangani.');
      }
      history[attemptId] = {
        ...attempt,
        ...(amount > 0 ? { amount } : {}),
        status: 'Ditolak',
        reviewedAt: new Date().toISOString(),
        reviewedBy,
        reviewReason: reason,
        note: reason,
      };
    } else {
      if (attempt.status !== 'Terverifikasi') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Hanya pembayaran terverifikasi yang dapat dibatalkan.'
        );
      }
      paid = Math.max(0, paid - amount);
      history[attemptId] = {
        ...attempt,
        status: 'Dibatalkan',
        reviewedAt: new Date().toISOString(),
        reviewedBy,
        reviewReason: reason,
        note: reason,
      };
    }

    const auditId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    history[auditId] = {
      id: auditId,
      date: new Date().toISOString(),
      type: action === 'approve'
        ? 'Verifikasi Pembayaran'
        : action === 'reject'
        ? 'Penolakan Pembayaran'
        : 'Pembatalan Status Lunas',
      ...(amount > 0 ? { amount } : {}),
      status: action === 'approve'
        ? 'Terverifikasi'
        : action === 'reject'
        ? 'Ditolak'
        : 'Dibatalkan',
      action: action === 'approve' ? 'Verified' : action === 'reject' ? 'Rejected' : 'Revoked',
      by: reviewedBy,
      ...(reason !== undefined ? { reason, note: reason } : {}),
      relatedPaymentId: attemptId,
    };
    const pendingAmount = Object.values(history as Record<string, any>)
      .filter((item: any) =>
        ['Bayar Lunas', 'Bayar Sebagian'].includes(item.type) &&
        item.status === 'Menunggu Verifikasi'
      )
      .reduce<number>((sum, item: any) => sum + Number(item.amount || 0), 0);
    const status = pendingAmount > 0
      ? 'Menunggu Verifikasi'
      : paid === total
      ? 'Lunas'
      : 'Belum Lunas';
    const oldWaiting =
      payment.status === 'Menunggu Verifikasi' ||
      oldPending > 0 ||
      Boolean(payment.requiresAmountConfirmation);
    const newWaiting = pendingAmount > 0;
    const oldFull = Number(payment.paid || 0) === total;
    const newFull = paid === total && !newWaiting;
    // The reviewed record is not written yet, so substitute its new values.
    const santriPayments: PaymentStatusSummaryInput[] = [];
    santriPaymentStatusesSnapshot?.forEach((snapshot) => {
      santriPayments.push(
        snapshot.id === paymentStatusId
          ? {
              ...snapshot.data(),
              paid,
              pendingAmount,
              status,
              requiresAmountConfirmation: false,
            }
          : snapshot.data()
      );
    });
    const { jumlahTunggakan, statusTanggungan } =
      deriveSantriTanggungan(santriPayments);

    transaction.update(paymentRef, {
      paid,
      pendingAmount,
      status,
      history,
      schemaVersion: 2,
      requiresAmountConfirmation: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (invoiceRef && invoiceSnapshot?.exists) {
      transaction.update(invoiceRef, {
        numberOfWaitingVerification: Math.max(
          0,
          Number(invoiceSnapshot.data()?.numberOfWaitingVerification || 0) +
            (newWaiting ? 1 : 0) -
            (oldWaiting ? 1 : 0)
        ),
        numberOfPaid: Math.max(
          0,
          Number(invoiceSnapshot.data()?.numberOfPaid || 0) +
            (newFull ? 1 : 0) -
            (oldFull ? 1 : 0)
        ),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (santriRef && santriSnapshot?.exists) {
      const santri = santriSnapshot?.data() || {};
      const isHigherEducation = ['pt', 'perguruan tinggi'].includes(
        String(santri.jenjangPendidikan || '').trim().toLowerCase()
      );
      transaction.update(santriRef, {
        jumlahTunggakan,
        statusTanggungan,
        ...(shouldActivate
          ? {
              statusAktif: 'Aktif',
              registrationActivationCounterHandled: attemptId,
              ...(isHigherEducation
                ? { semesterAutoUpdatedPeriod: getCurrentAcademicSemesterKeyForRegistration() }
                : {}),
            }
          : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (shouldActivate && santriSnapshot?.exists && counterRef) {
      const kodeAsrama = santriSnapshot.data()?.kodeAsrama;
      transaction.set(counterRef, {
        [kodeAsrama]: Number(counterSnapshot?.data()?.[kodeAsrama] || 0) + 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

  return { success: true };
});

// HTTP endpoint with CORS support for registering new santri
export const registerSantriHttp = functions.https.onRequest((request, response) => {
  // Enable CORS using the corsHandler
  return corsHandler(request, response, async () => {
    try {
      // Extract data from the request
      const data = request.method === 'POST' ? request.body.data || request.body : {};

      const inputSantri = data.santriData || data;
      if (!inputSantri.email || !inputSantri.nama || !data.kodeAsrama) {
        return response.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Data santri tidak lengkap. Silakan lengkapi formulir.'
        });
      }

      const result = await registerSantriImpl(data);

      return response.status(200).json(result);
    } catch (error) {
      console.error('Error in registerSantriHttp:', error);
      const registrationError = error as any;
      const isClientError = registrationError instanceof functions.https.HttpsError &&
        ['invalid-argument', 'already-exists'].includes(registrationError.code);
      return response.status(isClientError ? 400 : 500).json({
        success: false,
        error: isClientError ? registrationError.code : 'internal',
        message: isClientError
          ? registrationError.message
          : 'Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti.'
      });
    }
  });
});
