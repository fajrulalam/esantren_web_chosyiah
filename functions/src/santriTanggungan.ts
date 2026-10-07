import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { deriveSantriTanggungan } from "./santriTanggunganMath";

const SYNC_CONCURRENCY = 20;

/**
 * Recomputes statusTanggungan / jumlahTunggakan of one santri from its
 * PaymentStatuses. Runs in a transaction so it cannot interleave with a payment
 * review, and only writes when something actually changed.
 */
export const syncSantriTanggungan = async (santriId: string): Promise<void> => {
  const db = admin.firestore();
  const santriRef = db.collection("SantriCollection").doc(santriId);

  await db.runTransaction(async (transaction) => {
    const [santriSnapshot, paymentsSnapshot] = await Promise.all([
      transaction.get(santriRef),
      transaction.get(
        db.collection("PaymentStatuses").where("santriId", "==", santriId)
      ),
    ]);
    if (!santriSnapshot.exists) return;

    const derived = deriveSantriTanggungan(
      paymentsSnapshot.docs.map((snapshot) => snapshot.data())
    );
    const current = santriSnapshot.data() || {};
    if (
      current.statusTanggungan === derived.statusTanggungan &&
      current.jumlahTunggakan === derived.jumlahTunggakan
    ) {
      return;
    }
    transaction.update(santriRef, {
      jumlahTunggakan: derived.jumlahTunggakan,
      statusTanggungan: derived.statusTanggungan,
    });
  });
};

/** Syncs several santri; one failure is logged and does not stop the others. */
export const syncSantriTanggunganBulk = async (
  santriIds: string[]
): Promise<void> => {
  const uniqueIds = [...new Set(santriIds)];
  for (let i = 0; i < uniqueIds.length; i += SYNC_CONCURRENCY) {
    const chunk = uniqueIds.slice(i, i + SYNC_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(syncSantriTanggungan));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        functions.logger.error(
          `Failed to sync tanggungan for santri ${chunk[index]}:`,
          result.reason
        );
      }
    });
  }
};
