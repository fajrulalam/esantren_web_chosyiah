"use client";

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { KODE_ASRAMA } from '@/constants';
import { collection, getDocs, query, where, getDoc, doc, updateDoc, arrayUnion, serverTimestamp, increment } from 'firebase/firestore';
import { db, functions } from '@/firebase/config';
import { httpsCallable } from 'firebase/functions';
import TagihanModal from '@/components/TagihanModal';

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

interface PaymentProof {
  amount: number;
  timestamp: any;
  imageUrl: string;
  paymentMethod: string;
  status: string;
  type: string;
  inputtedBy: string;
}

// Wrapper component for suspense boundary
function RekapitulasiViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get payment ID and name from query parameters - no path params at all
  const paymentId = searchParams.get('id') || '';
  const paymentName = searchParams.get('name') || 'Detail Pembayaran';
  
  // Log clearly
  console.log("Rekapitulasi View Page loaded with: ", { paymentId, paymentName });
  
  const { user, loading } = useAuth();
  
  const [pageLoading, setPageLoading] = useState(true);
  const [santriPayments, setSantriPayments] = useState<SantriPaymentStatus[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<SantriPaymentStatus[]>([]);
  const [filters, setFilters] = useState({
    kamar: '',
    educationLevel: '',
    status: ''
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

  // Check authentication first
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'waliSantri') {
        router.push('/payment-history');
      } else if (!paymentId) {
        console.error("No payment ID provided");
        router.push('/rekapitulasi');
      } else {
        fetchSantriPaymentStatus();
      }
    }
  }, [user, loading, router, paymentId]);
  
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
      
      const deleteInvoiceFunction = httpsCallable(functions, 'deleteInvoiceFunction');
      const result = await deleteInvoiceFunction({ invoiceId: paymentId });
      console.log("Delete result:", result);
      
      alert('Tagihan berhasil dihapus');
      router.push('/rekapitulasi/');
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

        const message = `[PESAN OTOMATIS DARI Esantren Chosyi'ah..]\n\nAssalamu'alaikum Wr. Wb. Santri Ananda ${payment.nama},\n\nmengingatkan kembali mengenai pembayaran *${paymentName}* sebesar *${formatCurrency(payment.total - payment.paid)}* yang masih belum terselesaikan. Segeralah melakukan pembayaran untuk mendapatkan kode gerbang yang telah diperbarui (kode lama akan hangus pada tanggal 1* April 2025).\n\nUnggah bukti pembayaran ke website Esantren Chosyi'ah: https://esantren-chosyiah.vercel.app/\n\nJazakumullah khairan katsiran.`
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
        if (selectedPayment.nomorWaliSantri) {
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
      setPageLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with rejection message
  const openWhatsAppWithRejectionMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;

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
      setPageLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with revocation message
  const openWhatsAppWithRevocationMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;

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
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;

    let message = '';
    
    if (isPartialPaymentType) {
      // Message for partial payment
      message = `[Pembayaran Sebagian Terverifikasi]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Pembayaran sebagian untuk *${paymentName}* sebesar *${formatCurrency(amount)}* telah *berhasil diverifikasi*.\n\nRincian pembayaran:\n• Jumlah dibayarkan: *${formatCurrency(amount)}*\n• Total tagihan: *${formatCurrency(payment.total)}*\n• Sisa yang harus dibayar: *${formatCurrency(payment.total - payment.paid)}*\n\nJangan lupa untuk melunasi sisa pembayaran sebelum batas waktu yang ditentukan yaa! 😊\n\nJazakumullah khairan katsiran atas pembayarannya.`;
    } else if (isPartialPayment) {
      // Message for full payment that leaves the total not fully paid yet
      message = `[Pembayaran Terverifikasi]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Pembayaran untuk *${paymentName}* sebesar *${formatCurrency(amount)}* telah *berhasil diverifikasi*.\n\nRincian pembayaran saat ini:\n• Total dibayarkan: *${formatCurrency(payment.paid)}*\n• Total tagihan: *${formatCurrency(payment.total)}*\n• Sisa yang perlu dilunasi: *${formatCurrency(payment.total - payment.paid)}*\n\nMohon segera melunasi sisa pembayaran untuk menyelesaikan kewajiban ini.\n\nJazakumullah khairan katsiran atas kerjasamanya.`;
    } else {
      // Message for full payment that completes the invoice
      message = `[Pembayaran Lunas Terverifikasi]\n\n*Assalamu'alaikum  Santri Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Kami sampaikan bahwa pembayaran *${paymentName}* sebesar *${formatCurrency(amount)}* telah *LUNAS dan berhasil diverifikasi*! \n\n Semoga menjadi amal jariyah dan keberkahan bagi keluarga.\n\nJazakumullah khairan katsiran. \n\n Kode untuk masuk ke Asrama adalah 37537537# (kode ini wajib dirahasiakan)`;
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

  if (loading || pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Handle successful tagihan modal submission
  const handleTagihanSuccess = () => {
    // Refresh the data
    fetchSantriPaymentStatus();
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button 
            onClick={() => router.push('/rekapitulasi')}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-2"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kembali
          </button>
          <h1 className="text-2xl font-bold">Detail Pembayaran: {paymentName}</h1>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowTagihanModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Tambah Santri
          </button>
          <button
            onClick={deleteInvoice}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Hapus Tagihan
          </button>
        </div>
      </div>

      {/* Invoice Summary with Neumorphic Design */}
      <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-6 shadow-neumorphic dark:shadow-neumorphic-dark">
        <h2 className="text-lg font-semibold mb-4">Informasi Tagihan</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nominal */}
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-neumorphic dark:shadow-neumorphic-dark">
            <div className="flex items-center justify-between">
              <div className="text-gray-500 dark:text-gray-300 text-sm font-medium">Nominal Tagihan</div>
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold">{formatCurrency(invoiceDetails.nominal)}</p>
            </div>
          </div>
          
          {/* Total Santri */}
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-neumorphic dark:shadow-neumorphic-dark">
            <div className="flex items-center justify-between">
              <div className="text-gray-500 dark:text-gray-300 text-sm font-medium">Jumlah Santri Tertagih</div>
              <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold">{invoiceDetails.numberOfSantriInvoiced} Santri</p>
            </div>
          </div>
          
          {/* Menunggu Verifikasi */}
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-neumorphic dark:shadow-neumorphic-dark">
            <div className="flex items-center justify-between">
              <div className="text-gray-500 dark:text-gray-300 text-sm font-medium">Menunggu Verifikasi</div>
              <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold">{invoiceDetails.numberOfWaitingVerification} Santri</p>
            </div>
          </div>
          
          {/* Sudah Lunas */}
          <div className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-neumorphic dark:shadow-neumorphic-dark">
            <div className="flex items-center justify-between">
              <div className="text-gray-500 dark:text-gray-300 text-sm font-medium">Sudah Lunas</div>
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold">{invoiceDetails.numberOfPaid} Santri</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round((invoiceDetails.numberOfPaid / (invoiceDetails.numberOfSantriInvoiced || 1)) * 100)}% Selesai
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
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
              Filter Semester
            </label>
            <select
              id="educationLevel"
              name="educationLevel"
              value={filters.educationLevel}
              onChange={handleFilterChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Semua Semester</option>
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
        <div className="overflow-auto" style={{ maxWidth: '100%' }}>
          <div className="shadow-md rounded-lg" style={{ minWidth: '800px' }}>
            {pageLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredPayments.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Tidak ada data pembayaran santri</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nama
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status Pembayaran
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Terbayar
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Tagihan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Semester
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Program Studi
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kamar
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      No. WhatsApp [view page]
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {payment.nama}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                          payment.status === 'Lunas' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                            : payment.status === 'Menunggu Verifikasi'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                            : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatCurrency(payment.paid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatCurrency(payment.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.educationLevel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 uppercase">
                        {payment.programStudi || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.kamar}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.nomorWaliSantri || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <button 
                          onClick={() => handleActionButtonClick(payment)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md shadow-sm hover:shadow-neumorphic transition-all ${
                            payment.status === 'Lunas' 
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-100' 
                              : payment.status === 'Menunggu Verifikasi'
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-100'
                              : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-800 dark:text-green-100'
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
          {filteredPayments.length > 0 && (
            <div className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Scroll horizontally untuk melihat lebih banyak data</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Payment Proof Verification Modal */}
      {showPaymentProofModal && selectedPayment && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
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
        <div className="fixed inset-0 z-20 overflow-y-auto">
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
        <div className="fixed inset-0 z-10 overflow-y-auto">
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
        <div className="fixed inset-0 z-20 overflow-y-auto">
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
  );
}

// Export the main component with Suspense boundary
export default function RekapitulasiViewPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <RekapitulasiViewContent />
    </Suspense>
  );
}