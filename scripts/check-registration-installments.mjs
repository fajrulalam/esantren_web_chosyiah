// Read-only production reconciliation for the registration installment rollout.
// Usage: node scripts/check-registration-installments.mjs

import { deleteApp, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyBrdjIPSIhnQjZuiQ1DsRNFUngs0vXIF_4",
  authDomain: "e-santren.firebaseapp.com",
  projectId: "e-santren",
  storageBucket: "e-santren.appspot.com",
  messagingSenderId: "385003370337",
  appId: "1:385003370337:web:27b8ab5724915905d47720",
}, `registration-check-${Date.now()}`);
const db = getFirestore(app);

const pendingFromHistory = (payment) =>
  Object.values(payment.history || {})
    .filter((item) =>
      ["Bayar Lunas", "Bayar Sebagian"].includes(item.type) &&
      item.status === "Menunggu Verifikasi"
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

async function main() {
  const [santriSnapshot, paymentSnapshot, invoiceSnapshot] = await Promise.all([
    getDocs(collection(db, "SantriCollection")),
    getDocs(collection(db, "PaymentStatuses")),
    getDocs(collection(db, "Invoices")),
  ]);
  if (
    santriSnapshot.metadata.fromCache ||
    paymentSnapshot.metadata.fromCache ||
    invoiceSnapshot.metadata.fromCache
  ) {
    throw new Error("Firestore is offline; refusing to reconcile cached results.");
  }

  const santris = santriSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
  const payments = paymentSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
  const invoices = invoiceSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
  const registrationPayments = payments.filter(
    (payment) => payment.systemType === "registration_fee"
  );
  const paymentIds = new Set(registrationPayments.map((payment) => payment.id));
  const pendingMissingLink = santris.filter(
    (santri) => santri.statusAktif === "Pending" && !santri.registrationPaymentStatusId
  );
  const brokenLinks = santris.filter(
    (santri) =>
      santri.registrationPaymentStatusId &&
      !paymentIds.has(santri.registrationPaymentStatusId)
  );
  const overpaid = payments.filter((payment) => {
    const pending = Number.isFinite(payment.pendingAmount)
      ? Number(payment.pendingAmount)
      : !payment.schemaVersion && payment.status !== "Menunggu Verifikasi"
      ? 0
      : pendingFromHistory(payment);
    return Number(payment.paid || 0) + pending > Number(payment.total || 0);
  });
  const duplicateRegistrationSantri = Object.entries(
    registrationPayments.reduce((counts, payment) => {
      counts[payment.santriId] = (counts[payment.santriId] || 0) + 1;
      return counts;
    }, {})
  ).filter(([, count]) => count !== 1);
  const invoiceCounterMismatches = invoices
    .filter((invoice) => invoice.systemType === "registration_fee")
    .map((invoice) => {
      const linked = registrationPayments.filter(
        (payment) => payment.invoiceId === invoice.id
      );
      const paid = linked.filter(
        (payment) =>
          Number(payment.paid || 0) === Number(payment.total || 0) &&
          Number(payment.pendingAmount || 0) === 0
      ).length;
      const waiting = linked.filter(
        (payment) =>
          payment.status === "Menunggu Verifikasi" ||
          Number(payment.pendingAmount || 0) > 0 ||
          payment.requiresAmountConfirmation
      ).length;
      return {
        invoiceId: invoice.id,
        expected: { invoiced: linked.length, paid, waiting },
        actual: {
          invoiced: Number(invoice.numberOfSantriInvoiced || 0),
          paid: Number(invoice.numberOfPaid || 0),
          waiting: Number(invoice.numberOfWaitingVerification || 0),
        },
      };
    })
    .filter((entry) => JSON.stringify(entry.expected) !== JSON.stringify(entry.actual));

  console.log(JSON.stringify({
    santriCount: santris.length,
    paymentStatusCount: payments.length,
    registrationPaymentCount: registrationPayments.length,
    pendingMissingLink: pendingMissingLink.map((santri) => santri.id),
    brokenLinks: brokenLinks.map((santri) => santri.id),
    overpaid: overpaid.map((payment) => payment.id),
    duplicateRegistrationSantri,
    invoiceCounterMismatches,
  }, null, 2));
  await deleteApp(app);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
