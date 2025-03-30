export interface Santri {
  id: string;
  nama: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  statusTanggungan: 'Lunas' | 'Ada Tunggakan' | 'Belum Ada Tagihan' | 'Menunggu Verifikasi';
  jenjangPendidikan: string;
  semester?: string;
  programStudi?: string;
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan';
  tanggalLahir: string;
  kodeAsrama: string;
  jumlahTunggakan: number;
}

export interface SantriFormData {
  nama: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  jenjangPendidikan: string;
  semester?: string;
  programStudi?: string;
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan';
  tanggalLahir: string;
}

export interface PaymentHistoryItem {
  id: string;
  date: string;
  type: 'Bayar Lunas' | 'Bayar Sebagian' | 'Verifikasi Pembayaran' | 'Penolakan Pembayaran' | 'Pembatalan Status Lunas';
  amount?: number;
  status: 'Terverifikasi' | 'Menunggu Verifikasi' | 'Ditolak';
  imageUrl?: string;
  note?: string;
  reason?: string;
  reasonType?: string;
  paymentMethod?: string;
  inputtedBy?: string;
  by?: string;
  action?: string;
}

export interface PaymentStatus {
  id: string;
  invoiceId: string;
  paymentName: string;
  santriId: string;
  nama: string;
  status: 'Belum Lunas' | 'Menunggu Verifikasi' | 'Lunas';
  paid: number;
  total: number;
  educationLevel: string;
  educationGrade: string;
  semester?: string;
  programStudi?: string;
  kamar: string;
  nomorWaliSantri: string;
  history: Record<string, PaymentHistoryItem>;
  timestamp: number;
}