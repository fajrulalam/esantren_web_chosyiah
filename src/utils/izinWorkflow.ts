import type { UserData } from "@/firebase/auth";
import type { IzinSakitPulang, IzinStatus, NewIzinReport } from "@/types/izinSakitPulang";

// Include unfinished legacy requests so nobody needs an approval to close them.
export const ONGOING_IZIN_STATUSES: IzinStatus[] = [
  "Proses Pulang", "Dalam Masa Sakit", "Disetujui",
  "Menunggu Persetujuan Ustadzah", "Menunggu Persetujuan Ndalem",
  "Menunggu Diperiksa Ustadzah",
];
export const HISTORY_IZIN_STATUSES: IzinStatus[] = [
  "Sudah Kembali", "Sudah Sembuh", "Ditolak", "Ditolak Ustadzah", "Ditolak Ndalem",
];

export function isIzinOngoing(izin: IzinSakitPulang): boolean {
  return ONGOING_IZIN_STATUSES.includes(izin.status) &&
    !(izin.izinType === "Pulang" && izin.sudahKembali === true);
}

export function canReportIzinCompletion(izin: IzinSakitPulang, user: UserData | null): boolean {
  return !!user && isIzinOngoing(izin) &&
    (user.role === "pengurus" || ((user.role === "waliSantri" || user.role === "bendahara") && user.santriId === izin.santriId));
}

export function izinStatusLabel(izin: IzinSakitPulang): string {
  if (izin.izinType === "Pulang" && izin.sudahKembali) return "Sudah Kembali";
  if (isIzinOngoing(izin)) {
    return izin.izinType === "Pulang" ? "Belum Lapor Kembali" : "Belum Lapor Sembuh";
  }
  return izin.status;
}

export function validateIzinReport(input: NewIzinReport): void {
  if (input.izinType === "Sakit") {
    if (!input.keluhan.trim()) throw new Error("Silakan isi keluhan terlebih dahulu.");
    return;
  }
  if (input.izinType !== "Pulang") throw new Error("Jenis izin tidak valid.");
  if (!input.alasan.trim()) throw new Error("Silakan isi alasan terlebih dahulu.");
  const departure = input.tglPulang?.toMillis();
  const planned = input.rencanaTanggalKembali?.toMillis();
  if (!Number.isFinite(departure) || !Number.isFinite(planned) || planned < departure) {
    throw new Error("Rencana tanggal kembali harus sama dengan atau setelah tanggal pulang.");
  }
  if (departure > Date.now()) {
    throw new Error("Laporkan saat mulai pulang. Tanggal pulang tidak boleh di masa depan.");
  }
}

export function validateReturnDate(izin: IzinSakitPulang, date: Date, now = Date.now()): void {
  const returned = date.getTime();
  if (!Number.isFinite(returned) || returned > now) {
    throw new Error("Tanggal kembali harus valid dan tidak boleh di masa depan.");
  }
  if (izin.izinType !== "Pulang" || returned < izin.tglPulang.toMillis()) {
    throw new Error("Tanggal kembali tidak boleh sebelum tanggal pulang.");
  }
}
