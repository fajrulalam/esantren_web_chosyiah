// DRY RUN ONLY — proposes a merge plan for duplicate SantriCollection records.
// Does NOT write, update, or delete anything in Firestore.
//
// Usage: node scripts/merge-duplicate-santri.mjs
// Output: prints a summary + writes a full JSON plan for review.

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
  "/private/tmp/claude-501/-Users-ghinannavsih-Documents-e-santren/56a17b27-69dd-4e04-8b36-9285180b154b/scratchpad/duplicate-santri-merge-plan.json";

// Fields we compare/fill when merging. Excludes id/nama (used as identity) and
// statusTanggungan/jumlahTunggakan (financial fields — never auto-merge these).
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

async function buildClusterPlan(docs) {
  // Pick primary = highest completeness score; ties broken by presence of
  // nomorWalisantri (a populated-by-a-human record beats an empty shell).
  const sorted = [...docs].sort((a, b) => {
    const diff = completeness(b.data) - completeness(a.data);
    if (diff !== 0) return diff;
    return isFilled(b.data.nomorWalisantri) - isFilled(a.data.nomorWalisantri);
  });
  const [primary, ...secondaries] = sorted;

  const fieldsToFill = {};
  const conflicts = {};
  for (const sec of secondaries) {
    for (const f of MERGE_FIELDS) {
      const pVal = primary.data[f];
      const sVal = sec.data[f];
      if (!isFilled(pVal) && isFilled(sVal)) {
        fieldsToFill[f] = fieldsToFill[f] || {};
        fieldsToFill[f][sec.id] = sVal;
      } else if (isFilled(pVal) && isFilled(sVal) && pVal.toString() !== sVal.toString()) {
        conflicts[f] = conflicts[f] || {};
        conflicts[f][primary.id] = pVal;
        conflicts[f][sec.id] = sVal;
      }
    }
  }

  const secondaryDetails = [];
  for (const sec of secondaries) {
    const paymentStatusRefs = await countRefs("PaymentStatuses", sec.id);
    const izinRefs = await countRefs("SakitDanPulangCollection", sec.id);
    secondaryDetails.push({
      id: sec.id,
      data: sec.data,
      completeness: completeness(sec.data),
      referencedIn: {
        PaymentStatuses: paymentStatusRefs,
        SakitDanPulangCollection: izinRefs,
        note: "Attendance session records store santriId as a map key and are not counted here — check manually if this record is Aktif.",
      },
    });
  }

  return {
    primary: { id: primary.id, data: primary.data, completeness: completeness(primary.data) },
    secondaries: secondaryDetails,
    proposedFieldFills: fieldsToFill,
    conflicts,
    hasConflicts: Object.keys(conflicts).length > 0,
    hasBlastRadius: secondaryDetails.some(
      (s) => s.referencedIn.PaymentStatuses > 0 || s.referencedIn.SakitDanPulangCollection > 0
    ),
  };
}

async function main() {
  console.log("Fetching SantriCollection...");
  const snap = await getDocs(collection(db, "SantriCollection"));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`Total documents: ${docs.length}`);

  const groups = groupByNormalizedName(docs);
  const dupClusters = [...groups.entries()].filter(([, v]) => v.length > 1);
  console.log(`Found ${dupClusters.length} duplicate-name clusters. Building merge plan (checking references, this takes a bit)...\n`);

  const plan = [];
  let i = 0;
  for (const [key, clusterDocs] of dupClusters) {
    i++;
    process.stdout.write(`\rProcessing cluster ${i}/${dupClusters.length}`);
    const clusterPlan = await buildClusterPlan(clusterDocs);
    plan.push({ nameKey: key, ...clusterPlan });
  }
  console.log("\n");

  const cleanCount = plan.filter((p) => !p.hasConflicts && !p.hasBlastRadius).length;
  const conflictCount = plan.filter((p) => p.hasConflicts).length;
  const blastCount = plan.filter((p) => p.hasBlastRadius && !p.hasConflicts).length;

  console.log("=== Merge plan summary ===");
  console.log(`Total clusters: ${plan.length}`);
  console.log(`  Clean (no field conflicts, no other-collection references on the record to delete): ${cleanCount}`);
  console.log(`  Has field conflicts (needs manual pick): ${conflictCount}`);
  console.log(`  Has references in PaymentStatuses/SakitDanPulangCollection (needs re-pointing before delete): ${blastCount}`);

  console.log("\n=== Clusters needing manual attention ===");
  for (const p of plan) {
    if (!p.hasConflicts && !p.hasBlastRadius) continue;
    console.log(`\n[${p.nameKey}]`);
    console.log(`  keep:   ${p.primary.id} (completeness ${p.primary.completeness})`);
    for (const s of p.secondaries) {
      console.log(
        `  remove: ${s.id} (completeness ${s.completeness}) — refs: PaymentStatuses=${s.referencedIn.PaymentStatuses}, SakitDanPulangCollection=${s.referencedIn.SakitDanPulangCollection}`
      );
    }
    if (p.hasConflicts) {
      console.log(`  conflicts:`, JSON.stringify(p.conflicts, null, 2).replace(/\n/g, "\n  "));
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(plan, null, 2));
  console.log(`\nFull plan (all ${plan.length} clusters, including clean ones) written to:\n${OUTPUT_PATH}`);
  console.log("\nNo Firestore writes were made. This is a dry run only.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
