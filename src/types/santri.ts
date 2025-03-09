export interface Santri {
  id: string;
  nama: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  statusTanggungan: 'Lunas' | 'Ada Tunggakan' | 'Belum Ada Tagihan' | 'Menunggu Verifikasi';
  jenjangPendidikan: 'SD' | 'SLTP' | 'SLTA' | 'Mahasiswa';
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan';
  tanggalLahir: string;
  kodeAsrama: string;
}

export interface SantriFormData {
  nama: string;
  kamar: string;
  kelas: string;
  tahunMasuk: string;
  nomorWalisantri: string;
  jenjangPendidikan: 'SD' | 'SLTP' | 'SLTA' | 'Mahasiswa';
  statusAktif: 'Aktif' | 'Boyong' | 'Lulus' | 'Dikeluarkan';
  tanggalLahir: string;
}