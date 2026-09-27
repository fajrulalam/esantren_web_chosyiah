import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { normalizeEmail, pickSantriForEmail } from "./santriEmailMatch";

// Santri sign in with Google or an email link. This ties that Firebase account
// to the SantriCollection record with the same verified email and stores its id
// as the `santriId` custom claim, so security rules can tell which santri is
// signed in. The client calls it on first sign-in and whenever the claim is
// missing or points at a record that no longer exists.
export const linkSantriAccount = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Silakan masuk terlebih dahulu.");
  }
  const token = context.auth.token;
  const email = normalizeEmail(token.email);
  if (!email || token.email_verified !== true) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Email akun ini belum terverifikasi. Gunakan akun Google atau link email.",
    );
  }

  // Stored emails keep whatever casing and spacing was typed, which Firestore
  // can't match case-insensitively, so compare against every record's email.
  // This runs once per account, and only the two fields are fetched.
  const snapshot = await admin.firestore()
    .collection("SantriCollection")
    .select("email", "statusAktif")
    .get();
  const match = pickSantriForEmail(
    email,
    snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  );

  if ("error" in match) {
    throw match.error === "not-found"
      ? new functions.https.HttpsError(
        "not-found",
        `Email ${email} belum terdaftar pada data santri. Minta pengurus memperbarui email Anda di Data Santri.`,
      )
      : new functions.https.HttpsError(
        "failed-precondition",
        `Email ${email} dipakai oleh lebih dari satu data santri. Hubungi pengurus untuk memperbaikinya.`,
      );
  }

  const user = await admin.auth().getUser(context.auth.uid);
  await admin.auth().setCustomUserClaims(context.auth.uid, {
    ...(user.customClaims || {}),
    santriId: match.santriId,
  });
  return { santriId: match.santriId };
});
