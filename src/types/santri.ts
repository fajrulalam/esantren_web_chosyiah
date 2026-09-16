export interface Santri {
  id: string;
  nama: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  statusTanggungan: 'Lunas' | 'Belum Lunas' | 'Belum Ada Tagihan' | 'Menunggu Verifikasi';
  jenjangPendidikan: string;
  semester?: string;
  semesterAutoUpdatedPeriod?: string;
  programStudi?: string;
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan' | 'Pending' | 'Ditolak';
  tanggalLahir: string;
  kodeAsrama: string;
  jumlahTunggakan: number;
  nomorTelpon?: string;
  email?: string;
  tempatLahir?: string;
  namaOrangTua?: string;
  alamatRumah?: string;
  sekolahAsal?: string;
  paymentOption?: string;
  paymentProofUrl?: string;
  registrationFeeTotal?: number;
  registrationSubmittedAmount?: number;
  registrationPaymentStatusId?: string;
  registrationInitialPaymentId?: string;
  registrationActivationCounterHandled?: string;
  rejectReason?: string;
  catatan?: string;
  mergedPaymentProofs?: MergedPaymentProof[];
}

export interface MergedPaymentProof {
  nama: string;
  paymentOption?: string;
  imageUrl: string;
  mergedAt: number;
}

export interface SantriFormData {
  nama: string;
  email?: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  jenjangPendidikan: string;
  semester?: string;
  programStudi?: string;
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan' | 'Pending' | 'Ditolak';
  statusTanggungan?: 'Lunas' | 'Belum Lunas' | 'Belum Ada Tagihan' | 'Menunggu Verifikasi';
  tanggalLahir: string;
  nomorTelpon?: string;
  catatan?: string;
}

export interface PaymentHistoryItem {
  id: string;
  date: string;
  type: 'Bayar Lunas' | 'Bayar Sebagian' | 'Verifikasi Pembayaran' | 'Penolakan Pembayaran' | 'Pembatalan Status Lunas';
  amount?: number;
  status: 'Terverifikasi' | 'Menunggu Verifikasi' | 'Ditolak' | 'Dibatalkan';
  imageUrl?: string;
  note?: string;
  reason?: string;
  reasonType?: string;
  paymentMethod?: string;
  inputtedBy?: string;
  by?: string;
  action?: string;
  relatedPaymentId?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
  legacyAmountConfirmationRequired?: boolean;
}

export interface PaymentStatus {
  id: string;
  invoiceId: string;
  paymentName: string;
  santriId: string;
  nama?: string;
  santriName?: string;
  status: 'Belum Lunas' | 'Menunggu Verifikasi' | 'Lunas';
  paid: number;
  total: number;
  pendingAmount?: number;
  schemaVersion?: number;
  systemType?: 'registration_fee';
  requiresAmountConfirmation?: boolean;
  educationLevel: string;
  educationGrade: string;
  semester?: string;
  programStudi?: string;
  kamar: string;
  nomorWaliSantri: string;
  nomorTelpon?: string;
  history: Record<string, PaymentHistoryItem>;
  timestamp: number;
}
