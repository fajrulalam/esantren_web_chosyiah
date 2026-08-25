// Read-only script: scans SantriCollection and reports likely duplicate records.
// Usage: node scripts/find-duplicate-santri.mjs
//
// Firestore rules allow open read on SantriCollection, so this uses the same
// public client config as the app (no service account / admin SDK needed).

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrdjIPSIhnQjZuiQ1DsRNFUngs0vXIF_4",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:27b8ab5724915905d47720",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(phone) {
  return (phone || "").toString().replace(/\D/g, "");
}

function groupBy(docs, keyFn) {
  const map = new Map();
  for (const d of docs) {
    const key = keyFn(d);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return map;
}

function printCluster(label, docs) {
  console.log(`  [${label}]`);
  for (const d of docs) {
    console.log(
      `    id=${d.id} | nama="${d.data.nama}" | wali=${d.data.nomorWalisantri || "-"} | email=${d.data.email || "-"} | tahunMasuk=${d.data.tahunMasuk || "-"} | statusAktif=${d.data.statusAktif || "-"}`
    );
  }
}

async function main() {
  console.log("Fetching SantriCollection...");
  const snap = await getDocs(collection(db, "SantriCollection"));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`Total documents: ${docs.length}\n`);

  // Cluster 1: normalized name + parent phone (strongest signal)
  const byNameWali = groupBy(docs, (d) => {
    const n = normalizeName(d.data.nama);
    const w = normalizePhone(d.data.nomorWalisantri);
    if (!n || !w) return null;
    return `${n}|${w}`;
  });

  // Cluster 2: normalized name + email
  const byNameEmail = groupBy(docs, (d) => {
    const n = normalizeName(d.data.nama);
    const e = (d.data.email || "").toString().trim().toLowerCase();
    if (!n || !e) return null;
    return `${n}|${e}`;
  });

  // Cluster 3: exact normalized name only (weaker signal, flagged separately)
  const byNameOnly = groupBy(docs, (d) => normalizeName(d.data.nama) || null);

  const dupNameWali = [...byNameWali.entries()].filter(([, v]) => v.length > 1);
  const dupNameEmail = [...byNameEmail.entries()].filter(([, v]) => v.length > 1);
  const dupNameOnly = [...byNameOnly.entries()].filter(([, v]) => v.length > 1);

  console.log("=== Duplicates by name + parent phone (nomorWalisantri) ===");
  console.log(`${dupNameWali.length} cluster(s) found`);
  for (const [key, v] of dupNameWali) printCluster(key, v);

  console.log("\n=== Duplicates by name + email ===");
  console.log(`${dupNameEmail.length} cluster(s) found`);
  for (const [key, v] of dupNameEmail) printCluster(key, v);

  console.log("\n=== Same name only (weaker signal — could be different people) ===");
  console.log(`${dupNameOnly.length} cluster(s) found`);
  for (const [key, v] of dupNameOnly) printCluster(key, v);

  const strongDupIds = new Set();
  for (const [, v] of dupNameWali) v.forEach((d) => strongDupIds.add(d.id));
  for (const [, v] of dupNameEmail) v.forEach((d) => strongDupIds.add(d.id));

  console.log("\n=== Summary ===");
  console.log(`Total documents: ${docs.length}`);
  console.log(`Documents involved in a strong-signal duplicate cluster (name+phone or name+email): ${strongDupIds.size}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
