import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Phone-login santri have no Firebase session, so while that login exists the
// santri-facing functions (and the staff HTTP endpoints the current client calls
// without a token) must still accept unauthenticated calls. Set to false at the
// phone-login cutover, together with PHONE_LOGIN_ENABLED in src/constants and
// the firebase-rules/cutover rules. See firebase-rules/CUTOVER.md.
export const ALLOW_UNAUTHENTICATED_SANTRI = true;

const STAFF_ROLES = ["pengurus", "pengasuh", "superAdmin"];

async function staffRole(uid: string): Promise<string | null> {
  const snapshot = await admin.firestore().collection("PengurusCollection").doc(uid).get();
  const role = snapshot.exists ? snapshot.data()?.role : null;
  return typeof role === "string" ? role : null;
}

async function isStaffUid(uid: string): Promise<boolean> {
  return STAFF_ROLES.includes((await staffRole(uid)) || "");
}

/** Callable guard: only signed-in staff. */
export async function requireStaff(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Silakan masuk sebagai pengurus.");
  }
  if (!(await isStaffUid(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Hanya pengurus yang dapat melakukan ini.");
  }
}

/**
 * Callable guard for santri-facing data: staff, or the santri whose account is
 * linked to `santriId`. Unauthenticated calls pass only while phone login exists.
 */
export async function requireSantriOrStaff(
  context: functions.https.CallableContext,
  santriId: string,
): Promise<void> {
  if (!context.auth) {
    if (ALLOW_UNAUTHENTICATED_SANTRI) return;
    throw new functions.https.HttpsError("unauthenticated", "Silakan masuk terlebih dahulu.");
  }
  if (context.auth.token.santriId === santriId) return;
  if (await isStaffUid(context.auth.uid)) return;
  throw new functions.https.HttpsError("permission-denied", "Anda tidak memiliki akses ke data santri ini.");
}

/**
 * HTTP guard for the staff endpoints. The updated client sends
 * `Authorization: Bearer <ID token>`; the current one sends nothing, which is
 * tolerated only while ALLOW_UNAUTHENTICATED_SANTRI is on. Returns an error
 * response to send, or null when the caller may proceed.
 */
export async function staffRequestError(
  request: functions.https.Request,
): Promise<{ status: number; body: { error: string; message: string } } | null> {
  const header = request.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return ALLOW_UNAUTHENTICATED_SANTRI
      ? null
      : { status: 401, body: { error: "unauthenticated", message: "Silakan masuk sebagai pengurus." } };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    if (await isStaffUid(decoded.uid)) return null;
  } catch {
    return { status: 401, body: { error: "unauthenticated", message: "Sesi tidak valid. Silakan masuk kembali." } };
  }
  return { status: 403, body: { error: "permission-denied", message: "Hanya pengurus yang dapat melakukan ini." } };
}
