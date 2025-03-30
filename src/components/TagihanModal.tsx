"use client";

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { KODE_ASRAMA } from '@/constants';
import { collection, query, where, getDocs, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { formatName } from '@/utils/nameFormatter';

interface Santri {
  id: string;
  nama: string;
  kamar: string;
  kelas: string;
  jenjangPendidikan: string;
  statusAktif: string;
  tahunMasuk: string;
}

interface TagihanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TagihanModal({
  isOpen,
  onClose,
  onSuccess
}: TagihanModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    paymentName: '',
    nominal: '',
    description: ''
  });
  
  // Santri selection states
  const [santris, setSantris] = useState<Santri[]>([]);
  const [filteredSantris, setFilteredSantris] = useState<Santri[]>([]);
  const [selectedSantriIds, setSelectedSantriIds] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isLoadingSantris, setIsLoadingSantris] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    statusAktif: 'Aktif',
    jenjangPendidikan: '',
    programStudi: '',
    semester: '',
    tahunMasuk: '',
    kamar: ''
  });
  
  // Clear states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        paymentName: '',
        nominal: '',
        description: ''
      });
      setSelectedSantriIds(new Set());
      setIsSelectAll(false);
    } else {
      // Fetch santri when modal opens
      fetchSantris();
    }
  }, [isOpen]);
  
  // Fetch all active santris
  const fetchSantris = async () => {
    setIsLoadingSantris(true);
    try {
      const santriRef = collection(db, "SantriCollection");
      const q = query(santriRef, where("kodeAsrama", "==", KODE_ASRAMA));
      const querySnapshot = await getDocs(q);
      
      const santriData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        nama: doc.data().nama || '',
        kamar: doc.data().kamar || '',
        kelas: doc.data().kelas || '',
        jenjangPendidikan: doc.data().jenjangPendidikan || '',
        statusAktif: doc.data().statusAktif || '',
        tahunMasuk: doc.data().tahunMasuk || '',
      }));
      
      setSantris(santriData);
      
      // Apply initial filter for Aktif santris
      applyFilters(santriData, filters);
    } catch (error) {
      console.error("Error fetching santri data:", error);
    } finally {
      setIsLoadingSantris(false);
    }
  };
  
  // Apply filters
  const applyFilters = (data: Santri[], currentFilters: typeof filters) => {
    let filtered = [...data];
    
    if (currentFilters.statusAktif) {
      filtered = filtered.filter(santri => santri.statusAktif === currentFilters.statusAktif);
    }
    
    if (currentFilters.jenjangPendidikan) {
      filtered = filtered.filter(santri => santri.jenjangPendidikan === currentFilters.jenjangPendidikan);
    }
    
    if (currentFilters.programStudi) {
      filtered = filtered.filter(santri => santri.programStudi === currentFilters.programStudi);
    }
    
    if (currentFilters.semester) {
      filtered = filtered.filter(santri => santri.jenjangPendidikan === currentFilters.semester);
    }
    
    if (currentFilters.tahunMasuk) {
      filtered = filtered.filter(santri => santri.tahunMasuk === currentFilters.tahunMasuk);
    }
    
    if (currentFilters.kamar) {
      filtered = filtered.filter(santri => santri.kamar === currentFilters.kamar);
    }
    
    setFilteredSantris(filtered);
    
    // Reset selection when filters change
    setSelectedSantriIds(new Set());
    setIsSelectAll(false);
  };
  
  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    applyFilters(santris, newFilters);
  };
  
  // Handle select all
  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedSantriIds(new Set());
    } else {
      const ids = new Set<string>();
      filteredSantris.forEach(santri => ids.add(santri.id));
      setSelectedSantriIds(ids);
    }
    setIsSelectAll(!isSelectAll);
  };
  
  // Handle individual selection
  const handleSelectSantri = (santriId: string) => {
    const newSelectedIds = new Set(selectedSantriIds);
    if (newSelectedIds.has(santriId)) {
      newSelectedIds.delete(santriId);
    } else {
      newSelectedIds.add(santriId);
    }
    setSelectedSantriIds(newSelectedIds);
    setIsSelectAll(newSelectedIds.size === filteredSantris.length);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if at least one santri is selected
    if (selectedSantriIds.size === 0) {
      alert("Mohon pilih minimal satu santri untuk ditagih.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Get selected santri data
      const selectedSantris = santris.filter(santri => selectedSantriIds.has(santri.id));
      
      // Format today's date for the invoice ID
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      const timestamp = Date.now(); // Current timestamp in milliseconds
      
      // Create a human-readable invoice ID
      const invoiceId = `${formattedDate}_${formData.paymentName.replace(/\s+/g, '_')}_${timestamp}`;
      
      // Create the invoice with selected santri IDs
      const invoiceDocRef = doc(db, 'Invoices', invoiceId);
      
      await setDoc(invoiceDocRef, {
        paymentName: formData.paymentName,
        nominal: parseFloat(formData.nominal),
        description: formData.description,
        kodeAsrama: KODE_ASRAMA,
        timestamp: serverTimestamp(),
        numberOfPaid: 0,
        numberOfWaitingVerification: 0,
        numberOfSantriInvoiced: selectedSantriIds.size,
        createdAt: serverTimestamp(),
        // Include the array of selected santri IDs
        selectedSantriIds: Array.from(selectedSantriIds)
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating tagihan:", error);
      alert("Gagal membuat tagihan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique filter values
  const uniqueTahunMasuk = [...new Set(santris.map(santri => santri.tahunMasuk))].sort((a, b) => parseInt(b) - parseInt(a));
  const uniqueKamar = [...new Set(santris.map(santri => santri.kamar))].sort();
  const uniqueJenjang = [...new Set(santris.map(santri => santri.jenjangPendidikan))].sort();
  const uniqueSemester = ["Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];
  const uniqueProgramStudi = [...new Set(santris.map(santri => santri.programStudi).filter(Boolean))].sort();
  
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4"
                >
                  Buat Tagihan Baru
                </Dialog.Title>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Payment form fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="paymentName" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Nama Pembayaran
                      </label>
                      <input
                        type="text"
                        id="paymentName"
                        name="paymentName"
                        value={formData.paymentName}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white dark:placeholder-gray-400"
                        placeholder="SPP Bulan Januari 2023"
                      />
                    </div>

                    <div>
                      <label htmlFor="nominal" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Nominal (Rp)
                      </label>
                      <input
                        type="number"
                        id="nominal"
                        name="nominal"
                        value={formData.nominal}
                        onChange={handleChange}
                        required
                        min="0"
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white dark:placeholder-gray-400"
                        placeholder="450000"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Deskripsi (opsional)
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white dark:placeholder-gray-400"
                      placeholder="Deskripsi tambahan tentang tagihan ini"
                    />
                  </div>
                  
                  {/* Santri selection section */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Pilih Santri untuk Ditagih</h4>
                    
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                      <div>
                        <label htmlFor="statusAktif" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Status Aktif
                        </label>
                        <select
                          id="statusAktif"
                          name="statusAktif"
                          value={filters.statusAktif}
                          onChange={handleFilterChange}
                          className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                        >
                          <option value="">Semua Status</option>
                          <option value="Aktif">Aktif</option>
                          <option value="Boyong">Boyong</option>
                          <option value="Lulus">Lulus</option>
                          <option value="Dikeluarkan">Dikeluarkan</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="jenjangPendidikan" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Jenjang Pendidikan
                        </label>
                        <select
                          id="jenjangPendidikan"
                          name="jenjangPendidikan"
                          value={filters.jenjangPendidikan}
                          onChange={handleFilterChange}
                          className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                        >
                          <option value="">Semua Jenjang</option>
                          {uniqueJenjang.map(jenjang => (
                            <option key={jenjang} value={jenjang}>{jenjang}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="semester" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Semester
                        </label>
                        <select
                          id="semester"
                          name="semester"
                          value={filters.semester}
                          onChange={handleFilterChange}
                          className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                        >
                          <option value="">Semua Semester</option>
                          {uniqueSemester.map(semester => (
                            <option key={semester} value={semester}>{semester}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="programStudi" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Program Studi
                        </label>
                        <select
                          id="programStudi"
                          name="programStudi"
                          value={filters.programStudi}
                          onChange={handleFilterChange}
                          className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                        >
                          <option value="">Semua Program Studi</option>
                          {uniqueProgramStudi.map(prodi => (
                            <option key={prodi} value={prodi}>{prodi}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="tahunMasuk" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Tahun Masuk
                        </label>
                        <select
                          id="tahunMasuk"
                          name="tahunMasuk"
                          value={filters.tahunMasuk}
                          onChange={handleFilterChange}
                          className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                        >
                          <option value="">Semua Tahun</option>
                          {uniqueTahunMasuk.map(tahun => (
                            <option key={tahun} value={tahun}>{tahun}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="kamar" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Kamar
                        </label>
                        <select
                          id="kamar"
                          name="kamar"
                          value={filters.kamar}
                          onChange={handleFilterChange}
                          className="mt-1 block w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                        >
                          <option value="">Semua Kamar</option>
                          {uniqueKamar.map(kamar => (
                            <option key={kamar} value={kamar}>{kamar}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Santri list */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                          checked={isSelectAll}
                          onChange={handleSelectAll}
                        />
                        <span className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {isSelectAll 
                            ? `Semua Terpilih (${filteredSantris.length})`
                            : selectedSantriIds.size > 0
                              ? `${selectedSantriIds.size} Terpilih dari ${filteredSantris.length}`
                              : `Pilih Semua (${filteredSantris.length})`
                          }
                        </span>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto">
                        {isLoadingSantris ? (
                          <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                          </div>
                        ) : filteredSantris.length === 0 ? (
                          <div className="py-4 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            Tidak ada santri yang sesuai dengan filter
                          </div>
                        ) : (
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              <tr>
                                <th scope="col" className="px-2 py-2"></th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Nama
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Kamar
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Jenjang Pendidikan
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Semester
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Program Studi
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Tahun Masuk
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {filteredSantris.map((santri) => (
                                <tr 
                                  key={santri.id}
                                  className={selectedSantriIds.has(santri.id) 
                                    ? "bg-blue-50 dark:bg-blue-900/30" 
                                    : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                                >
                                  <td className="px-2 py-2 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                                      checked={selectedSantriIds.has(santri.id)}
                                      onChange={() => handleSelectSantri(santri.id)}
                                    />
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">
                                    {santri.nama}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                    {santri.kamar}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                    {santri.jenjangPendidikan || "-"}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                    {santri.jenjangPendidikan || "-"}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                    {santri.programStudi || "-"}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                    {santri.tahunMasuk}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {selectedSantriIds.size > 0 
                        ? `${selectedSantriIds.size} santri akan ditagih ${formData.nominal ? `Rp ${parseInt(formData.nominal).toLocaleString('id-ID')}` : ''}`
                        : 'Pilih minimal satu santri untuk ditagih'
                      }
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || selectedSantriIds.size === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300 dark:disabled:bg-blue-800/50"
                    >
                      {isSubmitting ? 'Menyimpan...' : 'Buat Tagihan'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}