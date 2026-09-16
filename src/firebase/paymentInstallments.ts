import { httpsCallable } from "firebase/functions";
import { functions as cloudFunctions } from "./config";
import type { PaymentHistoryItem, PaymentStatus } from "@/types/santri";
import {
  calculateAvailableInstallmentAmount,
  deriveInstallmentStatus,
  validateInstallmentAmount,
} from "@/utils/paymentInstallmentMath";

export const REGISTRATION_FEE_TOTAL = 3_960_000;
export const PAYMENT_SCHEMA_VERSION = 2;
export const REGISTRATION_SYSTEM_TYPE = "registration_fee" as const;

export const getRegistrationInvoiceId = (kodeAsrama: string) =>
  `registration_fee_${kodeAsrama}`;

export const getRegistrationPaymentStatusId = (
  kodeAsrama: string,
  santriId: string
) => `${getRegistrationInvoiceId(kodeAsrama)}_${santriId}`;

export const isPaymentAttempt = (item: PaymentHistoryItem) =>
  item.type === "Bayar Lunas" || item.type === "Bayar Sebagian";

export const getPaymentAttempts = (payment: Pick<PaymentStatus, "history">) =>
  Object.values(payment.history || {})
    .filter(isPaymentAttempt)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const getPendingPaymentAttempts = (
  payment: Pick<PaymentStatus, "history" | "status" | "pendingAmount" | "schemaVersion">
) => {
  const attempts = getPaymentAttempts(payment as Pick<PaymentStatus, "history">);
  const pending = attempts.filter(
    (item) => item.status === "Menunggu Verifikasi"
  );

  // Version 1 documents left the original submission marked as pending even
  // after adding a separate verification record. Only treat those entries as
  // pending when the aggregate document itself is still waiting.
  if (!payment.schemaVersion && payment.status !== "Menunggu Verifikasi") {
    return [];
  }

  return pending;
};

export const getPendingAmount = (
  payment: Pick<
    PaymentStatus,
    "history" | "status" | "pendingAmount" | "schemaVersion"
  >
) => {
  if (Number.isFinite(payment.pendingAmount)) {
    return Math.max(0, Number(payment.pendingAmount));
  }

  return getPendingPaymentAttempts(payment).reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
};

export const derivePaymentStatus = (
  paid: number,
  total: number,
  pendingAmount: number
): PaymentStatus["status"] => {
  return deriveInstallmentStatus(paid, total, pendingAmount);
};

export const getAvailablePaymentAmount = (
  payment: Pick<
    PaymentStatus,
    "history" | "status" | "paid" | "total" | "pendingAmount" | "schemaVersion"
  >
) =>
  calculateAvailableInstallmentAmount(
    Number(payment.paid || 0),
    Number(payment.total || 0),
    getPendingAmount(payment)
  );

export const normalizePaymentStatus = <T extends PaymentStatus>(payment: T): T => {
  const paid = Math.max(0, Number(payment.paid || 0));
  const total = Math.max(0, Number(payment.total || 0));
  const pendingAmount = getPendingAmount(payment);

  return {
    ...payment,
    paid,
    total,
    pendingAmount,
    status:
      payment.requiresAmountConfirmation && payment.status === "Menunggu Verifikasi"
        ? "Menunggu Verifikasi"
        : derivePaymentStatus(paid, total, pendingAmount),
  };
};

const makeAttemptId = () =>
  `payment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export interface SubmitPaymentAttemptInput {
  paymentStatusId: string;
  amount: number;
  imageUrl: string;
  paymentMethod: string;
  inputtedBy: string;
}

export const submitPaymentAttempt = async ({
  paymentStatusId,
  amount,
  imageUrl,
  paymentMethod,
  inputtedBy,
}: SubmitPaymentAttemptInput) => {
  if (!validateInstallmentAmount(amount, Number.MAX_SAFE_INTEGER)) {
    throw new Error("Jumlah pembayaran harus lebih dari Rp0.");
  }
  const submitInstallment = httpsCallable(
    cloudFunctions,
    "submitPaymentInstallment"
  );
  const attemptId = makeAttemptId();
  const result = await submitInstallment({
    attemptId,
    paymentStatusId,
    amount,
    imageUrl,
    paymentMethod,
    inputtedBy,
  });
  return (result.data as { attemptId?: string }).attemptId || attemptId;
};

export type ReviewPaymentAction = "approve" | "reject" | "revoke";

export interface ReviewPaymentAttemptInput {
  paymentStatusId: string;
  attemptId: string;
  action: ReviewPaymentAction;
  reviewedBy: string;
  reason?: string;
  confirmedAmount?: number;
  canConfirmLegacyAmount?: boolean;
}

export const reviewPaymentAttempt = async ({
  paymentStatusId,
  attemptId,
  action,
  reviewedBy,
  reason,
  confirmedAmount,
  canConfirmLegacyAmount = false,
}: ReviewPaymentAttemptInput) => {
  const reviewInstallment = httpsCallable(
    cloudFunctions,
    "reviewPaymentInstallment"
  );
  await reviewInstallment({
    paymentStatusId,
    attemptId,
    action,
    reviewedBy,
    reason,
    confirmedAmount,
    // Retained in the payload for compatibility, but the server determines
    // Super Admin authority from the authenticated Pengurus document.
    canConfirmLegacyAmount,
  });
};
