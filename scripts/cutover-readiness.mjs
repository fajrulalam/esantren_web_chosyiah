// Read-only readiness check for the phone-login cutover (firebase-rules/CUTOVER.md).
// Prints counts only — no names, emails, or phone numbers.
// Needs `gcloud auth login` with read access to the e-santren project.
//   node scripts/cutover-readiness.mjs
import { execFileSync } from "node:child_process";

const PROJECT = "e-santren";
const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const headers = { Authorization: `Bearer ${token}`, "X-Goog-User-Project": PROJECT };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url.split("?")[0]}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function listSantri() {
  const docs = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/SantriCollection`);
    url.searchParams.set("pageSize", "300");
    for (const field of ["email", "statusAktif"]) url.searchParams.append("mask.fieldPaths", field);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const body = await getJson(url);
    docs.push(...(body.documents || []));
    pageToken = body.nextPageToken || "";
  } while (pageToken);
  return docs.map((doc) => ({
    id: doc.name.split("/").pop(),
    email: String(doc.fields?.email?.stringValue || "").trim().toLowerCase(),
    active: doc.fields?.statusAktif?.stringValue === "Aktif",
  }));
}

// Santri who have signed in with Google or an email link carry a santriId claim.
async function linkedSantriIds() {
  const linked = new Set();
  let nextPageToken = "";
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchGet`);
    url.searchParams.set("maxResults", "1000");
    if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);
    const body = await getJson(url);
    for (const user of body.users || []) {
      const claims = user.customAttributes ? JSON.parse(user.customAttributes) : {};
      if (claims.santriId) linked.add(claims.santriId);
    }
    nextPageToken = body.nextPageToken || "";
  } while (nextPageToken);
  return linked;
}

const [santri, linked] = await Promise.all([listSantri(), linkedSantriIds()]);
const active = santri.filter((s) => s.active);
const withEmail = active.filter((s) => EMAIL.test(s.email));
const emailCounts = new Map();
for (const s of withEmail) emailCounts.set(s.email, (emailCounts.get(s.email) || 0) + 1);
const shared = withEmail.filter((s) => emailCounts.get(s.email) > 1).length;
const activeLinked = active.filter((s) => linked.has(s.id)).length;
const pct = (n) => `${Math.round((n / Math.max(active.length, 1)) * 100)}%`;

console.log(`Active santri:                         ${active.length}`);
console.log(`  with a valid email on file:          ${withEmail.length} (${pct(withEmail.length)})`);
console.log(`  sharing an email with another santri: ${shared}`);
console.log(`  signed in with Google / email link:  ${activeLinked} (${pct(activeLinked)})`);
console.log(`  would be locked out at cutover:      ${active.length - activeLinked}`);
console.log(activeLinked === active.length
  ? "Ready: every active santri has linked an account."
  : "Not ready: the santri above who haven't linked would lose access at cutover.");
