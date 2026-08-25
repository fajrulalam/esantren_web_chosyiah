// Global application constants

// Kode Asrama yang digunakan dalam aplikasi
export const KODE_ASRAMA = "DU11_ChosyiahJadid";
// export const KODE_ASRAMA = "DU10_HurunInn";

// Daftar resmi program studi universitas, dikelompokkan per fakultas.
// Ini adalah sumber acuan tunggal untuk nilai `programStudi` pada SantriCollection.
export interface ProgramStudiOption {
  nama: string;
  gelar: string;
  fakultas: string;
}

export const PROGRAM_STUDI_LIST: ProgramStudiOption[] = [
  { nama: "S1 Pendidikan Agama Islam", gelar: "S.Pd", fakultas: "Fakultas Agama Islam" },
  { nama: "S1 Studi Hukum Keluarga", gelar: "S.H", fakultas: "Fakultas Agama Islam" },
  { nama: "S1 Pendidikan Guru MI", gelar: "S.Pd.I", fakultas: "Fakultas Agama Islam" },
  { nama: "S1 Ilmu Keperawatan", gelar: "S.Kep", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "S1 Kebidanan", gelar: "S.Keb", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "Profesi Ners", gelar: "Ners", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "Profesi Bidan", gelar: "Bid", fakultas: "Fakultas Ilmu Kesehatan" },
  { nama: "S1 Administrasi Bisnis", gelar: "S.AB", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Sastra Inggris Bisnis", gelar: "S.S", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Pendidikan Bahasa Inggris", gelar: "S.Pd", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Pendidikan Matematika", gelar: "S.Pd", fakultas: "Fakultas Bisnis, Bahasa & Pendidikan" },
  { nama: "S1 Sistem Informasi", gelar: "S.Kom", fakultas: "Fakultas Sains & Teknologi" },
  { nama: "S1 Matematika", gelar: "S.Mat", fakultas: "Fakultas Sains & Teknologi" },
  { nama: "S2 Manajemen Pendidikan Islam", gelar: "M.Pd", fakultas: "Program Pascasarjana" },
  { nama: "S2 Kesehatan Masyarakat", gelar: "M.Kes", fakultas: "Program Pascasarjana" },
];

// Tambahkan konstanta global lainnya di sini
