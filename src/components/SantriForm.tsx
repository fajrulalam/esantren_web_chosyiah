"use client";

import { useState, useEffect } from 'react';
import { Santri, SantriFormData } from '@/types/santri';
import { KODE_ASRAMA } from '@/constants';

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

  useEffect(() => {
    if (santri) {
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="kelas" className="block text-sm font-medium text-gray-700">
          Kelas
        </label>
        <input
          type="text"
          id="kelas"
          name="kelas"
          value={formData.kelas}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

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
        <label htmlFor="nomorWalisantri" className="block text-sm font-medium text-gray-700">
          Nomor Wali Santri
        </label>
        <input
          type="text"
          id="nomorWalisantri"
          name="nomorWalisantri"
          value={formData.nomorWalisantri}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

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
          <option value="Mahasiswa">Mahasiswa</option>
        </select>
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

      <div>
        <label htmlFor="tanggalLahir" className="block text-sm font-medium text-gray-700">
          Tanggal Lahir
        </label>
        <input
          type="date"
          id="tanggalLahir"
          name="tanggalLahir"
          value={formData.tanggalLahir}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
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
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          >
            {isSubmitting ? 'Menyimpan...' : santri ? 'Update Santri' : 'Tambah Santri'}
          </button>
        </div>
      </div>
    </form>
  );
}