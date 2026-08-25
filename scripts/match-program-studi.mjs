// DRY RUN ONLY — reads current programStudi values from SantriCollection and
// proposes a match against the university's official program studi list.
// Makes NO writes. Outputs a review file for a human to confirm/correct
// before any update script runs.
//
// Usage: node scripts/match-program-studi.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { writeFileSync } from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyBrdjIPSIhnQjZuiQ1DsRNFUngs0vXIF_4",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:27b8ab5724915905d47720",
};

const OUTPUT_PATH = "/Users/ghinannavsih/Documents/e-santren/scripts/output/program-studi-match.json";

// Official list, transcribed from the user-provided screenshot.
// "gelar" (degree title) is kept for reference only — matching ignores it.
const VALID_PROGRAM_STUDI = [
  { nama: "S1 Pendidikan Agama Islam", gelar: "S.Pd", fakultas: "Fakultas Agama Islam" },
  { nama: "S1 Studi Hukum Keluarga", gelar: "S.H", fakultas: "Fakultas Agama Islam" },
  { nama: "S1 Pendidikan Guru MI", gelar: "S.Pd.I", fakultas: "Fakultas Agama Islam" },
  { nama: "S1 Ilmu Keperawatan", gelar: "S.Kep", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "S1 Kebidanan", gelar: "S.Keb", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "Profesi Ners", gelar: "Ners", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "Profesi Bidan", gelar: "Bid", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "S1 Administrasi Bisnis", gelar: "S.AB", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Sastra Inggris Bisnis", gelar: "S.S", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Pendidikan Bahasa Inggris", gelar: "S.Pd", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Pendidikan Matematika", gelar: "S.Pd", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Sistem Informasi", gelar: "S.Kom", fakultas: "Fakultas Sains & Teknologi" },
  { nama: "S1 Matematika", gelar: "S.Mat", fakultas: "Fakultas Sains & Teknologi" },
  { nama: "S2 Manajemen Pendidikan Islam", gelar: "M.Pd", fakultas: "Program Pascasarjana" },
  { nama: "S2 Kesehatan Masyarakat", gelar: "M.Kes", fakultas: "Program Pascasarjana" },
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Values seen in real data that are NOT program studi at all (education level
// mistakenly stored in this field, or dummy/test entries). These get flagged
// as NOT_APPLICABLE rather than force-matched to whatever scores highest.
const BLACKLIST = new Set(["sltp", "slta", "test"]);

// Known abbreviations seen in real data that word-overlap scoring can't catch
// on its own (e.g. "pgmi" is one token, "pendidikan guru mi" is three).
const SYNONYMS = {
  "pgmi": "S1 Pendidikan Guru MI",
  "pg mi": "S1 Pendidikan Guru MI",
  "pai": "S1 Pendidikan Agama Islam",
  "si": "S1 Sistem Informasi",
};

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[()]/g, " ") // unwrap parens but KEEP their contents as words —
    // input like "Fakultas saintek (sistem informasi)" carries a real hint
    // in the parens, unlike the target list's parenthetical degree titles
    // (which are stored separately in `gelar` and never enter this function).
    .replace(/[^a-z0-9\s]/g, " ") // strip remaining punctuation
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w !== "s1" && w !== "s2") // level prefix carries no disambiguating info here
    .join(" ");
}

function wordSet(str) {
  return new Set(normalize(str).split(" ").filter(Boolean));
}

function jaccard(aWords, bWords) {
  const intersection = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  if (union === 0) return 0;
  return intersection / union;
}

const validNormalized = VALID_PROGRAM_STUDI.map((v) => ({
  ...v,
  normalized: normalize(v.nama),
  words: wordSet(v.nama),
}));

function bestMatch(rawValue) {
  const inputNorm = normalize(rawValue);

  if (BLACKLIST.has(inputNorm)) {
    return {
      best: { target: null, gelar: null, fakultas: null, score: 0 },
      second: null,
      confidence: "NOT_APPLICABLE",
      note: "Not a program studi value — looks like a Jenjang Pendidikan value (e.g. SLTP/SLTA) or test/dummy data entered into this field by mistake.",
    };
  }

  if (SYNONYMS[inputNorm]) {
    const target = validNormalized.find((v) => v.nama === SYNONYMS[inputNorm]);
    return {
      best: { target: target.nama, gelar: target.gelar, fakultas: target.fakultas, score: 1 },
      second: null,
      confidence: "ABBREV",
      note: `Recognized abbreviation for "${target.nama}".`,
    };
  }

  const inputWords = wordSet(rawValue);
  const scored = validNormalized
    .map((v) => ({
      target: v.nama,
      gelar: v.gelar,
      fakultas: v.fakultas,
      score: jaccard(inputWords, v.words),
      exact: inputNorm === v.normalized,
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  if (best.score === 0) {
    return {
      best: { target: null, gelar: null, fakultas: null, score: 0 },
      second: null,
      confidence: "NO_MATCH",
      note: "No keyword overlap with any program in the valid list — this program may not exist in the list, or may need a human's domain knowledge to place.",
    };
  }

  let confidence;
  if (best.exact) {
    confidence = "EXACT";
  } else if (best.score >= 0.5 && best.score - (second?.score || 0) >= 0.15) {
    confidence = "HIGH";
  } else if (best.score >= 0.3) {
    confidence = "MEDIUM";
  } else {
    confidence = "LOW";
  }

  return { best, second, confidence, allScores: scored };
}

async function main() {
  console.log("Fetching SantriCollection...");
  const snap = await getDocs(collection(db, "SantriCollection"));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  console.log(`Total documents: ${docs.length}`);

  // Group by raw programStudi value (trimmed), count affected santri + collect ids/names
  const groups = new Map();
  let emptyCount = 0;
  for (const d of docs) {
    const raw = (d.data.programStudi || "").toString().trim();
    if (!raw) {
      emptyCount++;
      continue;
    }
    if (!groups.has(raw)) groups.set(raw, []);
    groups.get(raw).push({ id: d.id, nama: d.data.nama, statusAktif: d.data.statusAktif });
  }

  console.log(`Distinct non-empty programStudi values: ${groups.size}`);
  console.log(`Santri with empty/no programStudi (skipped): ${emptyCount}\n`);

  const results = [...groups.entries()]
    .map(([raw, santriList]) => {
      const match = bestMatch(raw);
      return {
        currentValue: raw,
        affectedCount: santriList.length,
        affectedSantri: santriList,
        proposedMatch: match.best.target,
        proposedGelar: match.best.gelar,
        proposedFakultas: match.best.fakultas,
        confidence: match.confidence,
        score: Number(match.best.score.toFixed(2)),
        note: match.note || null,
        secondBest: match.second
          ? { target: match.second.target, score: Number(match.second.score.toFixed(2)) }
          : null,
      };
    })
    .sort((a, b) => {
      const order = { NOT_APPLICABLE: 0, NO_MATCH: 1, LOW: 2, MEDIUM: 3, HIGH: 4, ABBREV: 5, EXACT: 6 };
      return order[a.confidence] - order[b.confidence] || b.affectedCount - a.affectedCount;
    });

  writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), emptyCount, results }, null, 2));

  console.log("=== Proposed matches (sorted: lowest confidence first) ===\n");
  for (const r of results) {
    const arrow = r.proposedMatch ? `-> "${r.proposedMatch}"` : "-> (no proposal)";
    console.log(
      `[${r.confidence.padEnd(14)}] (${String(r.affectedCount).padStart(3)} santri) "${r.currentValue}" ${arrow}` +
        (r.score ? ` (score ${r.score})` : "") +
        (r.confidence === "MEDIUM" || r.confidence === "LOW"
          ? r.secondBest ? `  [2nd: "${r.secondBest.target}" @ ${r.secondBest.score}]` : ""
          : "") +
        (r.note ? `\n           note: ${r.note}` : "")
    );
  }

  const counts = results.reduce((acc, r) => { acc[r.confidence] = (acc[r.confidence] || 0) + 1; return acc; }, {});
  console.log("\n=== Summary ===");
  console.log(`Distinct values: ${results.length}`, counts);
  console.log(`Total santri affected: ${results.reduce((n, r) => n + r.affectedCount, 0)}`);
  console.log(`Santri with empty programStudi (untouched either way): ${emptyCount}`);
  console.log(`\nFull report written to:\n${OUTPUT_PATH}`);
  console.log("No Firestore writes were made. This is a dry run only.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
