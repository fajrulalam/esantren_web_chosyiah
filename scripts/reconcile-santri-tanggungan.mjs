// Recomputes statusTanggungan / jumlahTunggakan of every santri from their
// PaymentStatuses records, repairing counters that drifted (for example paid-up
// santri still flagged "Belum Lunas" because the old approval flow never
// decremented jumlahTunggakan). Idempotent; only santri whose values differ are
// touched.
//
// Dry run (read-only, default; prints a summary):
//   node scripts/reconcile-santri-tanggungan.mjs
//   node scripts/reconcile-santri-tanggungan.mjs --verbose   # also list each santri id
//   node scripts/reconcile-santri-tanggungan.mjs --kode=DU11_ChosyiahJadid
//   node scripts/reconcile-santri-tanggungan.mjs --status=Aktif,Pending   # skip Lulus/Boyong/Ditolak/...
// Apply (requires firebase-admin; uses the service-account key when present,
// otherwise the active Google Application Default Credentials). A backup of the
// current values is written to scripts/output before any change:
//   node scripts/reconcile-santri-tanggungan.mjs --apply

import { deleteApp as deleteClientApp, initializeApp as initializeClientApp } from "firebase/app";
import { collection, getDocs, getFirestore as getClientFirestore } from "firebase/firestore";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
// Same rules the Cloud Functions use, so this script cannot drift from them.
import { deriveSantriTanggungan } from "../functions/src/santriTanggunganMath.ts";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");
const kodeArg = process.argv.find((arg) => arg.startsWith("--kode="));
const KODE_FILTER = kodeArg ? kodeArg.slice("--kode=".length) : null;
const statusArg = process.argv.find((arg) => arg.startsWith("--status="));
const STATUS_FILTER = statusArg ? statusArg.slice("--status=".length).split(",") : null;
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

async function discoverWithClient() {
  const clientApp = initializeClientApp(firebaseConfig, `reconcile-tanggungan-${Date.now()}`);
  const clientDb = getClientFirestore(clientApp);
  const [santriSnapshot, paymentSnapshot] = await Promise.all([
    getDocs(collection(clientDb, "SantriCollection")),
    getDocs(collection(clientDb, "PaymentStatuses")),
  ]);
  if (santriSnapshot.metadata.fromCache || paymentSnapshot.metadata.fromCache) {
    throw new Error("Could not reach Firestore; refusing to report cached/offline results.");
  }

  const paymentsBySantri = new Map();
  for (const snapshot of paymentSnapshot.docs) {
    const data = snapshot.data();
    if (!data.santriId) continue;
    if (!paymentsBySantri.has(data.santriId)) paymentsBySantri.set(data.santriId, []);
    paymentsBySantri.get(data.santriId).push(data);
  }

  const changes = [];
  let considered = 0;
  for (const snapshot of santriSnapshot.docs) {
    const santri = snapshot.data();
    if (KODE_FILTER && santri.kodeAsrama !== KODE_FILTER) continue;
    if (STATUS_FILTER && !STATUS_FILTER.includes(santri.statusAktif)) continue;
    considered += 1;
    const derived = deriveSantriTanggungan(paymentsBySantri.get(snapshot.id) || []);
    if (
      santri.statusTanggungan !== derived.statusTanggungan ||
      santri.jumlahTunggakan !== derived.jumlahTunggakan
    ) {
      changes.push({
        id: snapshot.id,
        statusAktif: santri.statusAktif ?? "(none)",
        before: {
          statusTanggungan: santri.statusTanggungan ?? null,
          jumlahTunggakan: santri.jumlahTunggakan ?? null,
        },
        after: derived,
      });
    }
  }

  await deleteClientApp(clientApp);
  return { considered, changes };
}

function summarize({ considered, changes }) {
  const transitions = {};
  for (const change of changes) {
    const key = `[${change.statusAktif}] ${change.before.statusTanggungan} -> ${change.after.statusTanggungan}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }
  console.log(`Santri considered: ${considered}`);
  console.log(`Santri that need changes: ${changes.length}`);
  console.table(
    Object.entries(transitions)
      .sort((a, b) => b[1] - a[1])
      .map(([transition, count]) => ({ transition, count }))
  );
  const counterOnly = changes.filter(
    (change) => change.before.statusTanggungan === change.after.statusTanggungan
  ).length;
  console.log(`  of which only jumlahTunggakan differs (status already right): ${counterOnly}`);
}

async function applyChanges(changes) {
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

  const credential = existsSync(serviceAccountPath)
    ? adminApp.cert(JSON.parse(readFileSync(serviceAccountPath, "utf8")))
    : adminApp.applicationDefault();
  adminApp.initializeApp({ credential, projectId: "e-santren" });
  if (!existsSync(serviceAccountPath)) {
    console.log("No local service-account key found; using Google Application Default Credentials.");
  }
  const db = adminFirestore.getFirestore();

  mkdirSync(outputDir, { recursive: true });
  const backupPath = path.join(outputDir, `santri-tanggungan-backup-${Date.now()}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(changes.map(({ id, before }) => ({ id, ...before })), null, 2)
  );
  console.log(`Backup written before mutations: ${backupPath}`);

  let updated = 0;
  let alreadyCorrect = 0;
  let missing = 0;
  for (const change of changes) {
    // Re-derive inside a transaction so a payment review that lands while this
    // runs is never overwritten with stale numbers.
    const result = await db.runTransaction(async (transaction) => {
      const santriRef = db.collection("SantriCollection").doc(change.id);
      const [santriSnapshot, paymentsSnapshot] = await Promise.all([
        transaction.get(santriRef),
        transaction.get(db.collection("PaymentStatuses").where("santriId", "==", change.id)),
      ]);
      if (!santriSnapshot.exists) return "missing";
      const derived = deriveSantriTanggungan(paymentsSnapshot.docs.map((doc) => doc.data()));
      const current = santriSnapshot.data();
      if (
        current.statusTanggungan === derived.statusTanggungan &&
        current.jumlahTunggakan === derived.jumlahTunggakan
      ) {
        return "unchanged";
      }
      transaction.update(santriRef, {
        jumlahTunggakan: derived.jumlahTunggakan,
        statusTanggungan: derived.statusTanggungan,
      });
      return "updated";
    });
    if (result === "updated") updated += 1;
    else if (result === "unchanged") alreadyCorrect += 1;
    else missing += 1;
  }

  console.log(
    `Applied: ${updated}; already correct on recheck: ${alreadyCorrect}; no longer exist: ${missing}`
  );
}

async function main() {
  const discovery = await discoverWithClient();
  console.log(
    `Mode: ${APPLY ? "apply" : "dry-run"}` +
      `${KODE_FILTER ? ` kodeAsrama=${KODE_FILTER}` : ""}` +
      `${STATUS_FILTER ? ` statusAktif=${STATUS_FILTER.join(",")}` : ""}`
  );
  summarize(discovery);
  if (VERBOSE) {
    for (const change of discovery.changes) {
      console.log(
        `${change.id} [${change.statusAktif}] ` +
          `${change.before.statusTanggungan}/${change.before.jumlahTunggakan} -> ` +
          `${change.after.statusTanggungan}/${change.after.jumlahTunggakan}`
      );
    }
  }
  if (!APPLY) {
    console.log("Dry run only. No documents were changed. Re-run with --apply after reviewing this output.");
    return;
  }
  if (discovery.changes.length === 0) {
    console.log("Nothing to change.");
    return;
  }
  await applyChanges(discovery.changes);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
