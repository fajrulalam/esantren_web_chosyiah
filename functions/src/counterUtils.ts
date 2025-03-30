import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Get Firestore instance and store reference to firestore object
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue; // Explicitly store reference to FieldValue

/**
 * Updates the active student counter for a specific boarding school
 * This should be called whenever a student's active status changes
 */
export const updateActiveStudentCounter = async (
  kodeAsrama: string,
  change: number
): Promise<void> => {
  try {
    const counterRef = db.collection("Counters").doc("activeSantri");
    
    // Use transactions to safely update the counter
    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        // If counter document doesn't exist, create it with initial counts
        transaction.set(counterRef, {
          [kodeAsrama]: Math.max(0, change), // Ensure we don't go negative
          lastUpdated: FieldValue.serverTimestamp()
        });
      } else {
        // Get the current count for this asrama
        const currentCount = counterDoc.data()?.[kodeAsrama] || 0;
        
        // Update the count, ensuring it never goes below zero
        transaction.update(counterRef, {
          [kodeAsrama]: Math.max(0, currentCount + change),
          lastUpdated: FieldValue.serverTimestamp()
        });
      }
    });
    
    functions.logger.info(
      `Updated active student counter for asrama ${kodeAsrama} by ${change}`,
      { structuredData: true }
    );
  } catch (error) {
    functions.logger.error("Error updating active student counter:", error);
    throw new Error(`Failed to update active student counter: ${error}`);
  }
};

/**
 * Gets the current count of active students for a specific boarding school
 */
export const getActiveStudentCount = async (
  kodeAsrama: string
): Promise<number> => {
  try {
    const counterRef = db.collection("Counters").doc("activeSantri");
    const counterDoc = await counterRef.get();
    
    if (!counterDoc.exists) {
      return 0;
    }
    
    return counterDoc.data()?.[kodeAsrama] || 0;
  } catch (error) {
    functions.logger.error(
      `Error retrieving active student count for asrama ${kodeAsrama}:`, 
      error
    );
    return 0; // Return 0 as a safe default
  }
};