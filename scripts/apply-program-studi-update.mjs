// Applies the approved programStudi standardization to SantriCollection.
// Scope (per user review of scripts/output/program-studi-match.json):
//   - APPLY: confidence EXACT, ABBREV, HIGH, MEDIUM
//   - SKIP:  confidence NOT_APPLICABLE, NO_MATCH (left untouched)
//
// Uses the Firebase Admin SDK (service account key) — bypasses security rules,
// no interactive login needed. Backs up every changed doc's old value first.
//
// Usage: node scripts/apply-program-studi-update.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "e-santren-firebase-adminsdk.json");
const MATCH_REPORT_PATH = path.join(__dirname, "output", "program-studi-match.json");
const BACKUP_PATH = path.join(__dirname, "output", `program-studi-backup-${Date.now()}.json`);

const APPLY_CONFIDENCES = new Set(["EXACT", "ABBREV", "HIGH", "MEDIUM"]);

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`Missing service account key at ${SERVICE_ACCOUNT_PATH}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const report = JSON.parse(readFileSync(MATCH_REPORT_PATH, "utf-8"));

  // currentValue -> proposedMatch, for the approved buckets only
  const approvedMap = new Map();
  for (const r of report.results) {
    if (APPLY_CONFIDENCES.has(r.confidence)) {
      approvedMap.set(r.currentValue, r.proposedMatch);
    }
  }
  console.log(`Approved distinct values to standardize: ${approvedMap.size}`);
  console.log([...approvedMap.entries()].map(([k, v]) => `  "${k}" -> "${v}"`).join("\n"));

  console.log("\nFetching live SantriCollection...");
  const snap = await db.collection("SantriCollection").get();
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`Total documents: ${docs.length}`);

  const toUpdate = [];
  for (const d of docs) {
    const raw = (d.data.programStudi || "").toString().trim();
    if (!raw) continue;
    if (approvedMap.has(raw)) {
      const newValue = approvedMap.get(raw);
      if (newValue && newValue !== d.data.programStudi) {
        toUpdate.push({ id: d.id, nama: d.data.nama, oldValue: d.data.programStudi, newValue });
      }
    }
  }

  console.log(`\n${toUpdate.length} documents will be updated (re-checked against live data, may differ slightly from the dry-run snapshot).`);

  if (toUpdate.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  writeFileSync(BACKUP_PATH, JSON.stringify(toUpdate, null, 2));
  console.log(`Backup of old values written to:\n${BACKUP_PATH}`);

  console.log("\nApplying updates...");
  let count = 0;
  for (const u of toUpdate) {
    await db.collection("SantriCollection").doc(u.id).update({ programStudi: u.newValue });
    count++;
    process.stdout.write(`\r${count}/${toUpdate.length} updated`.padEnd(60));
  }

  console.log(`\n\nDone. ${count} documents updated.`);
  console.log(`Backup for rollback: ${BACKUP_PATH}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
