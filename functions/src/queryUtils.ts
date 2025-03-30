import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * HTTP function to get all payment statuses for a specific student
 */
export const getSantriPaymentHistory = functions.https.onCall(
  async (data, context) => {
    try {
      // Check if the user is authenticated
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "The function must be called while authenticated."
        );
      }

      const { santriId } = data;
      
      if (!santriId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "The function requires a 'santriId' argument."
        );
      }

      // Query all payment statuses for this student
      const paymentStatusSnapshot = await db
        .collection("PaymentStatuses")
        .where("santriId", "==", santriId)
        .orderBy("createdAt", "desc")
        .get();

      if (paymentStatusSnapshot.empty) {
        return { paymentHistory: [] };
      }

      // Format the results
      const paymentHistory = paymentStatusSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        };
      });

      return { paymentHistory };
    } catch (error) {
      functions.logger.error("Error retrieving payment history:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while retrieving payment history."
      );
    }
  }
);

/**
 * HTTP function to get all payment statuses for a specific invoice
 */
export const getInvoicePaymentStatuses = functions.https.onCall(
  async (data, context) => {
    try {
      // Check if the user is authenticated
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "The function must be called while authenticated."
        );
      }

      const { invoiceId, status, educationLevel } = data;
      
      if (!invoiceId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "The function requires an 'invoiceId' argument."
        );
      }

      // Build the query
      let query: FirebaseFirestore.Query = db
        .collection("PaymentStatuses")
        .where("invoiceId", "==", invoiceId);

      // Add optional filters if provided
      if (status) {
        query = query.where("status", "==", status);
      }
      
      if (educationLevel) {
        query = query.where("educationLevel", "==", educationLevel);
      }

      const paymentStatusSnapshot = await query.get();

      if (paymentStatusSnapshot.empty) {
        return { paymentStatuses: [] };
      }

      // Format the results
      const paymentStatuses = paymentStatusSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        };
      });

      return { paymentStatuses };
    } catch (error) {
      functions.logger.error("Error retrieving payment statuses:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while retrieving payment statuses."
      );
    }
  }
);