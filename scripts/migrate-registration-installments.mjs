// Idempotent migration for legacy Pending registrations.
//
// Dry run (read-only, default):
//   node scripts/migrate-registration-installments.mjs
// Apply (requires firebase-admin and e-santren-firebase-adminsdk.json):
//   node scripts/migrate-registration-installments.mjs --apply
//
// Only Pending santri are considered. Existing Active/Boyong/Lulus/
// Dikeluarkan/Ditolak records are deliberately never backfilled.

import { deleteApp as deleteClientApp, initializeApp as initializeClientApp } from "firebase/app";
import {
  collection,
  getDoc,
  getDocs,
  getFirestore as getClientFirestore,
  doc as clientDoc,
  query,
  where,
} from "firebase/firestore";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REGISTRATION_TOTAL = 3_960_000;
const APPLY = process.argv.includes("--apply");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.join(scriptDir, "..", "e-santren-firebase-adminsdk.json");
const outputDir = path.join(scriptDir, "output");

const firebaseConfig = {
  apiKey: "AIzaSyBrdjIPSIhnQjZuiQ1DsRNFUngs0vXIF_4",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:27b8ab5724915905d47720",
};

const registrationInvoiceId = (kodeAsrama) => `registration_fee_${kodeAsrama}`;
const registrationStatusId = (kodeAsrama, santriId) =>
  `${registrationInvoiceId(kodeAsrama)}_${santriId}`;

async function discoverWithClient() {
  const clientApp = initializeClientApp(firebaseConfig, `registration-migration-${Date.now()}`);
  const clientDb = getClientFirestore(clientApp);
  const pendingSnapshot = await getDocs(
    query(collection(clientDb, "SantriCollection"), where("statusAktif", "==", "Pending"))
  );
  if (pendingSnapshot.metadata.fromCache) {
    throw new Error(
      "Dry run could not reach Firestore; refusing to report cached/offline results."
    );
  }
  const candidates = [];
  const skipped = [];

  for (const santriSnapshot of pendingSnapshot.docs) {
    const data = santriSnapshot.data();
    if (data.registrationPaymentStatusId) {
      skipped.push({ id: santriSnapshot.id, reason: "already-linked" });
      continue;
    }
    if (!data.kodeAsrama || !data.paymentProofUrl) {
      skipped.push({
        id: santriSnapshot.id,
        reason: !data.kodeAsrama ? "missing-kode-asrama" : "missing-primary-proof",
      });
      continue;
    }
    const paymentStatusId = registrationStatusId(data.kodeAsrama, santriSnapshot.id);
    const existingStatus = await getDoc(clientDoc(clientDb, "PaymentStatuses", paymentStatusId));
    if (existingStatus.metadata.fromCache) {
      throw new Error(
        `Dry run lost its Firestore connection while checking ${paymentStatusId}.`
      );
    }
    candidates.push({
      id: santriSnapshot.id,
      nama: data.nama || "",
      kodeAsrama: data.kodeAsrama,
      paymentProofUrl: data.paymentProofUrl,
      paymentStatusId,
      existingStatus: existingStatus.exists(),
      mergedProofCount: Array.isArray(data.mergedPaymentProofs)
        ? data.mergedPaymentProofs.length
        : 0,
    });
  }

  await deleteClientApp(clientApp);
  return { pendingCount: pendingSnapshot.size, candidates, skipped };
}

async function applyMigration(discovery) {
  if (!existsSync(serviceAccountPath)) {
    throw new Error(`Missing service account key: ${serviceAccountPath}`);
  }

  let adminApp;
  let adminFirestore;
  try {
    adminApp = await import("firebase-admin/app");
    adminFirestore = await import("firebase-admin/firestore");
  } catch {
    throw new Error(
      "firebase-admin is not installed. Install the Functions dependencies before using --apply."
    );
  }

  adminApp.initializeApp({
    credential: adminApp.cert(JSON.parse(readFileSync(serviceAccountPath, "utf8"))),
  });
  const db = adminFirestore.getFirestore();
  const backup = [];

  for (const candidate of discovery.candidates) {
    const santriRef = db.collection("SantriCollection").doc(candidate.id);
    const invoiceRef = db.collection("Invoices").doc(registrationInvoiceId(candidate.kodeAsrama));
    const paymentRef = db.collection("PaymentStatuses").doc(candidate.paymentStatusId);
    const [santriSnapshot, invoiceSnapshot, paymentSnapshot] = await Promise.all([
      santriRef.get(),
      invoiceRef.get(),
      paymentRef.get(),
    ]);
    backup.push({
      santri: { id: candidate.id, data: santriSnapshot.data() || null },
      invoice: { id: invoiceRef.id, data: invoiceSnapshot.data() || null },
      paymentStatus: { id: paymentRef.id, data: paymentSnapshot.data() || null },
    });
  }

  mkdirSync(outputDir, { recursive: true });
  const backupPath = path.join(outputDir, `registration-installments-backup-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written before mutations: ${backupPath}`);

  let migrated = 0;
  let alreadyLinked = 0;
  for (const candidate of discovery.candidates) {
    const migratedNow = await db.runTransaction(async (transaction) => {
      const santriRef = db.collection("SantriCollection").doc(candidate.id);
      const invoiceRef = db.collection("Invoices").doc(registrationInvoiceId(candidate.kodeAsrama));
      const paymentRef = db.collection("PaymentStatuses").doc(candidate.paymentStatusId);
      const [santriSnapshot, invoiceSnapshot, paymentSnapshot] = await Promise.all([
        transaction.get(santriRef),
        transaction.get(invoiceRef),
        transaction.get(paymentRef),
      ]);
      if (!santriSnapshot.exists || santriSnapshot.data()?.statusAktif !== "Pending") return false;
      if (santriSnapshot.data()?.registrationPaymentStatusId || paymentSnapshot.exists) return false;

      const santri = santriSnapshot.data();
      const attemptId = `legacy_registration_${candidate.id}`;
      const existingIds = invoiceSnapshot.exists
        ? invoiceSnapshot.data()?.selectedSantriIds || []
        : [];
      const selectedSantriIds = existingIds.includes(candidate.id)
        ? existingIds
        : [...existingIds, candidate.id];

      transaction.set(invoiceRef, {
        paymentName: "Biaya Pendaftaran",
        nominal: REGISTRATION_TOTAL,
        kodeAsrama: candidate.kodeAsrama,
        systemManaged: true,
        systemType: "registration_fee",
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
          ? invoiceSnapshot.data()?.timestamp || adminFirestore.FieldValue.serverTimestamp()
          : adminFirestore.FieldValue.serverTimestamp(),
        createdAt: invoiceSnapshot.exists
          ? invoiceSnapshot.data()?.createdAt || adminFirestore.FieldValue.serverTimestamp()
          : adminFirestore.FieldValue.serverTimestamp(),
        lastUpdated: adminFirestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.set(paymentRef, {
        invoiceId: invoiceRef.id,
        paymentName: "Biaya Pendaftaran",
        santriId: candidate.id,
        santriName: santri.nama || "",
        nama: santri.nama || "",
        educationGrade: santri.semester || santri.kelas || "1",
        educationLevel: santri.jenjangPendidikan || "Perguruan Tinggi",
        programStudi: santri.programStudi || "",
        kamar: santri.kamar || "-",
        nomorWaliSantri: santri.nomorWalisantri || "",
        nomorTelpon: santri.nomorTelpon || "",
        status: "Menunggu Verifikasi",
        paid: 0,
        pendingAmount: 0,
        total: REGISTRATION_TOTAL,
        schemaVersion: 2,
        systemType: "registration_fee",
        requiresAmountConfirmation: true,
        history: {
          [attemptId]: {
            id: attemptId,
            date: new Date().toISOString(),
            type: "Bayar Sebagian",
            status: "Menunggu Verifikasi",
            imageUrl: santri.paymentProofUrl,
            paymentMethod: "transfer",
            inputtedBy: "Pendaftar lama",
            legacyAmountConfirmationRequired: true,
          },
        },
        createdAt: adminFirestore.FieldValue.serverTimestamp(),
        updatedAt: adminFirestore.FieldValue.serverTimestamp(),
      });
      transaction.update(santriRef, {
        registrationFeeTotal: REGISTRATION_TOTAL,
        registrationPaymentStatusId: paymentRef.id,
        registrationInitialPaymentId: attemptId,
        jumlahTunggakan: Math.max(1, Number(santri.jumlahTunggakan || 0)),
        statusTanggungan: "Menunggu Verifikasi",
        updatedAt: adminFirestore.FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (migratedNow) migrated += 1;
    else alreadyLinked += 1;
  }

  console.log(`Applied: ${migrated}; skipped after transaction recheck: ${alreadyLinked}`);
}

async function main() {
  const discovery = await discoverWithClient();
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", ...discovery }, null, 2));
  if (!APPLY) {
    console.log("Dry run only. No documents were changed. Re-run with --apply after reviewing this output.");
    return;
  }
  await applyMigration(discovery);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
