export type InstallmentAggregateStatus =
  | "Belum Lunas"
  | "Menunggu Verifikasi"
  | "Lunas";

export const deriveInstallmentStatus = (
  paid: number,
  total: number,
  pendingAmount: number
): InstallmentAggregateStatus => {
  if (pendingAmount > 0) return "Menunggu Verifikasi";
  if (paid === total) return "Lunas";
  return "Belum Lunas";
};

export const calculateAvailableInstallmentAmount = (
  paid: number,
  total: number,
  pendingAmount: number
) => Math.max(0, total - paid - pendingAmount);

export const validateInstallmentAmount = (
  amount: number,
  availableAmount: number
) => Number.isInteger(amount) && amount > 0 && amount <= availableAmount;
