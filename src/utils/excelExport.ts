import { utils, write } from 'xlsx';
import { Santri } from '@/types/santri';

export const exportToExcel = (data: Santri[], filename: string) => {
  // Create a worksheet
  const worksheet = utils.json_to_sheet(data.map(santri => ({
    'Nama Santri': santri.nama,
    'Kamar': santri.kamar,
    'Kelas': santri.kelas,
    'Tahun Masuk': santri.tahunMasuk,
    'Nomor Wali Santri': santri.nomorWalisantri,
    'Status Tanggungan': santri.statusTanggungan,
    'Jenjang Pendidikan': santri.jenjangPendidikan,
    'Status Aktif': santri.statusAktif,
    'Tanggal Lahir': santri.tanggalLahir,
  })));

  // Create a workbook
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'Data Santri');

  // Generate excel file and download
  const excelBuffer = write(workbook, { 
    bookType: 'xlsx', 
    type: 'array' 
  });
  
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  link.click();
  
  // Clean up
  URL.revokeObjectURL(url);
};