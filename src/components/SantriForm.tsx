"use client";

import { useState, useEffect } from 'react';
import { Santri, SantriFormData } from '@/types/santri';
import { KODE_ASRAMA } from '@/constants';
import { formatName } from '@/utils/nameFormatter';

interface SantriFormProps {
  santri?: Santri;
  onSubmit: (data: SantriFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  onDelete?: (santri: Santri) => Promise<void>;
}

export default function SantriForm({ 
  santri, 
  onSubmit, 
  onCancel,
  isSubmitting,
  onDelete
}: SantriFormProps) {
  // Split phone number into country code and number
  const splitPhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) return { countryCode: '+62', number: '' };
    
    // If phone starts with '+', extract the country code
    if (phoneNumber.startsWith('+')) {
      const countryCode = phoneNumber.slice(0, 3); // Assume +62 format
      const number = phoneNumber.slice(3);
      return { countryCode, number };
    }
    
    // If it's just a number without country code
    return { countryCode: '+62', number: phoneNumber };
  };

  const [formData, setFormData] = useState<SantriFormData>({
    nama: '',
    kamar: '',
    kelas: '',
    tahunMasuk: new Date().getFullYear().toString(),
    nomorWalisantri: '',
    jenjangPendidikan: 'SLTP',
    statusAktif: 'Aktif',
    tanggalLahir: '',
  });
  
  const [phoneCountryCode, setPhoneCountryCode] = useState('+62');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateInputValue, setDateInputValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (santri) {
      // When editing, parse the existing phone number
      const { countryCode, number } = splitPhoneNumber(santri.nomorWalisantri);
      setPhoneCountryCode(countryCode);
      setPhoneNumber(number);
      
      // Convert date format yyyy-mm-dd for the input
      let formattedDate = santri.tanggalLahir;
      if (santri.tanggalLahir && santri.tanggalLahir.includes('/')) {
        const [day, month, year] = santri.tanggalLahir.split('/');
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      setDateInputValue(formattedDate);
      
      setFormData({
        nama: santri.nama,
        kamar: santri.kamar,
        kelas: santri.kelas,
        tahunMasuk: santri.tahunMasuk,
        nomorWalisantri: santri.nomorWalisantri,
        jenjangPendidikan: santri.jenjangPendidikan,
        statusAktif: santri.statusAktif,
        tanggalLahir: santri.tanggalLahir,
      });
    }
  }, [santri]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Validate kelas (must be a number)
    if (name === 'kelas') {
      if (value && !/^\d+$/.test(value)) {
        setErrors(prev => ({ ...prev, kelas: 'Kelas harus berupa angka' }));
      } else {
        setErrors(prev => ({ ...prev, kelas: '' }));
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numbers for phone
    if (!/^\d*$/.test(value)) {
      setErrors(prev => ({ ...prev, phone: 'Nomor telepon hanya boleh berisi angka' }));
      return;
    }
    
    setErrors(prev => ({ ...prev, phone: '' }));
    setPhoneNumber(value);
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateInputValue(value);
    
    if (value) {
      // Convert from yyyy-mm-dd to dd/mm/yyyy for storage
      const date = new Date(value);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0'); 
      const year = date.getFullYear();
      
      setFormData(prev => ({
        ...prev,
        tanggalLahir: `${day}/${month}/${year}`
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        tanggalLahir: ''
      }));
    }
  };

  const formatPhoneNumber = (countryCode: string, number: string): string => {
    // Remove leading 0 if present
    const cleanNumber = number.startsWith('0') ? number.substring(1) : number;
    return `${countryCode}${cleanNumber}`;
  };

  // Using the central formatName utility function instead of a local implementation

  // Validate if name format is correct
  const validateName = (name: string): boolean => {
    // Name should start with an alphabet character
    if (!/^[A-Za-z]/.test(name)) {
      return false;
    }
    
    // Only allow letters, spaces, and periods
    if (!/^[A-Za-z\s.]+$/.test(name)) {
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors: Record<string, string> = {};
    
    if (formData.kelas && !/^\d+$/.test(formData.kelas)) {
      newErrors.kelas = 'Kelas harus berupa angka';
    }
    
    if (!phoneNumber) {
      newErrors.phone = 'Nomor telepon wajib diisi';
    }
    
    // Validate name format
    if (!validateName(formData.nama)) {
      newErrors.nama = 'Nama harus dimulai dengan huruf, dan hanya boleh mengandung huruf, spasi, dan titik';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Format phone number and update formData
    const formattedPhoneNumber = formatPhoneNumber(phoneCountryCode, phoneNumber);
    const formDataToSubmit = {
      ...formData,
      nama: formatName(formData.nama), // Use centralized formatName utility
      nomorWalisantri: formattedPhoneNumber,
      kelas: formData.kelas ? String(parseInt(formData.kelas, 10)) : '', // Save as integer string
      kodeAsrama: KODE_ASRAMA, // Ensure kodeAsrama is included
    };
    
    await onSubmit(formDataToSubmit);
  };

  // Generate years for dropdown (last 10 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nama" className="block text-sm font-medium text-gray-700">
          Nama Santri
        </label>
        <input
          type="text"
          id="nama"
          name="nama"
          value={formData.nama}
          onChange={handleChange}
          required
          placeholder=""
          className={`mt-1 block w-full rounded-md ${errors.nama ? 'border-red-300' : 'border-gray-300'} shadow-sm focus:border-blue-500 focus:ring-blue-500`}
        />
        {errors.nama && <p className="mt-1 text-sm text-red-600">{errors.nama}</p>}
        <p className="mt-1 text-xs text-gray-500">Contoh: M. Fajrul Alam Ulin Nuha</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div>
          <label htmlFor="tahunMasuk" className="block text-sm font-medium text-gray-700">
            Tahun Masuk
          </label>
          <select
              id="tahunMasuk"
              name="tahunMasuk"
              value={formData.tahunMasuk}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {years.map(year => (
                <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="kamar" className="block text-sm font-medium text-gray-700">
            Kamar
          </label>
          <input
            type="text"
            id="kamar"
            name="kamar"
            value={formData.kamar}
            onChange={handleChange}
            required
            placeholder=""
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>


      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="jenjangPendidikan" className="block text-sm font-medium text-gray-700">
            Jenjang Pendidikan
          </label>
          <select
            id="jenjangPendidikan"
            name="jenjangPendidikan"
            value={formData.jenjangPendidikan}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="SD">SD</option>
            <option value="SLTP">SLTP</option>
            <option value="SLTA">SLTA</option>
            <option value="Perguruan Tinggi">Perguruan Tinggi</option>
          </select>
        </div>

        <div>
          <label htmlFor="kelas" className="block text-sm font-medium text-gray-700">
            Kelas/Semester
          </label>
          <select
              id="kelas"
              name="kelas"
              value={formData.kelas}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Pilih Kelas</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(kelas => (
                <option key={kelas} value={kelas.toString()}>{kelas}</option>
            ))}
          </select>
        </div>


      </div>

      <div>
        <label htmlFor="nomorWalisantri" className="block text-sm font-medium text-gray-700">
          Nomor Wali Santri
        </label>
        <div className="mt-1 flex">
          <select
            value={phoneCountryCode}
            onChange={(e) => setPhoneCountryCode(e.target.value)}
            className="block rounded-l-md border-r-0 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="+62">+62</option>
            <option value="+60">+60</option>
            <option value="+65">+65</option>
          </select>
          <input
            type="text"
            id="nomorWalisantri"
            value={phoneNumber}
            onChange={handlePhoneChange}
            required
            placeholder="81234567890"
            className={`block w-full rounded-r-md ${errors.phone ? 'border-red-300' : 'border-gray-300'} shadow-sm focus:border-blue-500 focus:ring-blue-500`}
          />
        </div>
        {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
        <p className="mt-1 text-xs text-gray-500"></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tanggalLahir" className="block text-sm font-medium text-gray-700">
            Tanggal Lahir
          </label>
          <input
            type="date"
            id="tanggalLahir"
            name="tanggalLahir"
            value={dateInputValue}
            onChange={handleDateChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500"></p>
        </div>

        <div>
          <label htmlFor="statusAktif" className="block text-sm font-medium text-gray-700">
            Status Aktif
          </label>
          <select
            id="statusAktif"
            name="statusAktif"
            value={formData.statusAktif}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="Aktif">Aktif</option>
            <option value="Boyong">Boyong</option>
            <option value="Lulus">Lulus</option>
            <option value="Dikeluarkan">Dikeluarkan</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between space-x-3 pt-4">
        {santri && onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Yakin mau menghapus santri ${santri.nama}?`)) {
                onDelete(santri);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Hapus
          </button>
        )}
        
        <div className="flex space-x-3 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting || Object.values(errors).some(error => error)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          >
            {isSubmitting ? 'Menyimpan...' : santri ? 'Update Santri' : 'Tambah Santri'}
          </button>
        </div>
      </div>
    </form>
  );
}