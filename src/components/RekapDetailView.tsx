"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { KODE_ASRAMA } from '@/constants';
import { collection, getDocs, query, where, getDoc, doc, updateDoc, arrayUnion, serverTimestamp, increment } from 'firebase/firestore';
import { db, functions } from '@/firebase/config';
import { httpsCallable } from 'firebase/functions';
import TagihanModal from '@/components/TagihanModal';
import StickyHorizontalScroll from '@/components/StickyHorizontalScroll';

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
  nomorTelpon?: string;
  total: number;
  history?: any;
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

interface RekapDetailViewProps {
  payment: {
    id: string;
    paymentName: string;
  };
  onClose: () => void;
}

export default function RekapDetailView({ payment, onClose }: RekapDetailViewProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const paymentId = payment.id;
  const paymentName = payment.paymentName;
  
  // Log clearly
  console.log("Rekapitulasi Detail Component loaded with: ", { paymentId, paymentName });
  
  const [pageLoading, setPageLoading] = useState(true);
  const [santriPayments, setSantriPayments] = useState<SantriPaymentStatus[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<SantriPaymentStatus[]>([]);
  const [filters, setFilters] = useState({
    kamar: '',
    educationGrade: '',
    status: '',
    nama: ''
  });
  
  // State for payment verification/detail view
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [showRevokeStatusModal, setShowRevokeStatusModal] = useState(false);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [showTagihanModal, setShowTagihanModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SantriPaymentStatus | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonType, setRejectReasonType] = useState('');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReasonType, setRevokeReasonType] = useState('');
  const [customRevokeReason, setCustomRevokeReason] = useState('');
  const [invoiceTotalAmount, setInvoiceTotalAmount] = useState(0);
  
  // State for invoice details
  const [invoiceDetails, setInvoiceDetails] = useState({
    nominal: 0,
    numberOfSantriInvoiced: 0,
    numberOfWaitingVerification: 0,
    numberOfPaid: 0
  });
  
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
    
    setPageLoading(true);
    
    try {
      console.log("Attempting to delete invoice with ID:", paymentId);
      
      // Call the HTTP endpoint with CORS support
      const response = await fetch('https://us-central1-e-santren.cloudfunctions.net/deleteInvoiceHttp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            invoiceId: paymentId
          }
        })
      });
      
      const result = await response.json();
      console.log("Delete result:", result);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to delete invoice');
      }
      
      alert('Tagihan berhasil dihapus');
      onClose();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert('Gagal menghapus tagihan. Silakan coba lagi.');
    } finally {
      setPageLoading(false);
    }
  };

  // Function to fetch santri payment status data
  const fetchSantriPaymentStatus = async () => {
    if (!paymentId) return;

    setPageLoading(true);
    try {
      console.log("Fetching payment status for ID:", paymentId);
        
      // First, try to get the invoiceId from PembayaranLogs for backward compatibility
      const logDocRef = doc(db, `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs/${paymentId}`);
      const logDoc = await getDoc(logDocRef);
      
      let invoiceId: string | null = null;
      
      if (logDoc.exists() && logDoc.data().invoiceId) {
        // If the PembayaranLogs document has an invoiceId reference, use it
        invoiceId = logDoc.data().invoiceId;
        console.log("Using invoiceId from PembayaranLogs:", invoiceId);
      } else {
        // If not, assume paymentId itself might be the invoiceId
        invoiceId = paymentId;
        console.log("Using paymentId as invoiceId:", invoiceId);
      }
      
      // Fetch invoice details
      const invoiceDocRef = doc(db, 'Invoices', invoiceId);
      const invoiceDoc = await getDoc(invoiceDocRef);
      
      if (invoiceDoc.exists()) {
        const invoiceData = invoiceDoc.data();
        setInvoiceDetails({
          nominal: invoiceData.nominal || 0,
          numberOfSantriInvoiced: invoiceData.numberOfSantriInvoiced || 0,
          numberOfWaitingVerification: invoiceData.numberOfWaitingVerification || 0,
          numberOfPaid: invoiceData.numberOfPaid || 0
        });
        setInvoiceTotalAmount(invoiceData.nominal || 0);
      }
      
      // Try direct Firestore document fetch first
      const directInvoiceDoc = await getDoc(doc(db, 'Invoices', invoiceId));
      if (directInvoiceDoc.exists()) {
        console.log("Invoice document exists directly");
      } else {
        console.log("Invoice document doesn't exist directly, will try query");
      }
      
      // Query the PaymentStatuses collection using the invoiceId
      const paymentStatusesQuery = query(
        collection(db, 'PaymentStatuses'),
        where('invoiceId', '==', invoiceId)
      );
      
      const querySnapshot = await getDocs(paymentStatusesQuery);
      console.log("PaymentStatuses query results count:", querySnapshot.size);
      
      // If no results found in the new structure, fall back to the old structure
      if (querySnapshot.empty) {
        console.log("Falling back to old structure");
        const oldStatusCollectionRef = collection(
          db, 
          `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs/${paymentId}/PaymentStatusEachSantri`
        );
        
        const oldQuerySnapshot = await getDocs(oldStatusCollectionRef);
        console.log("Old structure results count:", oldQuerySnapshot.size);
        
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
            nomorTelpon: data.nomorTelpon || '',
            total: data.total || 0,
            history: data.history || {}
          });
        });
        
        setSantriPayments(payments);
        setFilteredPayments(payments);
      } else {
        // Process results from the new PaymentStatuses collection
        console.log("Using new structure results");
        const payments: SantriPaymentStatus[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          payments.push({
            id: doc.id,
            nama: data.nama || data.santriName || 'Tidak ada nama',
            status: data.status || 'Belum Lunas',
            paid: data.paid || 0,
            educationLevel: data.educationLevel || 'Tidak ada data',
            educationGrade: data.educationGrade || 'Tidak ada data',
            kamar: data.kamar || 'Tidak ada data',
            santriId: data.santriId || '',
            nomorWaliSantri: data.nomorWaliSantri || '',
            nomorTelpon: data.nomorTelpon || '',
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
      setPageLoading(false);
    }
  };

  // Call fetchSantriPaymentStatus when component mounts
  useEffect(() => {
    fetchSantriPaymentStatus();
  }, [paymentId]);

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

    if (filters.nama) {
      const searchTerm = filters.nama.toLowerCase();
      result = result.filter(payment => 
        payment.nama.toLowerCase().includes(searchTerm)
      );
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
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFilters(prev => ({
      ...prev,
      nama: value
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
      if (payment.nomorTelpon) {
        const phoneNumber = payment.nomorTelpon.startsWith('+62')
          ? payment.nomorTelpon.substring(1)
          : payment.nomorTelpon;

        const message = `[PESAN OTOMATIS DARI Esantren Chosyi'ah]\n\nAssalamu'alaikum Wr. Wb. Santri Ananda ${payment.nama},\n\nmengingatkan kembali mengenai pembayaran *${paymentName}* sebesar *${formatCurrency(payment.total - payment.paid)}* yang masih belum terselesaikan. Sesaat setelah pembayaran Anda diverifikasi, Anda akan mendapatkankan kode gerbang yang telah diperbarui (kode lama akan hangus pada tanggal 1* April 2025).\n\nUnggah bukti pembayaran ke website Esantren Chosyi'ah: https://esantren-chosyiah.vercel.app/\n\nJazakumullah khairan katsiran.`
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
      setPageLoading(true);
      
      if (!approve && !rejectReason) {
        setShowRejectReasonModal(true);
        return;
      }
      
      const paymentStatusRef = doc(db, 'PaymentStatuses', selectedPayment.id);
      
      if (approve) {
        // Get current payment details
        const paymentProof = getPaymentProofFromHistory(selectedPayment);
        const paymentAmount = paymentProof.amount;
        const isPartialPaymentType = paymentProof.type.includes('Sebagian');
        
        // Calculate new paid amount (add the payment amount to current paid amount)
        const newPaidAmount = selectedPayment.paid + paymentAmount;
        
        // Approve payment and update the paid amount
        await updateDoc(paymentStatusRef, {
          status: 'Lunas',
          paid: newPaidAmount, // Update the paid amount when approving
          history: {
            ...selectedPayment.history,
            verification: {
              timestamp: serverTimestamp(),
              action: 'Verified',
              by: user?.name || 'Admin',
              date: new Date().toISOString(),
              id: `verification-${Date.now()}`,
              status: 'Terverifikasi',
              type: 'Verifikasi Pembayaran',
              amount: paymentAmount
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
        
        // Send WhatsApp confirmation message
        if (selectedPayment.nomorTelpon) {
          // Determine if it's a partial payment (paid amount is less than total)
          const isPartialPayment = selectedPayment.paid + paymentAmount < selectedPayment.total;
          
          openWhatsAppWithApprovalMessage(
            selectedPayment, 
            isPartialPayment,
            isPartialPaymentType,
            paymentAmount
          );
        }
      } else {
        // Prepare the reason text
        const finalRejectReason = rejectReasonType === 'Lainnya' ? customRejectReason : rejectReasonType;
        
        // Get the latest payment proof to identify the rejected amount
        const paymentProof = getPaymentProofFromHistory(selectedPayment);
        const rejectedAmount = paymentProof.amount;
        
        // Reject payment (don't change the paid amount since it was never updated)
        await updateDoc(paymentStatusRef, {
          status: 'Belum Lunas',
          history: {
            ...selectedPayment.history,
            rejection: {
              timestamp: serverTimestamp(),
              action: 'Rejected',
              reason: finalRejectReason,
              reasonType: rejectReasonType,
              by: user?.name || 'Admin',
              date: new Date().toISOString(),
              id: `rejection-${Date.now()}`,
              status: 'Ditolak',
              type: 'Penolakan Pembayaran',
              note: finalRejectReason,
              amount: rejectedAmount // Store the rejected amount for reference
            }
          }
        });
        
        // Update the invoice counter
        const invoiceRef = doc(db, 'Invoices', paymentId);
        await updateDoc(invoiceRef, {
          numberOfWaitingVerification: increment(-1)
        });
        
        // Open WhatsApp with the rejection message
        if (selectedPayment.nomorTelpon) {
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
      setPageLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with rejection message
  const openWhatsAppWithRejectionMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorTelpon.startsWith('+62')
      ? payment.nomorTelpon.substring(1)
      : payment.nomorTelpon;

    const message = `[Bukti Pembayaran Perlu Diunggah Ulang]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama},\n\n*Kami informasikan bahwa bukti pembayaran untuk *${paymentName}* yang sebelumnya diunggah belum dapat diverifikasi karena:\n\n*${reason}\n\n*Mohon untuk mengunggah ulang bukti pembayaran atau melakukan pembayaran kembali melalui aplikasi E-Santren. Apabila ada pertanyaan, silakan menghubungi admin asrama.\n\nJazakumullah khairan katsiran atas perhatian dan kerja samanya.`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  // Handle revoking payment status
  const handleRevokeStatus = async () => {
    if (!selectedPayment) return;
    
    try {
      setPageLoading(true);
      
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
      
      // Find the verification or payment entry to determine the amount to revert
      let amountToRevert = 0;
      
      if (selectedPayment.history) {
        // Look for the latest verification entry
        const historyEntries = Object.values(selectedPayment.history);
        const verificationEntry = historyEntries.find(entry => 
          entry.type === 'Verifikasi Pembayaran' || entry.action === 'Verified'
        );
        
        if (verificationEntry && verificationEntry.amount) {
          amountToRevert = verificationEntry.amount;
        } else {
          // If no verification entry with amount, look for the latest payment entry
          const paymentEntry = historyEntries
            .filter(entry => entry.type === 'Bayar Lunas' || entry.type === 'Bayar Sebagian')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            
          if (paymentEntry && paymentEntry.amount) {
            amountToRevert = paymentEntry.amount;
          }
        }
      }
      
      const paymentStatusRef = doc(db, 'PaymentStatuses', selectedPayment.id);
      
      // Calculate the new paid amount after reverting
      const newPaidAmount = Math.max(0, selectedPayment.paid - amountToRevert);
      
      // Revert status to Belum Lunas and update paid amount
      await updateDoc(paymentStatusRef, {
        status: 'Belum Lunas',
        paid: newPaidAmount, // Update the paid amount by subtracting the reverted amount
        history: {
          ...selectedPayment.history,
          revocation: {
            timestamp: serverTimestamp(),
            action: 'Revoked',
            reason: finalRevokeReason,
            reasonType: revokeReasonType,
            by: user?.name || 'Admin',
            date: new Date().toISOString(),
            id: `revocation-${Date.now()}`,
            status: 'Ditolak',
            type: 'Pembatalan Status Lunas',
            note: finalRevokeReason,
            amount: amountToRevert // Store the reverted amount for reference
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
      if (selectedPayment.nomorTelpon) {
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
      setPageLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with revocation message
  const openWhatsAppWithRevocationMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorTelpon.startsWith('+62')
      ? payment.nomorTelpon.substring(1)
      : payment.nomorTelpon;

    const message = `[Permintaan Unggah Ulang Bukti Pembayaran]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\nKami informasikan bahwa pembayaran untuk *${paymentName}* yang sebelumnya telah terverifikasi terpaksa kami *batalkan* karena:\n\n*${reason}*\n\nDimohon untuk segera menghubungi admin asrama atau mengulang proses pembayaran melalui aplikasi E-Santren.\n\nJazakumullah khairan katsiran atas perhatian dan kerja samanya.`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  // Helper function to open WhatsApp with approval message
  const openWhatsAppWithApprovalMessage = (
    payment: SantriPaymentStatus,
    isPartialPayment: boolean,
    isPartialPaymentType: boolean,
    amount: number
  ) => {
    const phoneNumber = payment.nomorTelpon.startsWith('+62')
      ? payment.nomorTelpon.substring(1)
      : payment.nomorTelpon;

    let message = '';
    
    if (isPartialPaymentType) {
      // Message for partial payment
      message = `[Pembayaran Sebagian Terverifikasi]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Pembayaran sebagian untuk *${paymentName}* sebesar *${formatCurrency(amount)}* telah *berhasil diverifikasi*.\n\nRincian pembayaran:\n• Jumlah dibayarkan: *${formatCurrency(amount)}*\n• Total tagihan: *${formatCurrency(payment.total)}*\n• Sisa yang harus dibayar: *${formatCurrency(payment.total - payment.paid)}*\n\nJangan lupa untuk melunasi sisa pembayaran sebelum batas waktu yang ditentukan yaa! 😊\n\nJazakumullah khairan katsiran atas pembayarannya.`;
    } else if (isPartialPayment) {
      // Message for full payment that leaves the total not fully paid yet
      message = `[Pembayaran Terverifikasi]\n\n*Assalamu'alaikum Santri Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Pembayaran untuk *${paymentName}* sebesar *${formatCurrency(amount)}* telah *berhasil diverifikasi*.\n\nRincian pembayaran saat ini:\n• Total dibayarkan: *${formatCurrency(payment.paid)}*\n• Total tagihan: *${formatCurrency(payment.total)}*\n• Sisa yang perlu dilunasi: *${formatCurrency(payment.total - payment.paid)}*\n\nMohon segera melunasi sisa pembayaran untuk menyelesaikan kewajiban ini.\n\nJazakumullah khairan katsiran atas kerjasamanya.`;
    } else {
      // Message for full payment that completes the invoice
      message = `[Pembayaran Lunas Terverifikasi]\n\n*Assalamu'alaikum Santri Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Kami sampaikan bahwa pembayaran *${paymentName}* sebesar *${formatCurrency(amount)}* telah *LUNAS dan berhasil diverifikasi*! \n\nTerimakasih atas komitmen Bapak/Ibu dalam mendukung pendidikan Ananda di pesantren kami. Semoga menjadi amal jariyah dan keberkahan bagi keluarga.\n\nJazakumullah khairan katsiran. \n\n Kode untuk masuk ke Asrama adalah 37537537# (kode ini wajib dirahasiakan)`;
    }
    
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };
  
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

  // Handle successful tagihan modal submission
  const handleTagihanSuccess = () => {
    // Refresh the data
    fetchSantriPaymentStatus();
  };

  // Prevent scroll on body when this component is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-opacity-75 bg-gray-800">
      <div className="bg-white dark:bg-gray-900 min-h-screen transition-colors">
        <div className="container mx-auto py-6 px-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <button 
                onClick={onClose}
                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Kembali
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Detail Pembayaran: {paymentName}</h1>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={deleteInvoice}
                className="relative px-5 py-2.5 rounded-xl text-white font-medium transition-all duration-200
                  bg-red-600 dark:bg-red-700
                  border border-red-500/20 dark:border-red-600/20
                  before:absolute before:inset-0 before:rounded-xl
                  before:bg-gradient-to-br before:from-red-400/80 before:to-red-600/90
                  dark:before:bg-gradient-to-br dark:before:from-red-600/50 dark:before:to-red-800/90
                  before:z-[-1] before:overflow-hidden
                  hover:translate-y-[-2px] active:translate-y-0
                  hover:before:from-red-500/80 hover:before:to-red-700/90
                  focus:outline-none focus:ring-2 focus:ring-red-500/50 dark:focus:ring-red-400/50"
              >
                Hapus Tagihan
              </button>
            </div>
          </div>

          {/* Invoice Summary with Neumorphic Design */}
          <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 transition-colors">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 transition-colors">Informasi Tagihan</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Nominal */}
              <div className="relative bg-white dark:bg-gray-700 rounded-2xl p-5 transition-all duration-200 cursor-default
                border border-gray-100 dark:border-gray-600
                before:absolute before:inset-0 before:rounded-2xl 
                before:bg-gradient-to-br before:from-gray-200/50 before:to-white/90
                dark:before:bg-gradient-to-br dark:before:from-gray-600/50 dark:before:to-gray-700/90
                before:z-[-1] before:overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="text-gray-500 dark:text-gray-300 text-sm font-medium transition-colors">Nominal Tagihan</div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{formatCurrency(invoiceDetails.nominal)}</p>
                </div>
              </div>
              
              {/* Total Santri */}
              <button 
                onClick={() => setFilters({status: '', kamar: '', educationLevel: ''})}
                className={`relative bg-white dark:bg-gray-700 rounded-2xl p-5 transition-all duration-200 cursor-pointer text-left
                  border border-gray-100 dark:border-gray-600
                  before:absolute before:inset-0 before:rounded-2xl
                  ${filters.status === '' && filters.kamar === '' && filters.educationLevel === '' 
                    ? 'before:bg-gradient-to-br before:from-indigo-100/80 before:to-white/90 dark:before:bg-gradient-to-br dark:before:from-indigo-900/30 dark:before:to-gray-700/90 transform translate-y-[-2px]' 
                    : 'before:bg-gradient-to-br before:from-gray-200/50 before:to-white/90 dark:before:bg-gradient-to-br dark:before:from-gray-600/50 dark:before:to-gray-700/90 hover:translate-y-[-2px]'}
                  before:z-[-1] before:overflow-hidden
                  active:translate-y-0`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-gray-500 dark:text-gray-300 text-sm font-medium transition-colors">Jumlah Santri Tertagih</div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{invoiceDetails.numberOfSantriInvoiced} Santri</p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-300 mt-1 transition-colors">
                    Klik untuk lihat semua
                  </p>
                </div>
              </button>
              
              {/* Menunggu Verifikasi */}
              <button 
                onClick={() => setFilters({...filters, status: 'Menunggu Verifikasi'})}
                className={`relative bg-white dark:bg-gray-700 rounded-2xl p-5 transition-all duration-200 cursor-pointer text-left
                  border border-gray-100 dark:border-gray-600
                  before:absolute before:inset-0 before:rounded-2xl
                  ${filters.status === 'Menunggu Verifikasi' 
                    ? 'before:bg-gradient-to-br before:from-yellow-100/80 before:to-white/90 dark:before:bg-gradient-to-br dark:before:from-yellow-900/30 dark:before:to-gray-700/90 transform translate-y-[-2px]' 
                    : 'before:bg-gradient-to-br before:from-gray-200/50 before:to-white/90 dark:before:bg-gradient-to-br dark:before:from-gray-600/50 dark:before:to-gray-700/90 hover:translate-y-[-2px]'}
                  before:z-[-1] before:overflow-hidden
                  active:translate-y-0`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-gray-500 dark:text-gray-300 text-sm font-medium transition-colors">Menunggu Verifikasi</div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{invoiceDetails.numberOfWaitingVerification} Santri</p>
                  <p className="text-xs text-yellow-500 dark:text-yellow-300 mt-1 transition-colors">
                    {filters.status === 'Menunggu Verifikasi' ? 'Aktif - Klik untuk reset' : 'Klik untuk filter'}
                  </p>
                </div>
              </button>
              
              {/* Sudah Lunas */}
              <button 
                onClick={() => setFilters({...filters, status: 'Lunas'})}
                className={`relative bg-white dark:bg-gray-700 rounded-2xl p-5 transition-all duration-200 cursor-pointer text-left
                  border border-gray-100 dark:border-gray-600
                  before:absolute before:inset-0 before:rounded-2xl
                  ${filters.status === 'Lunas' 
                    ? 'before:bg-gradient-to-br before:from-green-100/80 before:to-white/90 dark:before:bg-gradient-to-br dark:before:from-green-900/30 dark:before:to-gray-700/90 transform translate-y-[-2px]' 
                    : 'before:bg-gradient-to-br before:from-gray-200/50 before:to-white/90 dark:before:bg-gradient-to-br dark:before:from-gray-600/50 dark:before:to-gray-700/90 hover:translate-y-[-2px]'}
                  before:z-[-1] before:overflow-hidden
                  active:translate-y-0`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-gray-500 dark:text-gray-300 text-sm font-medium transition-colors">Sudah Lunas</div>
                  <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-gray-900 dark:text-white transition-colors">{invoiceDetails.numberOfPaid} Santri</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                      {Math.round((invoiceDetails.numberOfPaid / (invoiceDetails.numberOfSantriInvoiced || 1)) * 100)}% Selesai
                    </p>
                    <p className="text-xs text-green-500 dark:text-green-300 transition-colors">
                      {filters.status === 'Lunas' ? 'Aktif' : 'Filter'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="relative bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors">
            {/* Search */}
            <div className="mb-6">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                Cari Nama Santri
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  id="search"
                  name="nama"
                  placeholder="Cari berdasarkan nama santri..."
                  value={filters.nama}
                  onChange={handleSearchChange}
                  className="pl-10 w-full rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 
                    text-gray-700 dark:text-gray-200 shadow-neumorphic-button dark:shadow-neumorphic-button-dark 
                    focus:shadow-neumorphic-button-pressed focus:dark:shadow-neumorphic-button-pressed-dark
                    focus:border-blue-500 focus:ring-blue-500 transition-all"
                />
                {filters.nama && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, nama: '' }))}
                      className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label htmlFor="kamar" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                  Filter Kamar
                </label>
                <select
                  id="kamar"
                  name="kamar"
                  value={filters.kamar}
                  onChange={handleFilterChange}
                  className="w-full rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 
                    text-gray-700 dark:text-gray-200 shadow-neumorphic-button dark:shadow-neumorphic-button-dark 
                    focus:shadow-neumorphic-button-pressed focus:dark:shadow-neumorphic-button-pressed-dark
                    focus:border-blue-500 focus:ring-blue-500 transition-all"
                >
                  <option value="">Semua Kamar</option>
                  {uniqueKamar.map((kamar) => (
                    <option key={kamar} value={kamar}>{kamar}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                  Filter Semester
                </label>
                <select
                  id="educationLevel"
                  name="educationLevel"
                  value={filters.educationGrade}
                  onChange={handleFilterChange}
                  className="w-full rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 
                    text-gray-700 dark:text-gray-200 shadow-neumorphic-button dark:shadow-neumorphic-button-dark 
                    focus:shadow-neumorphic-button-pressed focus:dark:shadow-neumorphic-button-pressed-dark
                    focus:border-blue-500 focus:ring-blue-500 transition-all"
                >
                  <option value="">Semua Semester</option>
                  {uniqueEducationLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                  Filter Status Pembayaran
                </label>
                <select
                  id="status"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 
                    text-gray-700 dark:text-gray-200 shadow-neumorphic-button dark:shadow-neumorphic-button-dark 
                    focus:shadow-neumorphic-button-pressed focus:dark:shadow-neumorphic-button-pressed-dark
                    focus:border-blue-500 focus:ring-blue-500 transition-all"
                >
                  <option value="">Semua Status</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Active Filters */}
            {(filters.status || filters.kamar || filters.educationLevel || filters.nama) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {filters.status && (
                  <button
                    onClick={() => setFilters({ ...filters, status: '' })}
                    className="relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                      transition-all duration-200
                      bg-white dark:bg-gray-700
                      border border-blue-200 dark:border-blue-700
                      before:absolute before:inset-0 before:rounded-full
                      before:bg-gradient-to-r before:from-blue-100/80 before:to-blue-50/90
                      dark:before:bg-gradient-to-r dark:before:from-blue-900/30 dark:before:to-blue-800/10 
                      before:z-[-1] before:overflow-hidden
                      text-blue-700 dark:text-blue-300
                      hover:translate-y-[-1px] active:translate-y-0"
                  >
                    Status: {filters.status}
                    <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                {filters.kamar && (
                  <button
                    onClick={() => setFilters({ ...filters, kamar: '' })}
                    className="relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                      transition-all duration-200
                      bg-white dark:bg-gray-700
                      border border-indigo-200 dark:border-indigo-700
                      before:absolute before:inset-0 before:rounded-full
                      before:bg-gradient-to-r before:from-indigo-100/80 before:to-indigo-50/90
                      dark:before:bg-gradient-to-r dark:before:from-indigo-900/30 dark:before:to-indigo-800/10 
                      before:z-[-1] before:overflow-hidden
                      text-indigo-700 dark:text-indigo-300
                      hover:translate-y-[-1px] active:translate-y-0"
                  >
                    Kamar: {filters.kamar}
                    <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                {filters.educationLevel && (
                  <button
                    onClick={() => setFilters({ ...filters, educationLevel: '' })}
                    className="relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                      transition-all duration-200
                      bg-white dark:bg-gray-700
                      border border-green-200 dark:border-green-700
                      before:absolute before:inset-0 before:rounded-full
                      before:bg-gradient-to-r before:from-green-100/80 before:to-green-50/90
                      dark:before:bg-gradient-to-r dark:before:from-green-900/30 dark:before:to-green-800/10 
                      before:z-[-1] before:overflow-hidden
                      text-green-700 dark:text-green-300
                      hover:translate-y-[-1px] active:translate-y-0"
                  >
                    Semester: {filters.educationLevel}
                    <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                <button
                  onClick={() => setFilters({ status: '', kamar: '', educationLevel: '' })}
                  className="relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                    transition-all duration-200
                    bg-white dark:bg-gray-700
                    border border-red-200 dark:border-red-700
                    before:absolute before:inset-0 before:rounded-full
                    before:bg-gradient-to-r before:from-red-100/80 before:to-red-50/90
                    dark:before:bg-gradient-to-r dark:before:from-red-900/30 dark:before:to-red-800/10 
                    before:z-[-1] before:overflow-hidden
                    text-red-700 dark:text-red-300
                    hover:translate-y-[-1px] active:translate-y-0"
                >
                  Reset Semua Filter
                  <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                
                {filters.nama && (
                  <button
                    onClick={() => setFilters({ ...filters, nama: '' })}
                    className="relative inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                      transition-all duration-200
                      bg-white dark:bg-gray-700
                      border border-purple-200 dark:border-purple-700
                      before:absolute before:inset-0 before:rounded-full
                      before:bg-gradient-to-r before:from-purple-100/80 before:to-purple-50/90
                      dark:before:bg-gradient-to-r dark:before:from-purple-900/30 dark:before:to-purple-800/10 
                      before:z-[-1] before:overflow-hidden
                      text-purple-700 dark:text-purple-300
                      hover:translate-y-[-1px] active:translate-y-0"
                  >
                    Nama: {filters.nama}
                    <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            <StickyHorizontalScroll className="mb-2">
              <div className="relative rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all" style={{ minWidth: '1000px' }}>
                {pageLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Tidak ada data pembayaran santri yang sesuai dengan filter</p>
                    {(filters.status || filters.kamar || filters.educationLevel) && (
                      <button
                        onClick={() => setFilters({ status: '', kamar: '', educationLevel: '' })}
                        className="relative mt-4 px-4 py-2 rounded-xl text-blue-700 dark:text-blue-300 font-medium
                          transition-all duration-200
                          bg-white dark:bg-gray-700 
                          border border-blue-200 dark:border-blue-700
                          before:absolute before:inset-0 before:rounded-xl
                          before:bg-gradient-to-r before:from-blue-100/80 before:to-blue-50/90
                          dark:before:bg-gradient-to-r dark:before:from-blue-900/30 dark:before:to-blue-800/10
                          before:z-[-1] before:overflow-hidden
                          hover:translate-y-[-2px] active:translate-y-0"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 transition-colors">
                    <thead className="bg-gray-100 dark:bg-gray-800 transition-colors">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Nama
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Status Pembayaran
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Total Terbayar
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Total Tagihan
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Semester
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Kamar
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          No. WhatsApp
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600 transition-colors">
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white transition-colors">
                            {payment.nama}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full shadow-neumorphic-button dark:shadow-neumorphic-button-dark ${
                              payment.status === 'Lunas' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                                : payment.status === 'Menunggu Verifikasi'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                                : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                            } transition-colors`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 transition-colors">
                            {formatCurrency(payment.paid)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 transition-colors">
                            {formatCurrency(payment.total)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 transition-colors">
                            {payment.educationGrade}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 transition-colors">
                            {payment.kamar}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 transition-colors">
                            {payment.nomorTelpon || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button 
                              onClick={() => handleActionButtonClick(payment)}
                              className={`px-3 py-1 text-xs font-semibold rounded-md
                                transition-all duration-200
                                shadow-neumorphic-button dark:shadow-neumorphic-button-dark 
                                hover:shadow-neumorphic-button-pressed hover:dark:shadow-neumorphic-button-pressed-dark
                                active:translate-y-0.5
                                ${
                                  payment.status === 'Lunas' 
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100' 
                                    : payment.status === 'Menunggu Verifikasi'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                                    : 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                                } transition-colors`}
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
            </StickyHorizontalScroll>
          </div>
          
          {/* Payment Proof Verification Modal */}
          {showPaymentProofModal && selectedPayment && (
            <div className="fixed inset-0 z-60 overflow-y-auto">
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
            <div className="fixed inset-0 z-70 overflow-y-auto">
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
            <div className="fixed inset-0 z-60 overflow-y-auto">
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
          
          {/* Add TagihanModal for adding new santri to the invoice */}
          <TagihanModal
            isOpen={showTagihanModal}
            onClose={() => setShowTagihanModal(false)}
            onSuccess={handleTagihanSuccess}
            existingInvoiceId={paymentId}
            paymentName={paymentName}
            nominalTagihan={invoiceTotalAmount}
            existingSantriIds={santriPayments.map(payment => payment.santriId)}
            editMode={true}
          />

          {/* Revoke Status Modal */}
          {showRevokeStatusModal && (
            <div className="fixed inset-0 z-70 overflow-y-auto">
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
        </div>
      </div>
    </div>
  );
}