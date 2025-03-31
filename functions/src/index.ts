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

// Export HTTP callable function for deleting invoices
export const deleteInvoiceFunction = deleteInvoice;

// Export HTTP callable functions for modifying invoices
export const addSantrisToInvoiceFunction = addSantrisToInvoice;
export const removeSantrisFromInvoiceFunction = removeSantrisFromInvoice;

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