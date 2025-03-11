"use client";

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { KODE_ASRAMA } from '@/constants';
import { collection, getDocs, query, where, getDoc, doc, updateDoc, arrayUnion, serverTimestamp, deleteDoc, writeBatch, arrayRemove, increment } from 'firebase/firestore';
import { db, functions } from '@/firebase/config';
import { httpsCallable, getFunctions } from 'firebase/functions';
import app from '@/firebase/config';

interface SantriPaymentStatus {
  id: string;
  nama: string;
  status: string;
  paid: number;
  educationLevel: string;
  educationGrade: string;
  kamar: string;
  santriId: string;
  nomorWaliSantri?: string;
  total: number;
  history?: any;
}

interface SantriPaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
  paymentName: string;
}

interface PaymentProof {
  amount: number;
  timestamp: any;
  imageUrl: string;
  paymentMethod: string;
  status: string;
  type: string;
  inputtedBy: string;
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
  
  // State for modals
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [showRevokeStatusModal, setShowRevokeStatusModal] = useState(false);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SantriPaymentStatus | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonType, setRejectReasonType] = useState('');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReasonType, setRevokeReasonType] = useState('');
  const [customRevokeReason, setCustomRevokeReason] = useState('');
  
  // Predefined reasons for rejecting or revoking payments
  const predefinedReasons = [
    'Gambar kurang jelas (blur/pecah)',
    'Tidak ada pembayaran masuk',
    'Informasi pada gambar kurang lengkap',
    'Lainnya'
  ];
  
  // Function to fetch actual payment proof from the payment history
  const getPaymentProofFromHistory = (payment: SantriPaymentStatus | null): PaymentProof => {
    if (!payment || !payment.history) {
      // Return dummy proof if no payment data is available
      return {
        amount: 500000,
        timestamp: { seconds: Date.now() / 1000 },
        imageUrl: 'https://via.placeholder.com/800x600',
        paymentMethod: 'Transfer Bank',
        status: 'Menunggu Verifikasi',
        type: 'Pembayaran Penuh',
        inputtedBy: 'Wali Santri'
      };
    }
    
    // Try to find the latest payment submission in history
    const historyEntries = Object.values(payment.history);
    const latestPayment = historyEntries
      .filter(entry => entry.type === 'Bayar Lunas' || entry.type === 'Bayar Sebagian')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
    if (latestPayment) {
      return {
        amount: latestPayment.amount || payment.total,
        timestamp: { seconds: new Date(latestPayment.date).getTime() / 1000 },
        imageUrl: latestPayment.imageUrl || 'https://via.placeholder.com/800x600',
        paymentMethod: latestPayment.paymentMethod || 'Transfer Bank',
        status: 'Menunggu Verifikasi',
        type: latestPayment.type || 'Pembayaran Penuh',
        inputtedBy: latestPayment.inputtedBy || 'Wali Santri'
      };
    }
    
    // Return dummy proof if no history entries found
    return {
      amount: payment.total,
      timestamp: { seconds: Date.now() / 1000 },
      imageUrl: 'https://via.placeholder.com/800x600',
      paymentMethod: 'Transfer Bank',
      status: 'Menunggu Verifikasi',
      type: 'Pembayaran Penuh',
      inputtedBy: 'Wali Santri'
    };
  };

  // Delete invoice function
  const deleteInvoice = async () => {
    if (!paymentId) return;
    
    if (!confirm('Apakah Anda yakin ingin menghapus tagihan ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Use the already configured functions from the config file
      // No need to create a new instance with region - it's already set in config.ts
      
      // Use the httpsCallable method which handles CORS automatically
      const deleteInvoiceFunction = httpsCallable(functions, 'deleteInvoiceFunction');
      
      // Call the function with the correct payload
      const result = await deleteInvoiceFunction({ invoiceId: paymentId });
      console.log("Delete result:", result);
      
      alert('Tagihan berhasil dihapus');
      onClose();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert('Gagal menghapus tagihan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch santri payment statuses
  useEffect(() => {
    const fetchSantriPaymentStatus = async () => {
      if (!isOpen || !paymentId) return;

      setLoading(true);
      try {
        // First, try to get the invoiceId from PembayaranLogs for backward compatibility
        const logDocRef = doc(db, `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs/${paymentId}`);
        const logDoc = await getDoc(logDocRef);
        
        let invoiceId: string | null = null;
        
        if (logDoc.exists() && logDoc.data().invoiceId) {
          // If the PembayaranLogs document has an invoiceId reference, use it
          invoiceId = logDoc.data().invoiceId;
        } else {
          // If not, assume paymentId itself might be the invoiceId
          invoiceId = paymentId;
        }
        
        // Query the PaymentStatuses collection using the invoiceId
        const paymentStatusesQuery = query(
          collection(db, 'PaymentStatuses'),
          where('invoiceId', '==', invoiceId)
        );
        
        const querySnapshot = await getDocs(paymentStatusesQuery);
        
        // If no results found in the new structure, fall back to the old structure
        if (querySnapshot.empty) {
          const oldStatusCollectionRef = collection(
            db, 
            `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs/${paymentId}/PaymentStatusEachSantri`
          );
          
          const oldQuerySnapshot = await getDocs(oldStatusCollectionRef);
          
          const payments: SantriPaymentStatus[] = [];
          oldQuerySnapshot.forEach((doc) => {
            const data = doc.data();
            payments.push({
              id: doc.id,
              nama: data.santriName || 'Tidak ada nama',
              status: data.status || 'Belum Bayar',
              paid: data.paid || 0,
              educationLevel: data.educationLevel || 'Tidak ada data',
              educationGrade: data.educationGrade || 'Tidak ada data',
              kamar: data.kamar || 'Tidak ada data',
              santriId: data.santriId || '',
              nomorWaliSantri: data.nomorWaliSantri || '',
              total: data.total || 0,
              history: data.history || {}
            });
          });
          
          setSantriPayments(payments);
          setFilteredPayments(payments);
        } else {
          // Process results from the new PaymentStatuses collection
          const payments: SantriPaymentStatus[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            payments.push({
              id: doc.id,
              nama: data.santriName || 'Tidak ada nama',
              status: data.status || 'Belum Lunas',
              paid: data.paid || 0,
              educationLevel: data.educationLevel || 'Tidak ada data',
              educationGrade: data.educationGrade || 'Tidak ada data',
              kamar: data.kamar || 'Tidak ada data',
              santriId: data.santriId || '',
              nomorWaliSantri: data.nomorWaliSantri || '',
              total: data.total || 0,
              history: data.history || {}
            });
          });
          
          setSantriPayments(payments);
          setFilteredPayments(payments);
        }
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
  
  // Handle button click based on status
  const handleActionButtonClick = (payment: SantriPaymentStatus) => {
    setSelectedPayment(payment);
    
    if (payment.status === 'Belum Lunas') {
      // Open WhatsApp with the reminder message
      if (payment.nomorWaliSantri) {
        const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
          ? payment.nomorWaliSantri.substring(1) 
          : payment.nomorWaliSantri;
          
        const message = `Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}, dengan hormat kami mengingatkan untuk segera melakukan pembayaran ${paymentName} sebesar ${formatCurrency(payment.total - payment.paid)}. Terima kasih atas perhatian dan kerjasamanya.`;
        
        window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
      } else {
        alert('Nomor WhatsApp Wali Santri tidak tersedia');
      }
    } else if (payment.status === 'Menunggu Verifikasi') {
      // Show the payment proof verification modal
      setShowPaymentProofModal(true);
    } else if (payment.status === 'Lunas') {
      // Show the payment history modal
      setShowPaymentHistoryModal(true);
    }
  };
  
  // Handle verifying payment proof
  const handleVerifyPayment = async (approve: boolean) => {
    if (!selectedPayment) return;
    
    try {
      setLoading(true);
      
      if (!approve && !rejectReason) {
        setShowRejectReasonModal(true);
        return;
      }
      
      const paymentStatusRef = doc(db, 'PaymentStatuses', selectedPayment.id);
      
      if (approve) {
        // Approve payment
        await updateDoc(paymentStatusRef, {
          status: 'Lunas',
          history: {
            ...selectedPayment.history,
            verification: {
              timestamp: serverTimestamp(),
              action: 'Verified',
              by: 'Admin',
              date: new Date().toISOString(),
              id: `verification-${Date.now()}`,
              status: 'Terverifikasi',
              type: 'Verifikasi Pembayaran'
            }
          }
        });
        
        // Update the santri status
        const santriRef = doc(db, 'SantriCollection', selectedPayment.santriId);
        await updateDoc(santriRef, {
          statusTanggungan: 'Lunas'
        });
        
        // Update the invoice counter
        const invoiceRef = doc(db, 'Invoices', paymentId);
        await updateDoc(invoiceRef, {
          numberOfPaid: increment(1),
          numberOfWaitingVerification: increment(-1)
        });
      } else {
        // Prepare the reason text
        const finalRejectReason = rejectReasonType === 'Lainnya' ? customRejectReason : rejectReasonType;
        
        // Reject payment
        await updateDoc(paymentStatusRef, {
          status: 'Belum Lunas',
          history: {
            ...selectedPayment.history,
            rejection: {
              timestamp: serverTimestamp(),
              action: 'Rejected',
              reason: finalRejectReason,
              reasonType: rejectReasonType,
              by: 'Admin',
              date: new Date().toISOString(),
              id: `rejection-${Date.now()}`,
              status: 'Ditolak',
              type: 'Penolakan Pembayaran',
              note: finalRejectReason
            }
          }
        });
        
        // Update the invoice counter
        const invoiceRef = doc(db, 'Invoices', paymentId);
        await updateDoc(invoiceRef, {
          numberOfWaitingVerification: increment(-1)
        });
        
        // Open WhatsApp with the rejection message
        if (selectedPayment.nomorWaliSantri) {
          openWhatsAppWithRejectionMessage(selectedPayment, finalRejectReason);
        }
      }
      
      // Refresh the data
      const updatedPayments = [...santriPayments];
      const index = updatedPayments.findIndex(p => p.id === selectedPayment.id);
      
      if (index !== -1) {
        updatedPayments[index] = {
          ...updatedPayments[index],
          status: approve ? 'Lunas' : 'Belum Lunas'
        };
        
        setSantriPayments(updatedPayments);
        setFilteredPayments(
          updatedPayments.filter(payment => {
            if (filters.kamar && payment.kamar !== filters.kamar) return false;
            if (filters.educationLevel && payment.educationLevel !== filters.educationLevel) return false;
            if (filters.status && payment.status !== filters.status) return false;
            return true;
          })
        );
      }
      
      setShowPaymentProofModal(false);
      setShowRejectReasonModal(false);
      setRejectReason('');
      setRejectReasonType('');
      setCustomRejectReason('');
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Gagal memperbarui status pembayaran');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with rejection message
  const openWhatsAppWithRejectionMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;
      
    const message = `*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\nKami ingin memberitahukan bahwa bukti pembayaran untuk *${paymentName}* yang telah diupload sebelumnya *tidak dapat diverifikasi* dengan alasan: \n\n*${reason}*\n\nSilakan melakukan upload ulang bukti pembayaran atau melakukan pembayaran kembali melalui aplikasi E-Santren. Jika Anda memiliki pertanyaan, silakan hubungi admin asrama.\n\nJazakumullah khairan katsiran atas perhatiannya.`;
    
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  // Handle revoking payment status
  const handleRevokeStatus = async () => {
    if (!selectedPayment) return;
    
    try {
      setLoading(true);
      
      if (!revokeReasonType) {
        alert('Alasan pembatalan harus dipilih');
        return;
      }
      
      // Prepare the final reason text
      const finalRevokeReason = revokeReasonType === 'Lainnya' ? customRevokeReason : revokeReasonType;
      
      if (revokeReasonType === 'Lainnya' && !customRevokeReason.trim()) {
        alert('Alasan pembatalan harus diisi');
        return;
      }
      
      const paymentStatusRef = doc(db, 'PaymentStatuses', selectedPayment.id);
      
      // Revert status to Belum Lunas
      await updateDoc(paymentStatusRef, {
        status: 'Belum Lunas',
        history: {
          ...selectedPayment.history,
          revocation: {
            timestamp: serverTimestamp(),
            action: 'Revoked',
            reason: finalRevokeReason,
            reasonType: revokeReasonType,
            by: 'Admin',
            date: new Date().toISOString(),
            id: `revocation-${Date.now()}`,
            status: 'Ditolak',
            type: 'Pembatalan Status Lunas',
            note: finalRevokeReason
          }
        }
      });
      
      // Update the santri status
      const santriRef = doc(db, 'SantriCollection', selectedPayment.santriId);
      await updateDoc(santriRef, {
        statusTanggungan: 'Belum Lunas'
      });
      
      // Update the invoice counter
      const invoiceRef = doc(db, 'Invoices', paymentId);
      await updateDoc(invoiceRef, {
        numberOfPaid: increment(-1)
      });
      
      // Open WhatsApp with the revocation message
      if (selectedPayment.nomorWaliSantri) {
        openWhatsAppWithRevocationMessage(selectedPayment, finalRevokeReason);
      }
      
      // Refresh the data
      const updatedPayments = [...santriPayments];
      const index = updatedPayments.findIndex(p => p.id === selectedPayment.id);
      
      if (index !== -1) {
        updatedPayments[index] = {
          ...updatedPayments[index],
          status: 'Belum Lunas'
        };
        
        setSantriPayments(updatedPayments);
        setFilteredPayments(
          updatedPayments.filter(payment => {
            if (filters.kamar && payment.kamar !== filters.kamar) return false;
            if (filters.educationLevel && payment.educationLevel !== filters.educationLevel) return false;
            if (filters.status && payment.status !== filters.status) return false;
            return true;
          })
        );
      }
      
      setShowRevokeStatusModal(false);
      setShowPaymentHistoryModal(false);
      setRevokeReason('');
      setRevokeReasonType('');
      setCustomRevokeReason('');
    } catch (error) {
      console.error('Error revoking payment status:', error);
      alert('Gagal membatalkan status pembayaran');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with revocation message
  const openWhatsAppWithRevocationMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;
      
    const message = `*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\nKami ingin memberitahukan bahwa status pembayaran untuk *${paymentName}* yang sebelumnya telah terverifikasi, terpaksa kami *batalkan* dengan alasan: \n\n*${reason}*\n\nMohon segera menghubungi admin asrama atau melakukan pembayaran ulang melalui aplikasi E-Santren.\n\nJazakumullah khairan katsiran atas perhatiannya.`;
    
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  // Not needed anymore as we're importing the increment function from firestore
  
  // Format date from Firestore timestamp
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Tidak ada data';
    
    const date = timestamp.seconds 
      ? new Date(timestamp.seconds * 1000) 
      : new Date(timestamp);
      
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Transition show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-20" onClose={onClose}>
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Aksi
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button 
                                  onClick={() => handleActionButtonClick(payment)}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md ${
                                    payment.status === 'Lunas' 
                                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                                      : payment.status === 'Menunggu Verifikasi'
                                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                                  }`}
                                >
                                  {payment.status === 'Lunas' 
                                    ? 'Lihat Riwayat' 
                                    : payment.status === 'Menunggu Verifikasi'
                                    ? 'Verifikasi'
                                    : 'Ingatkan'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={deleteInvoice}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Hapus Tagihan
                    </button>
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
      
      {/* Payment Proof Verification Modal */}
      {showPaymentProofModal && selectedPayment && (
        <div className="fixed inset-0 z-30 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Verifikasi Bukti Pembayaran - {selectedPayment.nama}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPaymentProofModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-100 p-4 rounded-lg">
                  {selectedPayment && (
                    <>
                      {/* Use the function to get actual or fallback payment proof */}
                      {(() => {
                        const paymentProof = getPaymentProofFromHistory(selectedPayment);
                        return (
                          <>
                            <img 
                              src={paymentProof.imageUrl} 
                              alt="Bukti Pembayaran" 
                              className="w-full h-auto rounded-lg mb-4" 
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Jumlah Dibayar</p>
                                <p className="text-base font-medium">{formatCurrency(paymentProof.amount)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Tanggal Pembayaran</p>
                                <p className="text-base font-medium">{formatDate(paymentProof.timestamp)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Metode Pembayaran</p>
                                <p className="text-base font-medium">{paymentProof.paymentMethod}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Diinput Oleh</p>
                                <p className="text-base font-medium">{paymentProof.inputtedBy}</p>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => handleVerifyPayment(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyPayment(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Terima
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Reject Reason Modal */}
      {showRejectReasonModal && (
        <div className="fixed inset-0 z-40 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center bg-black bg-opacity-50">
            <div className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Alasan Penolakan
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="rejectReasonType" className="block text-sm font-medium text-gray-700 mb-1">
                    Pilih Alasan Penolakan
                  </label>
                  <select
                    id="rejectReasonType"
                    value={rejectReasonType}
                    onChange={(e) => setRejectReasonType(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="">-- Pilih Alasan --</option>
                    {predefinedReasons.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
                
                {rejectReasonType === 'Lainnya' && (
                  <div>
                    <label htmlFor="customRejectReason" className="block text-sm font-medium text-gray-700 mb-1">
                      Detail Alasan Penolakan
                    </label>
                    <textarea
                      id="customRejectReason"
                      value={customRejectReason}
                      onChange={(e) => setCustomRejectReason(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows={4}
                      placeholder="Masukkan detail alasan penolakan..."
                      required
                    />
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowRejectReasonModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!rejectReasonType) {
                        alert('Silakan pilih alasan penolakan');
                        return;
                      }
                      
                      if (rejectReasonType === 'Lainnya' && !customRejectReason.trim()) {
                        alert('Detail alasan penolakan harus diisi');
                        return;
                      }
                      
                      // Set the reason based on selection
                      setRejectReason(rejectReasonType);
                      setShowRejectReasonModal(false);
                      handleVerifyPayment(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Tolak Pembayaran
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Payment History Modal */}
      {showPaymentHistoryModal && selectedPayment && (
        <div className="fixed inset-0 z-30 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Riwayat Pembayaran - {selectedPayment.nama}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPaymentHistoryModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Display actual payment history */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="grid grid-cols-1 gap-4">
                    {selectedPayment && selectedPayment.history && Object.values(selectedPayment.history).length > 0 ? (
                      Object.values(selectedPayment.history)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((historyItem, index) => (
                          <div key={index} className="bg-white p-3 rounded-md shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-sm font-medium">{historyItem.type || 'Pembayaran'}</p>
                              <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                                historyItem.status === 'Terverifikasi' 
                                  ? 'bg-green-100 text-green-800' 
                                  : historyItem.status === 'Ditolak'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {historyItem.status || 'Terverifikasi'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {historyItem.amount && (
                                <div>
                                  <p className="text-gray-600">Jumlah</p>
                                  <p className="font-medium">{formatCurrency(historyItem.amount)}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-600">Tanggal</p>
                                <p className="font-medium">{formatDate(new Date(historyItem.date))}</p>
                              </div>
                              {historyItem.paymentMethod && (
                                <div>
                                  <p className="text-gray-600">Metode</p>
                                  <p className="font-medium">{historyItem.paymentMethod}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-600">{historyItem.action === 'Verified' ? 'Diverifikasi Oleh' : 'Ditangani Oleh'}</p>
                                <p className="font-medium">{historyItem.by || 'Admin'}</p>
                              </div>
                              
                              {/* Show note/reason for actions */}
                              {(historyItem.note || historyItem.reason) && (
                                <div className="col-span-2 mt-2 p-2 bg-gray-50 rounded">
                                  <p className="text-gray-600 text-xs font-medium">
                                    {historyItem.action === 'Rejected' || historyItem.action === 'Revoked' ? 'Alasan:' : 'Catatan:'}
                                  </p>
                                  <p className="text-sm">{historyItem.note || historyItem.reason}</p>
                                </div>
                              )}
                              
                              {/* Show payment proof if available */}
                              {historyItem.imageUrl && (
                                <div className="col-span-2 mt-2">
                                  <p className="text-gray-600 text-xs font-medium mb-1">Bukti Pembayaran:</p>
                                  <img 
                                    src={historyItem.imageUrl} 
                                    alt="Bukti Pembayaran" 
                                    className="w-full max-h-40 object-contain rounded" 
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="bg-white p-3 rounded-md shadow-sm">
                        <p className="text-center text-gray-500">Tidak ada riwayat pembayaran</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowRevokeStatusModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Batalkan Status Lunas
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentHistoryModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Revoke Status Modal */}
      {showRevokeStatusModal && (
        <div className="fixed inset-0 z-40 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center bg-black bg-opacity-50">
            <div className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Alasan Pembatalan Status Lunas
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="revokeReasonType" className="block text-sm font-medium text-gray-700 mb-1">
                    Pilih Alasan Pembatalan
                  </label>
                  <select
                    id="revokeReasonType"
                    value={revokeReasonType}
                    onChange={(e) => setRevokeReasonType(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="">-- Pilih Alasan --</option>
                    {predefinedReasons.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
                
                {revokeReasonType === 'Lainnya' && (
                  <div>
                    <label htmlFor="customRevokeReason" className="block text-sm font-medium text-gray-700 mb-1">
                      Detail Alasan Pembatalan
                    </label>
                    <textarea
                      id="customRevokeReason"
                      value={customRevokeReason}
                      onChange={(e) => setCustomRevokeReason(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows={4}
                      placeholder="Masukkan detail alasan pembatalan..."
                      required
                    />
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowRevokeStatusModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!revokeReasonType) {
                        alert('Silakan pilih alasan pembatalan');
                        return;
                      }
                      
                      if (revokeReasonType === 'Lainnya' && !customRevokeReason.trim()) {
                        alert('Detail alasan pembatalan harus diisi');
                        return;
                      }
                      
                      // Set the reason based on selection
                      setRevokeReason(revokeReasonType);
                      handleRevokeStatus();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Batalkan Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}