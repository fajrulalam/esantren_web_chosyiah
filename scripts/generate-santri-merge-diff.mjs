// DRY RUN — generates a concrete, reviewable merge diff for duplicate
// SantriCollection records. Writes a JSON diff file but makes NO Firestore
// writes. A separate apply script executes an approved diff.
//
// Decisions baked in per user sign-off:
//  - On conflicting fields, the newer/higher-completeness record's value wins
//    (no overwrite needed since it's already the kept doc).
//  - Legacy-only fields (statusKepulangan, kelasNgaji, absenNgaji, role, etc.)
//    are NOT preserved — user does not need old izin/pulang history kept.
//  - Any cluster where the record slated for deletion is referenced by
//    PaymentStatuses/SakitDanPulangCollection, OR where statusAktif conflicts
//    include Ditolak/Pending vs an active-ish status, is EXCLUDED from the
//    auto diff and flagged for manual review instead — those signal the
//    "duplicate" may actually be a different registration outcome/person,
//    not a true duplicate (see "della anggraini" and "saskia..." clusters).
//
// Usage: node scripts/generate-santri-merge-diff.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { writeFileSync } from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyBrdjIPSIhnQjZuiQ1DsRNFUngs0vXIF_4",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:27b8ab5724915905d47720",
};

const OUTPUT_PATH =
  "/private/tmp/claude-501/-Users-ghinannavsih-Documents-e-santren/56a17b27-69dd-4e04-8b36-9285180b154b/scratchpad/santri-merge-diff.json";

const MERGE_FIELDS = [
  "nomorWalisantri",
  "tahunMasuk",
  "jenjangPendidikan",
  "kelas",
  "semester",
  "programStudi",
  "kamar",
  "kodeAsrama",
  "tanggalLahir",
  "tempatLahir",
  "namaOrangTua",
  "alamatRumah",
  "sekolahAsal",
  "email",
  "nomorTelpon",
  "paymentOption",
  "statusAktif",
];

const NON_DUPLICATE_STATUSES = new Set(["Ditolak", "Pending"]);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeName(name) {
  return (name || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function isFilled(v) {
  return v !== undefined && v !== null && v.toString().trim() !== "";
}

function completeness(data) {
  return MERGE_FIELDS.reduce((n, f) => n + (isFilled(data[f]) ? 1 : 0), 0);
}

function groupByNormalizedName(docs) {
  const map = new Map();
  for (const d of docs) {
    const key = normalizeName(d.data.nama);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return map;
}

async function countRefs(collectionName, santriId) {
  const q = query(collection(db, collectionName), where("santriId", "==", santriId));
  const snap = await getDocs(q);
  return snap.size;
}

async function main() {
  console.log("Fetching SantriCollection...");
  const snap = await getDocs(collection(db, "SantriCollection"));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`Total documents: ${docs.length}`);

  const groups = groupByNormalizedName(docs);
  const dupClusters = [...groups.entries()].filter(([, v]) => v.length > 1);
  console.log(`Found ${dupClusters.length} duplicate-name clusters.\n`);

  const included = [];
  const excluded = [];

  let i = 0;
  for (const [key, clusterDocs] of dupClusters) {
    i++;
    process.stdout.write(`\rChecking cluster ${i}/${dupClusters.length}`);

    const sorted = [...clusterDocs].sort((a, b) => {
      const diff = completeness(b.data) - completeness(a.data);
      if (diff !== 0) return diff;
      return isFilled(b.data.nomorWalisantri) - isFilled(a.data.nomorWalisantri);
    });
    const [primary, ...secondaries] = sorted;

    // Guard 1: statusAktif conflict involving Ditolak/Pending suggests this
    // is a rejected/pending re-application, not a duplicate of the same
    // enrollment — don't touch it automatically.
    const statuses = new Set(clusterDocs.map((d) => d.data.statusAktif).filter(Boolean));
    const hasRiskyStatus = [...statuses].some((s) => NON_DUPLICATE_STATUSES.has(s)) && statuses.size > 1;

    // Guard 2: is any doc-to-be-deleted referenced by financial/operational
    // records elsewhere? If so, exclude — deleting it would orphan those refs.
    let blastRadius = [];
    for (const sec of secondaries) {
      const paymentRefs = await countRefs("PaymentStatuses", sec.id);
      const izinRefs = await countRefs("SakitDanPulangCollection", sec.id);
      if (paymentRefs > 0 || izinRefs > 0) {
        blastRadius.push({ id: sec.id, paymentRefs, izinRefs });
      }
    }

    if (hasRiskyStatus || blastRadius.length > 0) {
      excluded.push({
        nameKey: key,
        reason: hasRiskyStatus
          ? "statusAktif conflict includes Ditolak/Pending — likely a distinct application, not a true duplicate"
          : "a record slated for deletion is referenced by PaymentStatuses/SakitDanPulangCollection",
        docs: clusterDocs.map((d) => ({ id: d.id, nama: d.data.nama, statusAktif: d.data.statusAktif })),
        blastRadius,
      });
      continue;
    }

    const writes = {};
    for (const f of MERGE_FIELDS) {
      if (isFilled(primary.data[f])) continue;
      for (const sec of secondaries) {
        if (isFilled(sec.data[f])) {
          writes[f] = sec.data[f];
          break;
        }
      }
    }

    included.push({
      nameKey: key,
      keepId: primary.id,
      keepNama: primary.data.nama,
      deleteIds: secondaries.map((s) => s.id),
      writes,
    });
  }
  console.log("\n");

  const diff = {
    generatedAt: new Date().toISOString(),
    totalClusters: dupClusters.length,
    includedCount: included.length,
    excludedCount: excluded.length,
    included,
    excluded,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(diff, null, 2));

  console.log("=== Summary ===");
  console.log(`Total duplicate-name clusters: ${dupClusters.length}`);
  console.log(`Included in auto-merge plan (safe to apply after your review): ${included.length}`);
  console.log(`Excluded — needs manual decision: ${excluded.length}`);
  for (const e of excluded) {
    console.log(`  - [${e.nameKey}] ${e.reason}`);
    for (const d of e.docs) console.log(`      ${d.id} | statusAktif=${d.statusAktif}`);
  }

  const totalDeletes = included.reduce((n, c) => n + c.deleteIds.length, 0);
  const totalWrites = included.filter((c) => Object.keys(c.writes).length > 0).length;
  console.log(`\nIf applied: ${totalDeletes} documents deleted, ${totalWrites} kept documents get gap-filled fields.`);
  console.log(`\nFull diff written to:\n${OUTPUT_PATH}`);
  console.log("No Firestore writes were made. This is a dry run only.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
