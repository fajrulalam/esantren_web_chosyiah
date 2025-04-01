import { read, utils } from 'xlsx';
import { SantriFormData } from '@/types/santri';

interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  data: SantriFormData[];
}

// Required field validators
const validators = {
  kodeAsrama: (value: string) => typeof value === 'string' && value.trim() !== '',
  nama: (value: string) => typeof value === 'string' && value.trim() !== '',
  nomorWalisantri: () => true, // Accept any value for phone number, including empty
  nomorTelpon: () => true, // Accept any value for phone number, including empty
  statusAktif: (value: string) => typeof value === 'string' && ['Aktif', 'Boyong', 'Lulus', 'Dikeluarkan', 'Alumni'].includes(value),
  tanggalLahir: () => true, // Accept any value for tanggalLahir, including empty
};

// Format date string from Excel (could be in various formats) to dd/mm/yyyy
const formatDateString = (dateValue: string | number): string => {
  try {
    // If it's already in dd/mm/yyyy format, return it
    if (typeof dateValue === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
      return dateValue;
    }
    
    // If it's in yyyy-mm-dd format
    if (typeof dateValue === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateValue)) {
      const [year, month, day] = dateValue.split('-');
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    
    // Try to parse as a date (handles Excel date numbers)
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    // If all else fails, return the original value
    return dateValue.toString();
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateValue.toString();
  }
};

// Format phone number to ensure it has proper country code
const formatPhoneNumber = (phone: string | number): string => {
  if (!phone) return '';
  
  // Ensure phone is a string
  const phoneStr = phone.toString();
  
  // Remove any non-digit characters
  const digits = phoneStr.replace(/\D/g, '');
  
  // If phone starts with country code (62), add + symbol
  if (digits.startsWith('62')) {
    return '+' + digits;
  }
  
  // If phone starts with 0, replace it with +62
  if (digits.startsWith('0')) {
    return '+62' + digits.substring(1);
  }
  
  // For Indonesian numbers that start with 8 (no leading 0), add +62
  if (digits.startsWith('8') && digits.length >= 9) {
    return '+62' + digits;
  }
  
  // Otherwise, add +62 prefix as fallback
  return '+62' + digits;
};

// Process CSV file and validate data
export const processCSVFile = async (file: File): Promise<CSVValidationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = utils.sheet_to_json(worksheet);
        
        const errors: string[] = [];
        const sanitizedData: SantriFormData[] = [];
        
        // Validate headers (check required fields)
        const headers = Object.keys(jsonData[0] || {});
        const requiredFields = ['kodeAsrama', 'nama', 'statusAktif'];
        // nomorWalisantri and tanggalLahir are no longer required
        
        const missingFields = requiredFields.filter(field => !headers.includes(field));
        if (missingFields.length > 0) {
          errors.push(`Header wajib tidak ditemukan: ${missingFields.join(', ')}`);
          return resolve({
            isValid: false,
            errors,
            data: []
          });
        }
        
        // Process and validate each row
        jsonData.forEach((row: any, index: number) => {
          const rowErrors: string[] = [];
          
          // Check required fields
          requiredFields.forEach(field => {
            if (!row[field] || !validators[field as keyof typeof validators](row[field])) {
              rowErrors.push(`Baris ${index + 1}: Field ${field} tidak valid atau kosong`);
            }
          });
          
          // Check if nomorTelpon field exists
          if (!row.nomorTelpon) {
            rowErrors.push(`Baris ${index + 1}: Field nomorTelpon wajib diisi`);
          }
          
          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            return;
          }
          
          // Prepare a base santri data object with required fields
          const santriData: any = {
            nama: row.nama?.toString().trim() || '',
            kamar: row.kamar?.toString().trim() || '',
            kelas: row.kelas?.toString().trim() || '',
            tahunMasuk: row.tahunMasuk?.toString().trim() || new Date().getFullYear().toString(),
            nomorWalisantri: row.nomorWalisantri ? formatPhoneNumber(row.nomorWalisantri) : '',
            nomorTelpon: row.nomorTelpon ? formatPhoneNumber(row.nomorTelpon) : '',
            jenjangPendidikan: 
              ['SD', 'SLTP', 'SLTA','Perguruan Tinggi'].includes(row.jenjangPendidikan)
                ? row.jenjangPendidikan
                : 'Perguruan Tinggi',
            statusAktif: 
              ['Aktif', 'Boyong', 'Lulus', 'Dikeluarkan', 'Alumni'].includes(row.statusAktif)
                ? row.statusAktif
                : 'Aktif',
            tanggalLahir: row.tanggalLahir ? formatDateString(row.tanggalLahir) : '',
          };
          
          // Process additional columns (no filtering or validation)
          Object.keys(row).forEach(key => {
            // If the key is not already in the santriData and is not part of the base form fields
            if (!santriData.hasOwnProperty(key) && 
                !['nama', 'kamar', 'kelas', 'tahunMasuk', 'nomorWalisantri', 'nomorTelpon',
                  'jenjangPendidikan', 'statusAktif', 'tanggalLahir', 'kodeAsrama'].includes(key)) {
              // Add the additional field as a string
              santriData[key] = row[key]?.toString() || '';
            }
          });
          
          sanitizedData.push(santriData);
        });
        
        resolve({
          isValid: errors.length === 0,
          errors,
          data: sanitizedData
        });
      } catch (error) {
        console.error("Error processing CSV file:", error);
        resolve({
          isValid: false,
          errors: ['Format file tidak valid. Pastikan file adalah CSV atau Excel yang valid.'],
          data: []
        });
      }
    };
    
    reader.onerror = () => {
      resolve({
        isValid: false,
        errors: ['Gagal membaca file. Silakan coba lagi.'],
        data: []
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
};