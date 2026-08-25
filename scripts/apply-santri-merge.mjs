// APPLIES an approved merge diff (from generate-santri-merge-diff.mjs) to
// SantriCollection: writes gap-fill fields onto kept docs, then deletes the
// redundant docs. Uses the Firebase Admin SDK with a service account key,
// which bypasses Firestore security rules entirely — no user login needed.
//
// Setup (one-time):
//   1. Firebase Console -> Project Settings (gear icon) -> Service Accounts
//   2. Click "Generate new private key" -> downloads a JSON file
//   3. Save it as: scripts/serviceAccountKey.json  (already gitignored)
//
// Safety:
//  - Backs up every doc about to be deleted (full data) to a timestamped JSON
//    file before deleting anything, so this is reversible by re-creating docs.
//  - Only acts on diff.included — diff.excluded entries are never touched.
//
// Usage: node scripts/apply-santri-merge.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, existsSync } from "fs";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "e-santren-firebase-adminsdk.json");

const DIFF_PATH =
  "/private/tmp/claude-501/-Users-ghinannavsih-Documents-e-santren/56a17b27-69dd-4e04-8b36-9285180b154b/scratchpad/santri-merge-diff.json";
const BACKUP_PATH = `/private/tmp/claude-501/-Users-ghinannavsih-Documents-e-santren/56a17b27-69dd-4e04-8b36-9285180b154b/scratchpad/santri-merge-backup-${Date.now()}.json`;

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    `Missing service account key at ${SERVICE_ACCOUNT_PATH}\n` +
      `Get one from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key,\n` +
      `then save it exactly at that path (it's already gitignored).`
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  const diff = JSON.parse(readFileSync(DIFF_PATH, "utf-8"));
  console.log(`Loaded diff: ${diff.includedCount} clusters to merge, ${diff.excludedCount} excluded (untouched).`);
  console.log(`Authenticated as service account: ${serviceAccount.client_email}`);

  const totalDeletes = diff.included.reduce((n, c) => n + c.deleteIds.length, 0);
  const confirm = await ask(
    `\nThis will delete ${totalDeletes} SantriCollection documents across ${diff.includedCount} clusters. Type EXACTLY "delete ${totalDeletes} documents" to proceed: `
  );
  if (confirm !== `delete ${totalDeletes} documents`) {
    console.log("Confirmation text did not match. Aborting — nothing was changed.");
    process.exit(1);
  }

  console.log("\nBacking up all documents about to be deleted...");
  const backup = [];
  for (const cluster of diff.included) {
    for (const id of cluster.deleteIds) {
      const snap = await db.collection("SantriCollection").doc(id).get();
      if (snap.exists) {
        backup.push({ id, keepId: cluster.keepId, nameKey: cluster.nameKey, data: snap.data() });
      }
    }
  }
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
  console.log(`Backed up ${backup.length} documents to:\n${BACKUP_PATH}`);

  console.log("\nApplying merges...");
  let writesApplied = 0;
  let deletesApplied = 0;
  for (const cluster of diff.included) {
    if (Object.keys(cluster.writes).length > 0) {
      await db.collection("SantriCollection").doc(cluster.keepId).update(cluster.writes);
      writesApplied++;
    }
    for (const id of cluster.deleteIds) {
      await db.collection("SantriCollection").doc(id).delete();
      deletesApplied++;
    }
    process.stdout.write(`\r${cluster.nameKey}: done`.padEnd(80));
  }

  console.log(`\n\nDone. ${writesApplied} kept docs updated, ${deletesApplied} docs deleted.`);
  console.log(`Backup for rollback: ${BACKUP_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
