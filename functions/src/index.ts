import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Import your business logic from separate modules
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

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// ------------------------
// Non-HTTP Trigger Functions
// ------------------------

// Firestore trigger for processing invoice creation
export const processInvoiceCreation = functions.firestore
    .document("Invoices/{invoiceId}")
    .onCreate(createPaymentStatusesOnInvoiceCreation);

// Counter maintenance functions
export const updateSantriCounter = updateCounterOnSantriStatusChange;
export const incrementSantriCounter = incrementCounterOnNewSantri;
export const decrementSantriCounter = decrementCounterOnDeletedSantri;

// Callable functions for querying
export const getSantriPayments = getSantriPaymentHistoryQuery;
export const getInvoicePayments = getInvoicePaymentStatusesQuery;

// Callable functions from invoiceFunction (if used on the client)
export const getSantriPaymentHistory = getSantriPaymentHistoryFunc;
export const getInvoicePaymentStatuses = getInvoicePaymentStatusesFunc;

// Keep the original callable delete invoice function
export const deleteInvoiceFunction = deleteInvoice;

// ------------------------
// CORS Setup for HTTP Functions
// ------------------------

const cors = require("cors");

const corsOptions = {
  origin: "https://esantren-chosyiah.vercel.app", // Only allow your Vercel app
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

const corsHandler = cors(corsOptions);

// ------------------------
// HTTP Functions Wrapped with CORS
// ------------------------

// deleteInvoiceHttp
export const deleteInvoiceHttp = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    try {
      const { invoiceId } = req.body.data || {};
      if (!invoiceId) {
        return res.status(400).json({
          error: "invalid-argument",
          message: "The function must be called with an invoiceId."
        });
      }

      const invoiceRef = admin.firestore().collection("Invoices").doc(invoiceId);
      const invoiceDoc = await invoiceRef.get();

      if (!invoiceDoc.exists) {
        return res.status(404).json({
          error: "not-found",
          message: "The specified invoice was not found."
        });
      }

      // Get payment statuses associated with this invoice
      const paymentStatusesQuery = await admin.firestore()
          .collection("PaymentStatuses")
          .where("invoiceId", "==", invoiceId)
          .get();

      if (!paymentStatusesQuery.empty) {
        const batch = admin.firestore().batch();
        const santriUpdates = new Map();

        paymentStatusesQuery.forEach((doc: any) => {
          const data = doc.data();
          const santriId = data.santriId;
          batch.delete(doc.ref);

          if (!santriUpdates.has(santriId)) {
            santriUpdates.set(santriId, {
              ref: admin.firestore().collection("SantriCollection").doc(santriId),
              currentStatus: data.status
            });
          }
        });

        // Commit deletion of payment statuses
        await batch.commit();

        // Update each santri's jumlahTunggakan and statusTanggungan
        for (const [_, santriData] of santriUpdates.entries()) {
          const santriDoc = await santriData.ref.get();
          if (santriDoc.exists) {
            const santriDocData = santriDoc.data();
            const currentTunggakan = santriDocData.jumlahTunggakan || 0;
            const newTunggakan = Math.max(0, currentTunggakan - 1);

            await santriData.ref.update({
              jumlahTunggakan: newTunggakan,
              statusTanggungan: newTunggakan === 0 ? "Lunas" : "Belum Lunas"
            });
          }
        }
      }

      // Finally, delete the invoice
      await invoiceRef.delete();

      return res.status(200).json({
        success: true,
        message: "Invoice and associated payment statuses deleted successfully"
      });
    } catch (error) {
      console.error("Error in deleteInvoiceHttp:", error);
      return res.status(500).json({
        error: "internal",
        message: `Failed to delete invoice: ${error}`
      });
    }
  });
});

// addSantrisToInvoiceHttp
export const addSantrisToInvoiceHttp = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    try {
      const { invoiceId, santriIds } = req.body.data || {};
      if (!invoiceId || !santriIds || !Array.isArray(santriIds) || santriIds.length === 0) {
        return res.status(400).json({
          error: "invalid-argument",
          message: "The function must be called with invoiceId and a non-empty santriIds array."
        });
      }

      const invoiceDoc = await admin.firestore().collection("Invoices").doc(invoiceId).get();
      if (!invoiceDoc.exists) {
        return res.status(404).json({
          error: "not-found",
          message: "The specified invoice was not found."
        });
      }

      const invoiceData = invoiceDoc.data();
      const kodeAsrama = invoiceData.kodeAsrama;
      const nominal = invoiceData.nominal;

      // Fetch santri documents
      const santriPromises = santriIds.map((santriId: string) =>
          admin.firestore().collection("SantriCollection").doc(santriId).get()
      );
      const santriDocs = await Promise.all(santriPromises);
      const santriList: any[] = [];
      let missingCount = 0;

      santriDocs.forEach((doc: any) => {
        if (doc.exists) {
          const data = doc.data();
          if (data?.kodeAsrama === kodeAsrama) {
            santriList.push({
              id: doc.id,
              nama: data.nama || "Unknown",
              kamar: data.kamar || "",
              kelas: data.kelas || "",
              jenjangPendidikan: data.jenjangPendidikan || "",
              programStudi: data.programStudi || "",
              nomorWalisantri: data.nomorWalisantri || "",
              kodeAsrama: data.kodeAsrama,
              jumlahTunggakan: data.jumlahTunggakan || 0
            });
          } else {
            console.warn(`Santri ${doc.id} has different kodeAsrama. Skipping.`);
            missingCount++;
          }
        } else {
          console.warn(`Santri ${doc.id} not found. Skipping.`);
          missingCount++;
        }
      });

      if (santriList.length === 0) {
        return res.status(200).json({
          success: false,
          message: "No valid santri records found to add to the invoice."
        });
      }

      // Update each santri's status and increment jumlahTunggakan
      const updateStatusPromises = santriList.map((santri) =>
          admin.firestore().collection("SantriCollection").doc(santri.id).update({
            statusTanggungan: "Belum Lunas",
            jumlahTunggakan: admin.firestore.FieldValue.increment(1)
          })
      );
      await Promise.all(updateStatusPromises);

      // Create payment status documents
      const batch = admin.firestore().batch();
      for (const santri of santriList) {
        const paymentStatusId = `${invoiceId}_${santri.id}`;
        const paymentStatusRef = admin.firestore().collection("PaymentStatuses").doc(paymentStatusId);
        batch.set(paymentStatusRef, {
          invoiceId: invoiceId,
          santriId: santri.id,
          santriName: santri.nama,
          nama: santri.nama,
          educationGrade: santri.kelas,
          educationLevel: santri.jenjangPendidikan,
          programStudi: santri.programStudi || "",
          kamar: santri.kamar,
          nomorWaliSantri: santri.nomorWalisantri,
          status: "Belum Lunas",
          paid: 0,
          total: nominal,
          history: {},
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      await batch.commit();

      // Update the invoice document with new santri details
      await admin.firestore().collection("Invoices").doc(invoiceId).update({
        numberOfSantriInvoiced: admin.firestore.FieldValue.increment(santriList.length),
        selectedSantriIds: admin.firestore.FieldValue.arrayUnion(...santriList.map(s => s.id))
      });

      return res.status(200).json({
        success: true,
        message: `Successfully added ${santriList.length} santris to invoice`,
        addedCount: santriList.length
      });
    } catch (error) {
      console.error("Error in addSantrisToInvoiceHttp:", error);
      return res.status(500).json({
        error: "internal",
        message: `Failed to add santris to invoice: ${error}`
      });
    }
  });
});

// removeSantrisFromInvoiceHttp
export const removeSantrisFromInvoiceHttp = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    try {
      const { invoiceId, santriIds } = req.body.data || {};
      if (!invoiceId || !santriIds || !Array.isArray(santriIds) || santriIds.length === 0) {
        return res.status(400).json({
          error: "invalid-argument",
          message: "The function must be called with invoiceId and a non-empty santriIds array."
        });
      }

      const invoiceDoc = await admin.firestore().collection("Invoices").doc(invoiceId).get();
      if (!invoiceDoc.exists) {
        return res.status(404).json({
          error: "not-found",
          message: "The specified invoice was not found."
        });
      }

      const batch = admin.firestore().batch();
      let deletedCount = 0;

      for (const santriId of santriIds) {
        const paymentStatusId = `${invoiceId}_${santriId}`;
        const paymentStatusRef = admin.firestore().collection("PaymentStatuses").doc(paymentStatusId);
        const paymentStatus = await paymentStatusRef.get();

        if (paymentStatus.exists) {
          const status = paymentStatus.data()?.status;
          if (status !== "Lunas" && status !== "Menunggu Verifikasi") {
            batch.delete(paymentStatusRef);
            deletedCount++;

            const santriRef = admin.firestore().collection("SantriCollection").doc(santriId);
            const santriDoc = await santriRef.get();
            if (santriDoc.exists) {
              const santriData = santriDoc.data();
              const currentTunggakan = santriData?.jumlahTunggakan || 0;
              const newTunggakan = Math.max(0, currentTunggakan - 1);
              await santriRef.update({
                jumlahTunggakan: newTunggakan,
                statusTanggungan: newTunggakan === 0 ? "Lunas" : "Belum Lunas"
              });
            }
          } else {
            console.warn(`Cannot remove santri ${santriId} because payment status is ${status}`);
          }
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
      }

      await admin.firestore().collection("Invoices").doc(invoiceId).update({
        numberOfSantriInvoiced: admin.firestore.FieldValue.increment(-deletedCount),
        selectedSantriIds: invoiceDoc.data()?.selectedSantriIds.filter((id: string) => !santriIds.includes(id)) || []
      });

      return res.status(200).json({
        success: true,
        message: `Successfully removed ${deletedCount} santris from invoice`,
        removedCount: deletedCount
      });
    } catch (error) {
      console.error("Error in removeSantrisFromInvoiceHttp:", error);
      return res.status(500).json({
        error: "internal",
        message: `Failed to remove santris from invoice: ${error}`
      });
    }
  });
});

// testCors endpoint to verify CORS settings
export const testCors = functions.https.onRequest((req, res) => {
  corsHandler(req, res, () => {
    return res.status(200).json({
      message: "CORS is working correctly!",
      origin: req.headers.origin || "No origin header found"
    });
  });
});

// ------------------------
// Callable Function for Registration (does not require CORS)
// ------------------------

const registerSantriImpl = async (data: any) => {
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
    kodeAsrama: data.kodeAsrama,
    statusTanggungan: "Menunggu Verifikasi",
    kamar: "-",
    statusAktif: "Pending",
    kelas: data.programStudi,
    tahunMasuk: new Date().getFullYear().toString(),
    jenjangPendidikan: "PT",
    semester: "1",
    jumlahTunggakan: 0,
    paymentOption: data.paymentOption,
    paymentProofUrl: data.paymentProofUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await admin.firestore().collection("SantriCollection").add(santriData);
  console.log(`New santri registration: ${docRef.id}`, santriData);

  return {
    success: true,
    id: docRef.id,
    message: "Pendaftaran berhasil! Silakan menunggu konfirmasi dari admin."
  };
};

export const registerSantri = functions.https.onCall(async (data, context) => {
  try {
    return await registerSantriImpl(data);
  } catch (error) {
    console.error("Error registering santri:", error);
    throw new functions.https.HttpsError(
        "internal",
        "Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti."
    );
  }
});

// HTTP endpoint for registering new santri (with CORS support)
export const registerSantriHttp = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    try {
      // Accept data either from req.body.data or req.body
      const data = req.method === "POST" ? req.body.data || req.body : {};
      if (!data.email || !data.nama || !data.kodeAsrama) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          message: "Data santri tidak lengkap. Silakan lengkapi formulir."
        });
      }

      const result = await registerSantriImpl(data);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error in registerSantriHttp:", error);
      return res.status(500).json({
        success: false,
        error: "internal",
        message: "Terjadi kesalahan saat mendaftar. Silakan coba lagi nanti."
      });
    }
  });
});