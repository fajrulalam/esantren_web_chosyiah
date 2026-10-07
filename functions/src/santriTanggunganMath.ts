// Pure rules for a santri's tanggungan (balance) fields. Kept free of imports so
// the tests and scripts/reconcile-santri-tanggungan.mjs can load it directly.

export type StatusTanggungan =
  | "Lunas"
  | "Belum Lunas"
  | "Belum Ada Tagihan"
  | "Menunggu Verifikasi";

export interface PaymentStatusSummaryInput {
  paid?: unknown;
  total?: unknown;
  status?: unknown;
  pendingAmount?: unknown;
  requiresAmountConfirmation?: unknown;
}

export interface SantriTanggungan {
  jumlahTunggakan: number;
  statusTanggungan: StatusTanggungan;
}

/**
 * Derives jumlahTunggakan and statusTanggungan from every PaymentStatuses record
 * of one santri. This is the single source of truth: both fields are caches of
 * the payment records and must never be adjusted with +1 / -1 counters.
 */
export const deriveSantriTanggungan = (
  payments: PaymentStatusSummaryInput[]
): SantriTanggungan => {
  if (payments.length === 0) {
    return { jumlahTunggakan: 0, statusTanggungan: "Belum Ada Tagihan" };
  }

  let jumlahTunggakan = 0;
  let hasPending = false;
  for (const payment of payments) {
    if (Number(payment.paid || 0) !== Number(payment.total || 0)) {
      jumlahTunggakan += 1;
    }
    if (
      payment.status === "Menunggu Verifikasi" ||
      Number(payment.pendingAmount || 0) > 0 ||
      payment.requiresAmountConfirmation
    ) {
      hasPending = true;
    }
  }

  return {
    jumlahTunggakan,
    statusTanggungan: hasPending
      ? "Menunggu Verifikasi"
      : jumlahTunggakan > 0
      ? "Belum Lunas"
      : "Lunas",
  };
};
