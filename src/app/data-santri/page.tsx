"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import Link from 'next/link';
import { 
  collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Santri, SantriFormData } from '@/types/santri';
import { KODE_ASRAMA } from '@/constants';
import SantriModal from '@/components/SantriModal';
import { exportToExcel } from '@/utils/excelExport';

export default function DataSantriPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Santri data state
  const [santris, setSantris] = useState<Santri[]>([]);
  const [filteredSantris, setFilteredSantris] = useState<Santri[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters state
  const [statusAktifFilter, setStatusAktifFilter] = useState<string>('all');
  const [jenjangFilter, setJenjangFilter] = useState<string>('all');
  const [tahunMasukFilter, setTahunMasukFilter] = useState<string>('all');
  const [statusTanggunganFilter, setStatusTanggunganFilter] = useState<string>('all');
  const [kamarFilter, setKamarFilter] = useState<string>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState<Santri | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get unique values for filter dropdowns
  const uniqueTahunMasuk = [...new Set(santris.map(santri => santri.tahunMasuk))].sort((a, b) => parseInt(b) - parseInt(a));
  const uniqueKamar = [...new Set(santris.map(santri => santri.kamar))].sort();
  
  // Auth check
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'waliSantri') {
        router.push('/payment-history');
      } else {
        setIsAuthorized(true);
        fetchSantris();
      }
    }
  }, [user, loading, router]);
  
  // Fetch santri data
  const fetchSantris = async () => {
    try {
      setIsLoading(true);
      const santriRef = collection(db, "SantriCollection");
      const q = query(santriRef, where("kodeAsrama", "==", KODE_ASRAMA));
      const querySnapshot = await getDocs(q);
      
      const santriData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Santri[];
      
      setSantris(santriData);
      setFilteredSantris(santriData);
    } catch (error) {
      console.error("Error fetching santri data:", error);
      alert("Terjadi kesalahan saat mengambil data santri");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Apply filters to santri data
  useEffect(() => {
    let filtered = [...santris];
    
    if (statusAktifFilter !== 'all') {
      filtered = filtered.filter(santri => santri.statusAktif === statusAktifFilter);
    }
    
    if (jenjangFilter !== 'all') {
      filtered = filtered.filter(santri => santri.jenjangPendidikan === jenjangFilter);
    }
    
    if (tahunMasukFilter !== 'all') {
      filtered = filtered.filter(santri => santri.tahunMasuk === tahunMasukFilter);
    }
    
    if (statusTanggunganFilter !== 'all') {
      filtered = filtered.filter(santri => santri.statusTanggungan === statusTanggunganFilter);
    }
    
    if (kamarFilter !== 'all') {
      filtered = filtered.filter(santri => santri.kamar === kamarFilter);
    }
    
    setFilteredSantris(filtered);
  }, [santris, statusAktifFilter, jenjangFilter, tahunMasukFilter, statusTanggunganFilter, kamarFilter]);
  
  // Reset filters
  const resetFilters = () => {
    setStatusAktifFilter('all');
    setJenjangFilter('all');
    setTahunMasukFilter('all');
    setStatusTanggunganFilter('all');
    setKamarFilter('all');
  };
  
  // Handle adding a new santri
  const handleAddSantri = () => {
    setSelectedSantri(undefined);
    setIsModalOpen(true);
  };
  
  // Handle editing a santri
  const handleEditSantri = (santri: Santri) => {
    setSelectedSantri(santri);
    setIsModalOpen(true);
  };
  
  // Handle form submission (add or update)
  const handleSantriSubmit = async (formData: SantriFormData) => {
    try {
      setIsSubmitting(true);
      
      if (selectedSantri) {
        // Update existing santri
        const santriRef = doc(db, "SantriCollection", selectedSantri.id);
        await updateDoc(santriRef, {
          ...formData,
          kodeAsrama: KODE_ASRAMA,
        });
        
        // Update local state
        setSantris(prev => 
          prev.map(s => s.id === selectedSantri.id ? 
            { ...s, ...formData, kodeAsrama: KODE_ASRAMA } : s
          )
        );
      } else {
        // Add new santri with formatted ID
        const timestamp = Date.now();
        const docId = `${formData.nama.replace(/\s+/g, '_')}_${timestamp}`;
        
        // Create new document with custom ID
        await updateDoc(doc(db, "SantriCollection", docId), {
          ...formData,
          kodeAsrama: KODE_ASRAMA,
          statusTanggungan: "Belum Ada Tagihan"
        }).catch(async () => {
          // If doc doesn't exist, set it instead
          const docRef = doc(db, "SantriCollection", docId);
          await setDoc(docRef, {
            ...formData,
            kodeAsrama: KODE_ASRAMA,
            statusTanggungan: "Belum Ada Tagihan"
          });
        });
        
        // Get the new document
        const newSantriSnap = await getDoc(doc(db, "SantriCollection", docId));
        const newSantri = {
          id: docId,
          ...newSantriSnap.data()
        } as Santri;
        
        // Update local state
        setSantris(prev => [...prev, newSantri]);
      }
      
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving santri data:", error);
      alert("Terjadi kesalahan saat menyimpan data santri");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle delete santri
  const handleDeleteSantri = async (santri: Santri) => {
    try {
      setIsSubmitting(true);
      
      // Delete santri document
      const santriRef = doc(db, "SantriCollection", santri.id);
      await deleteDoc(santriRef);
      
      // Update local state
      setSantris(prev => prev.filter(s => s.id !== santri.id));
      
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error deleting santri:", error);
      alert("Terjadi kesalahan saat menghapus data santri");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Export to Excel
  const handleExportToExcel = () => {
    // Use filtered data for export
    exportToExcel(filteredSantris, `Data-Santri-${new Date().toISOString().split('T')[0]}`);
  };
  
  if (loading || !isAuthorized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Data Santri</h1>
        <div className="flex space-x-4">
          <button
            onClick={handleExportToExcel}
            className="bg-white text-green-600 border border-green-600 px-4 py-2 rounded-md hover:bg-green-50 transition-colors"
          >
            Export Excel
          </button>
          <button
            onClick={handleAddSantri}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Tambah Santri Baru
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Aktif
            </label>
            <select
              value={statusAktifFilter}
              onChange={(e) => setStatusAktifFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Boyong">Boyong</option>
              <option value="Lulus">Lulus</option>
              <option value="Dikeluarkan">Dikeluarkan</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jenjang Pendidikan
            </label>
            <select
              value={jenjangFilter}
              onChange={(e) => setJenjangFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">Semua Jenjang</option>
              <option value="SD">SD</option>
              <option value="SLTP">SLTP</option>
              <option value="SLTA">SLTA</option>
              <option value="Mahasiswa">Mahasiswa</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tahun Masuk
            </label>
            <select
              value={tahunMasukFilter}
              onChange={(e) => setTahunMasukFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">Semua Tahun</option>
              {uniqueTahunMasuk.map((tahun) => (
                <option key={tahun} value={tahun}>{tahun}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Tanggungan
            </label>
            <select
              value={statusTanggunganFilter}
              onChange={(e) => setStatusTanggunganFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="Lunas">Lunas</option>
              <option value="Belum Ada Tagihan">Belum Ada Tagihan</option>
              <option value="Ada Tunggakan">Belum Lunas</option>
              <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kamar
            </label>
            <select
              value={kamarFilter}
              onChange={(e) => setKamarFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">Semua Kamar</option>
              {uniqueKamar.map((kamar) => (
                <option key={kamar} value={kamar}>{kamar}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end col-span-1 md:col-span-3 lg:col-span-5">
            <button
              onClick={resetFilters}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredSantris.length === 0 ? (
          <p className="text-xl text-center text-gray-500 py-12">
            Tidak ada data santri yang ditemukan
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Santri
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kamar
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kelas
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tahun Masuk
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nomor Wali Santri
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status Tanggungan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSantris.map((santri) => (
                <tr key={santri.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {santri.nama}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {santri.kamar}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {santri.jenjangPendidikan} {santri.kelas}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {santri.tahunMasuk}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {santri.nomorWalisantri}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${santri.statusTanggungan === 'Lunas' ? 'bg-green-100 text-green-800' : 
                      santri.statusTanggungan === 'Ada Tunggakan' ? 'bg-red-100 text-red-800' : 
                      santri.statusTanggungan === 'Belum Ada Tagihan' ? 'bg-gray-100 text-gray-800' :
                      santri.statusTanggungan === 'Menunggu Verifikasi' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'}`}>
                      {santri.statusTanggungan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleEditSantri(santri)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Santri modal for add/edit */}
      <SantriModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        santri={selectedSantri}
        onSubmit={handleSantriSubmit}
        onDelete={handleDeleteSantri}
        isSubmitting={isSubmitting}
        title={selectedSantri ? 'Edit Data Santri' : 'Tambah Santri Baru'}
      />
    </div>
  );
}