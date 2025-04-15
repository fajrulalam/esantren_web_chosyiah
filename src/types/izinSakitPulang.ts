import { Timestamp } from "firebase/firestore";

// Union type for application type
export type IzinType = "Sakit" | "Pulang";

// Status type for applications
export type IzinStatus = 
  "Menunggu Persetujuan Ustadzah" | 
  "Menunggu Diperiksa Ustadzah" | 
  "Disetujui" | 
  "Ditolak" | 
  "Menunggu Persetujuan Ndalem" | 
  "Proses Pulang" | 
  "Dalam Masa Sakit" | 
  "Sudah Kembali" | 
  "Sudah Sembuh" | 
  "Ditolak Ustadzah" | 
  "Ditolak Ndalem";

// Predefined options for alasan pulang
export const ALASAN_PULANG_OPTIONS = [
  "Acara Keluarga",
    "Izin Organisasi/Event Kampus",
  "Kerja Praktik",
  "KKN",
  "Lomba",
  "PPL",
  "Praktik Kesehatan",
    "Sakit",
  "Seminar",
  "Lainnya"
];

// Predefined options for keluhan sakit
export const KELUHAN_SAKIT_OPTIONS = [
  "Demam",
  "Flu/Batuk",
  "Sakit Kepala",
  "Sakit Perut",
  "Mual/Muntah",
  "Diare",
  "Pusing",
  "Alergi",
  "Nyeri Otot/Sendi",
  "Lainnya"
];

// Base interface for all izin applications
export interface IzinSakitPulangBase {
  id: string;
  izinType: IzinType;
  santriId: string;
  timestamp: Timestamp;
  status: IzinStatus;
  sudahDapatIzinUstadzah: boolean | null;
}

// Interface for "Izin Pulang" applications
export interface IzinPulang extends IzinSakitPulangBase {
  izinType: "Pulang";
  alasan: string;
  tglPulang: Timestamp;
  rencanaTanggalKembali: Timestamp;
  idPemberiIzin: string | null;
  pemberiIzin: string | null;
  sudahKembali: boolean | null;
  kembaliSesuaiRencana: boolean | null;
  sudahDapatIzinNdalem: boolean;
  jumlahTunggakan: number;
}

// Interface for "Izin Sakit" applications
export interface IzinSakit extends IzinSakitPulangBase {
  izinType: "Sakit";
  keluhan: string;
}

// Union type for all izin applications
export type IzinSakitPulang = IzinPulang | IzinSakit;