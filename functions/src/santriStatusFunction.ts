import * as functions from "firebase-functions";
import { updateActiveStudentCounter } from "./counterUtils";

/**
 * Cloud Function that updates the active student counter whenever a student's status changes
 * Note: This function only affects the counter, it does not modify past invoices
 */
export const updateCounterOnSantriStatusChange = functions.firestore
  .document("SantriCollection/{santriId}")
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      
      // If kodeAsrama or statusAktif hasn't changed, no counter update needed
      if (
        beforeData.kodeAsrama === afterData.kodeAsrama &&
        beforeData.statusAktif === afterData.statusAktif
      ) {
        return null;
      }
      
      const santriId = context.params.santriId;
      functions.logger.info(
        `Santri ${santriId} status changed. Before: ${beforeData.statusAktif} in ${beforeData.kodeAsrama}, After: ${afterData.statusAktif} in ${afterData.kodeAsrama}`,
        { structuredData: true }
      );
      
      // Case 1: Student changed asrama
      if (
        beforeData.kodeAsrama !== afterData.kodeAsrama &&
        beforeData.statusAktif === "Aktif" &&
        afterData.statusAktif === "Aktif"
      ) {
        // Decrement counter for old asrama
        await updateActiveStudentCounter(beforeData.kodeAsrama, -1);
        
        // Increment counter for new asrama
        await updateActiveStudentCounter(afterData.kodeAsrama, 1);
        
        functions.logger.info(
          `Santri ${santriId} moved from asrama ${beforeData.kodeAsrama} to ${afterData.kodeAsrama}. Counters updated.`,
          { structuredData: true }
        );
      }
      // Case 2: Student became active
      else if (
        beforeData.statusAktif !== "Aktif" &&
        afterData.statusAktif === "Aktif"
      ) {
        // Registration-payment approval increments the counter inside the same
        // transaction that activates the santri. The changed marker prevents
        // this generic trigger from counting that transition a second time.
        if (
          afterData.registrationActivationCounterHandled &&
          beforeData.registrationActivationCounterHandled !==
            afterData.registrationActivationCounterHandled
        ) {
          functions.logger.info(
            `Santri ${santriId} activation counter was handled by the registration payment transaction.`,
            { structuredData: true }
          );
          return null;
        }

        // Increment counter for the asrama
        await updateActiveStudentCounter(afterData.kodeAsrama, 1);
        
        functions.logger.info(
          `Santri ${santriId} became active in asrama ${afterData.kodeAsrama}. Counter incremented.`,
          { structuredData: true }
        );
      }
      // Case 3: Student became inactive (boyong, lulus, dikeluarkan)
      else if (
        beforeData.statusAktif === "Aktif" &&
        afterData.statusAktif !== "Aktif"
      ) {
        // Decrement counter for the asrama
        await updateActiveStudentCounter(beforeData.kodeAsrama, -1);
        
        functions.logger.info(
          `Santri ${santriId} became inactive in asrama ${beforeData.kodeAsrama}. Counter decremented.`,
          { structuredData: true }
        );
      }
      
      return null;
    } catch (error) {
      functions.logger.error("Error updating active student counter:", error);
      return null;
    }
  });

/**
 * Cloud Function that updates the active student counter when a new student is created
 * Note: This function only affects the counter for new invoices, not past ones
 */
export const incrementCounterOnNewSantri = functions.firestore
  .document("SantriCollection/{santriId}")
  .onCreate(async (snapshot, context) => {
    try {
      const santriData = snapshot.data();
      const santriId = context.params.santriId;
      
      // Only increment if the new student is active
      if (santriData.statusAktif === "Aktif") {
        await updateActiveStudentCounter(santriData.kodeAsrama, 1);
        
        functions.logger.info(
          `New active santri ${santriId} created in asrama ${santriData.kodeAsrama}. Counter incremented.`,
          { structuredData: true }
        );
      }
      
      return null;
    } catch (error) {
      functions.logger.error("Error incrementing active student counter:", error);
      return null;
    }
  });

/**
 * Cloud Function that updates the active student counter when a student is deleted
 * Note: This function only affects the counter for new invoices, not past ones
 */
export const decrementCounterOnDeletedSantri = functions.firestore
  .document("SantriCollection/{santriId}")
  .onDelete(async (snapshot, context) => {
    try {
      const santriData = snapshot.data();
      const santriId = context.params.santriId;
      
      // Only decrement if the deleted student was active
      if (santriData.statusAktif === "Aktif") {
        await updateActiveStudentCounter(santriData.kodeAsrama, -1);
        
        functions.logger.info(
          `Active santri ${santriId} deleted from asrama ${santriData.kodeAsrama}. Counter decremented.`,
          { structuredData: true }
        );
      }
      
      return null;
    } catch (error) {
      functions.logger.error("Error decrementing active student counter:", error);
      return null;
    }
  });
