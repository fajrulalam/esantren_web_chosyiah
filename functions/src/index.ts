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
import { corsHandler, setCorsHeaders } from "./corsConfig";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export the invoice creation function
export const processInvoiceCreation = functions.firestore
  .document("Invoices/{invoiceId}")
  .onCreate(createPaymentStatusesOnInvoiceCreation);

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

        // 2. Get all payment statuses for this invoice
        const paymentStatusesQuery = await admin.firestore()
          .collection('PaymentStatuses')
          .where('invoiceId', '==', invoiceId)
          .get();

        if (paymentStatusesQuery.empty) {
          console.warn(`No payment statuses found for invoice: ${invoiceId}. Proceeding with invoice deletion only.`);
        } else {
          // 3. For each payment status, update the santri's jumlahTunggakan
          const batch = admin.firestore().batch();
          
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
                ref: admin.firestore().collection('SantriCollection').doc(santriId),
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
        const kodeAsrama = invoiceData.kodeAsrama;
        const nominal = invoiceData.nominal;
        
        // 2. Fetch the santri data for all santris to be added
        console.log(`Fetching ${santriIds.length} santri documents to add to invoice ${invoiceId}`, 
          { structuredData: true });
        
        const santriPromises = santriIds.map(santriId => 
          admin.firestore().collection("SantriCollection").doc(santriId).get()
        );
        
        const santriDocs = await Promise.all(santriPromises);
        const santriList = [];
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

        // 3. Update all selected students' statusTanggungan and increment jumlahTunggakan
        console.log(
          `Updating statusTanggungan for ${santriList.length} santris`,
          { structuredData: true }
        );
        
        const updateStatusPromises = santriList.map((santri) => {
          return admin.firestore().collection("SantriCollection").doc(santri.id).update({
            statusTanggungan: "Belum Lunas",
            jumlahTunggakan: admin.firestore.FieldValue.increment(1)
          });
        });

        // Execute all status updates in parallel
        await Promise.all(updateStatusPromises);
        
        // 4. Create payment status documents for each new santri
        const batch = admin.firestore().batch();
        
        for (const santri of santriList) {
          const paymentStatusId = `${invoiceId}_${santri.id}`;
          const paymentStatusRef = admin.firestore()
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
        
        // 2. Delete the payment status documents for each santri
        const batch = admin.firestore().batch();
        let deletedCount = 0;
        
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
              
              // Update the santri's jumlahTunggakan and statusTanggungan
              const santriRef = admin.firestore().collection("SantriCollection").doc(santriId);
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
              console.warn(
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

// Shared function for santri registration
const registerSantriImpl = async (data: any) => {
  // Prepare Santri data with all required fields
  const santriData = {
    email: data.email,
    nama: data.nama,
    tempatLahir: data.tempatLahir,
    tanggalLahir: data.tanggalLahir,
    namaOrangTua: data.namaOrangTua,
    alamatRumah: data.alamatRumah,
    nomorTelpon: data.nomorTelpon,
    nomorWalisantri: data.nomorWalisantri,
    programStudi: data.programStudi,
    sekolahAsal: data.sekolahAsal,
    
    // Automatic fields
    kodeAsrama: data.kodeAsrama,
    statusTanggungan: 'Menunggu Verifikasi',
    kamar: '-',
    statusAktif: 'Pending',
    
    // Other required fields from Santri interface
    kelas: data.programStudi,
    tahunMasuk: new Date().getFullYear().toString(),
    jenjangPendidikan: 'PT',
    semester: '1',
    jumlahTunggakan: 0,
    
    // Payment related fields
    paymentOption: data.paymentOption,
    paymentProofUrl: data.paymentProofUrl,
    
    // Timestamp fields
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Add to SantriCollection
  const docRef = await admin.firestore().collection('SantriCollection').add(santriData);
  
  // Note: Counters are not updated here because statusAktif is 'Pending'
  // It will be updated when admin approves and changes status to 'Aktif'
  
  console.log(`New santri registration: ${docRef.id}`, santriData);
  
  return {
    success: true,
    id: docRef.id,
    message: 'Pendaftaran berhasil! Silakan menunggu konfirmasi dari admin.'
  };
};

// Public API endpoint for registering new santri (callable function)
export const registerSantri = functions.https.onCall(async (data, context) => {
  try {
    return await registerSantriImpl(data);
  } catch (error) {
    console.error('Error registering santri:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti.'
    );
  }
});

// HTTP endpoint with enhanced CORS support for registering new santri
export const registerSantriHttp = functions.https.onRequest((request, response) => {
  // Apply CORS headers immediately and manually
  setCorsHeaders(response);
  
  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  
  // Then proceed with the handler
  return corsHandler(request, response, async () => {
    try {
      // Extract data from the request
      const data = request.method === 'POST' ? request.body.data || request.body : {};
      
      if (!data.email || !data.nama || !data.kodeAsrama) {
        return response.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Data santri tidak lengkap. Silakan lengkapi formulir.'
        });
      }
      
      const result = await registerSantriImpl(data);
      
      // Apply CORS headers again just to be sure
      setCorsHeaders(response);
      return response.status(200).json(result);
    } catch (error) {
      console.error('Error in registerSantriHttp:', error);
      // Apply CORS headers in error responses too
      setCorsHeaders(response);
      return response.status(500).json({
        success: false,
        error: 'internal',
        message: 'Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti.'
      });
    }
  });
});