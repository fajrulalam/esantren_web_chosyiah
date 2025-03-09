"use client";

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { KODE_ASRAMA } from '@/constants';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';

interface SantriPaymentStatus {
  id: string;
  nama: string;
  status: string;
  paid: number;
  educationLevel: string;
  educationGrade: string;
  kamar: string;
}

interface SantriPaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
  paymentName: string;
}

export default function SantriPaymentStatusModal({
  isOpen,
  onClose,
  paymentId,
  paymentName
}: SantriPaymentStatusModalProps) {
  const [loading, setLoading] = useState(true);
  const [santriPayments, setSantriPayments] = useState<SantriPaymentStatus[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<SantriPaymentStatus[]>([]);
  const [filters, setFilters] = useState({
    kamar: '',
    educationLevel: '',
    status: ''
  });

  // Fetch santri payment statuses
  useEffect(() => {
    const fetchSantriPaymentStatus = async () => {
      if (!isOpen || !paymentId) return;

      setLoading(true);
      try {
        const statusCollectionRef = collection(
          db, 
          `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs/${paymentId}/PaymentStatusEachSantri`
        );
        
        const querySnapshot = await getDocs(statusCollectionRef);
        
        const payments: SantriPaymentStatus[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          payments.push({
            id: doc.id,
            nama: data.santriName || 'Tidak ada nama',
            status: data.status || 'Belum Bayar',
            paid: data.paid || 0,
            educationLevel: data.educationLevel || 'Tidak ada data',
            educationGrade: data.educationGrade || 'Tidak ada data',
            kamar: data.kamar || 'Tidak ada data'
          });
        });
        
        setSantriPayments(payments);
        setFilteredPayments(payments);
      } catch (error) {
        console.error("Error fetching santri payment status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSantriPaymentStatus();
  }, [isOpen, paymentId]);

  // Apply filters
  useEffect(() => {
    let result = santriPayments;

    if (filters.kamar) {
      result = result.filter(payment => payment.kamar === filters.kamar);
    }

    if (filters.educationLevel) {
      result = result.filter(payment => payment.educationLevel === filters.educationLevel);
    }

    if (filters.status) {
      result = result.filter(payment => payment.status === filters.status);
    }

    setFilteredPayments(result);
  }, [filters, santriPayments]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Get unique values for filters
  const uniqueKamar = [...new Set(santriPayments.map(payment => payment.kamar))];
  const uniqueEducationLevels = [...new Set(santriPayments.map(payment => payment.educationLevel))];
  const uniqueStatuses = [...new Set(santriPayments.map(payment => payment.status))];

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

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
          <div className="flex min-h-full items-start justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium text-gray-900">
                    Status Pembayaran Santri: {paymentName}
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label htmlFor="kamar" className="block text-sm font-medium text-gray-700 mb-1">
                      Filter Kamar
                    </label>
                    <select
                      id="kamar"
                      name="kamar"
                      value={filters.kamar}
                      onChange={handleFilterChange}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Semua Kamar</option>
                      {uniqueKamar.map((kamar) => (
                        <option key={kamar} value={kamar}>{kamar}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700 mb-1">
                      Filter Jenjang Pendidikan
                    </label>
                    <select
                      id="educationLevel"
                      name="educationLevel"
                      value={filters.educationLevel}
                      onChange={handleFilterChange}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Semua Jenjang</option>
                      {uniqueEducationLevels.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                      Filter Status Pembayaran
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={filters.status}
                      onChange={handleFilterChange}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Semua Status</option>
                      {uniqueStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : filteredPayments.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Tidak ada data pembayaran santri</p>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nama
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status Pembayaran
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Terbayar
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Jenjang Pendidikan
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kelas
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Kamar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPayments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {payment.nama}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                                payment.status === 'Lunas' 
                                  ? 'bg-green-100 text-green-800' 
                                  : payment.status === 'Menunggu Verifikasi'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(payment.paid)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.educationLevel}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.educationGrade}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.kamar}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}