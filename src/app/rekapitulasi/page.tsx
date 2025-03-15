"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { collection, getDocs, orderBy, query, where, Timestamp, doc, getDoc, updateDoc, increment, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, functions } from '@/firebase/config';
import { KODE_ASRAMA } from '@/constants';
import TagihanModal from '@/components/TagihanModal';
import DarkModeToggle from '@/components/DarkModeToggle';
import { httpsCallable } from 'firebase/functions';

interface PaymentLog {
  id: string;
  paymentName: string;
  nominal: number;
  numberOfPaid: number;
  numberOfWaitingVerification: number;
  numberOfSantriInvoiced: number;
  timestamp: Timestamp;
}

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

// Create a client component that wraps the search params handling
function SearchParamsHandler({
  onParamsChange
}: {
  onParamsChange: (detail: string | null, name: string | null) => void
}) {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const detail = searchParams.get('detail');
    const name = searchParams.get('name');
    onParamsChange(detail, name);
  }, [searchParams, onParamsChange]);
  
  return null;
}

export default function RekapitulasiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTagihanModal, setShowTagihanModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentLog | null>(null);
  
  // Detail view state
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);
  const [detailPaymentName, setDetailPaymentName] = useState<string | null>(null);
  
  // Function declaration first
  const fetchSantriPaymentStatus = async (paymentId: string) => {
    if (!paymentId) return;

    setDetailLoading(true);
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
      setDetailLoading(false);
    }
  };
  
  // Then the callback that uses it
  const handleParamsChange = React.useCallback((detail: string | null, name: string | null) => {
    if (detail && name && !showDetailView) {
      setDetailPaymentId(detail);
      setDetailPaymentName(name);
      setShowDetailView(true);
      fetchSantriPaymentStatus(detail);
    }
  }, [showDetailView]);
  
  // Detail page states
  const [santriPayments, setSantriPayments] = useState<SantriPaymentStatus[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<SantriPaymentStatus[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState({
    kamar: '',
    educationLevel: '',
    status: ''
  });
  
  // Payment verification/detail view states
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [showRevokeStatusModal, setShowRevokeStatusModal] = useState(false);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [selectedSantriPayment, setSelectedSantriPayment] = useState<SantriPaymentStatus | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonType, setRejectReasonType] = useState('');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReasonType, setRevokeReasonType] = useState('');
  const [customRevokeReason, setCustomRevokeReason] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'waliSantri') {
        router.push('/payment-history');
      } else {
        setIsAuthorized(true);
        fetchPayments();
      }
    }
  }, [user, loading, router]);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      // First, try to get invoices from the new Invoices collection
      const invoicesCollectionRef = collection(db, 'Invoices');
      const invoicesQuery = query(
        invoicesCollectionRef, 
        where('kodeAsrama', '==', KODE_ASRAMA),
        orderBy('timestamp', 'desc')
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      // Then, get the legacy payments from PembayaranLogs
      const logsCollectionRef = collection(db, `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs`);
      const logsQuery = query(logsCollectionRef, orderBy('timestamp', 'desc'));
      const logsSnapshot = await getDocs(logsQuery);
      
      const paymentLogs: PaymentLog[] = [];
      
      // Process invoices from the new collection
      invoicesSnapshot.forEach((doc) => {
        const data = doc.data();
        // Check if this invoice already exists in PembayaranLogs to avoid duplicates
        const existingLogIndex = paymentLogs.findIndex(log => log.id === data.id);
        
        if (existingLogIndex === -1) {
          paymentLogs.push({
            id: doc.id,
            paymentName: data.paymentName || 'Tanpa Nama',
            nominal: data.nominal || 0,
            numberOfPaid: data.numberOfPaid || 0,
            numberOfWaitingVerification: data.numberOfWaitingVerification || 0,
            numberOfSantriInvoiced: data.numberOfSantriInvoiced || 0,
            timestamp: data.timestamp || Timestamp.now()
          });
        }
      });
      
      // Process legacy payment logs
      // Add only those not already added from Invoices collection (avoiding duplicates)
      logsSnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Skip if this log has an invoiceId and we already added it from Invoices collection
        if (data.invoiceId && paymentLogs.some(log => log.id === data.invoiceId)) {
          return;
        }
        
        paymentLogs.push({
          id: doc.id,
          paymentName: data.paymentName || 'Tanpa Nama',
          nominal: data.nominal || 0,
          numberOfPaid: data.numberOfPaid || 0,
          numberOfWaitingVerification: data.numberOfWaitingVerification || 0,
          numberOfSantriInvoiced: data.numberOfSantriInvoiced || 0,
          timestamp: data.timestamp || Timestamp.now()
        });
      });
      
      // Sort by timestamp (newest first)
      paymentLogs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
      
      setPayments(paymentLogs);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (payment: PaymentLog) => {
    // Instead of navigating to a separate page, show the detail view
    setDetailPaymentId(payment.id);
    setDetailPaymentName(payment.paymentName);
    setShowDetailView(true);
    
    // Update the URL using Next.js router to make it look like a separate page
    // Create a new URLSearchParams object
    const params = new URLSearchParams();
    params.set('detail', payment.id);
    params.set('name', payment.paymentName);
    
    // Use router.push with the new query string
    // Account for trailing slash in next.config.ts
    router.push(`/rekapitulasi/?${params.toString()}`, { scroll: false });
    
    // Load the detail data
    fetchSantriPaymentStatus(payment.id);
  };
  
  // Function to go back to the main view
  const handleBackClick = () => {
    setShowDetailView(false);
    setDetailPaymentId(null);
    setDetailPaymentName(null);
    
    // Update URL using Next.js router to remove the detail parameters
    // Using trailingSlash in next.config.ts means URLs should end with a slash
    router.push('/rekapitulasi/', { scroll: false });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return 'Tidak ada tanggal';
    
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };
  
  // Format date from Firestore timestamp with time
  const formatDateTime = (timestamp: any) => {
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
  
  // Delete invoice function
  const deleteInvoice = async () => {
    if (!detailPaymentId) return;
    
    if (!confirm('Apakah Anda yakin ingin menghapus tagihan ini? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    
    setDetailLoading(true);
    
    try {
      console.log("Attempting to delete invoice with ID:", detailPaymentId);
      
      const deleteInvoiceFunction = httpsCallable(functions, 'deleteInvoiceFunction');
      const result = await deleteInvoiceFunction({ invoiceId: detailPaymentId });
      console.log("Delete result:", result);
      
      alert('Tagihan berhasil dihapus');
      handleBackClick(); // Go back to the main view
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert('Gagal menghapus tagihan. Silakan coba lagi.');
    } finally {
      setDetailLoading(false);
    }
  };
  
  // Function to get payment proof from history
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
  
  // Apply filters for detail view
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
  
  // Handle action button click in detail view
  const handleActionButtonClick = (payment: SantriPaymentStatus) => {
    setSelectedSantriPayment(payment);
    
    if (payment.status === 'Belum Lunas') {
      // Open WhatsApp with the reminder message
      if (payment.nomorWaliSantri) {
        const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
          ? payment.nomorWaliSantri.substring(1) 
          : payment.nomorWaliSantri;

        const message = `[PENGINGAT PEMBAYARAN SANTRI]\n\nAssalamu'alaikum Wr. Wb. Wali Santri dari Ananda ${payment.nama},\n\nKami mohon izin mengingatkan kembali mengenai pembayaran *${detailPaymentName}* sebesar *${formatCurrency(payment.total - payment.paid)}* yang masih belum terselesaikan. Kami sangat menghargai perhatian serta kerja sama Bapak/Ibu.\n\nJazakumullah khairan katsiran.`
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
  
  // Predefined reasons for rejecting or revoking payments
  const predefinedReasons = [
    'Gambar kurang jelas (blur/pecah)',
    'Tidak ada pembayaran masuk',
    'Informasi pada gambar kurang lengkap',
    'Lainnya'
  ];
  
  // Handle verifying payment proof
  const handleVerifyPayment = async (approve: boolean) => {
    if (!selectedSantriPayment || !detailPaymentId) return;
    
    try {
      setDetailLoading(true);
      
      if (!approve && !rejectReason) {
        setShowRejectReasonModal(true);
        return;
      }
      
      const paymentStatusRef = doc(db, 'PaymentStatuses', selectedSantriPayment.id);
      
      if (approve) {
        // Get current payment details
        const paymentProof = getPaymentProofFromHistory(selectedSantriPayment);
        const paymentAmount = paymentProof.amount;
        const isPartialPaymentType = paymentProof.type.includes('Sebagian');
        
        // Calculate new paid amount (add the payment amount to current paid amount)
        const newPaidAmount = selectedSantriPayment.paid + paymentAmount;
        
        // Approve payment and update the paid amount
        await updateDoc(paymentStatusRef, {
          status: 'Lunas',
          paid: newPaidAmount, // Update the paid amount when approving
          history: {
            ...selectedSantriPayment.history,
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
        const santriRef = doc(db, 'SantriCollection', selectedSantriPayment.santriId);
        await updateDoc(santriRef, {
          statusTanggungan: 'Lunas'
        });
        
        // Update the invoice counter
        const invoiceRef = doc(db, 'Invoices', detailPaymentId);
        await updateDoc(invoiceRef, {
          numberOfPaid: increment(1),
          numberOfWaitingVerification: increment(-1)
        });
        
        // Send WhatsApp confirmation message
        if (selectedSantriPayment.nomorWaliSantri) {
          // Determine if it's a partial payment (paid amount is less than total)
          const isPartialPayment = selectedSantriPayment.paid + paymentAmount < selectedSantriPayment.total;
          
          openWhatsAppWithApprovalMessage(
            selectedSantriPayment, 
            isPartialPayment,
            isPartialPaymentType,
            paymentAmount
          );
        }
      } else {
        // Prepare the reason text
        const finalRejectReason = rejectReasonType === 'Lainnya' ? customRejectReason : rejectReasonType;
        
        // Get the latest payment proof to identify the rejected amount
        const paymentProof = getPaymentProofFromHistory(selectedSantriPayment);
        const rejectedAmount = paymentProof.amount;
        
        // Reject payment (don't change the paid amount since it was never updated)
        await updateDoc(paymentStatusRef, {
          status: 'Belum Lunas',
          history: {
            ...selectedSantriPayment.history,
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
        const invoiceRef = doc(db, 'Invoices', detailPaymentId);
        await updateDoc(invoiceRef, {
          numberOfWaitingVerification: increment(-1)
        });
        
        // Open WhatsApp with the rejection message
        if (selectedSantriPayment.nomorWaliSantri) {
          openWhatsAppWithRejectionMessage(selectedSantriPayment, finalRejectReason);
        }
      }
      
      // Refresh the data
      await fetchSantriPaymentStatus(detailPaymentId);
      
      setShowPaymentProofModal(false);
      setShowRejectReasonModal(false);
      setRejectReason('');
      setRejectReasonType('');
      setCustomRejectReason('');
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Gagal memperbarui status pembayaran');
    } finally {
      setDetailLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with rejection message
  const openWhatsAppWithRejectionMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;

    const message = `[Bukti Pembayaran Perlu Diunggah Ulang]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama},\n\n*Kami informasikan bahwa bukti pembayaran untuk *${detailPaymentName}* yang sebelumnya diunggah belum dapat diverifikasi karena:\n\n*${reason}\n\n*Mohon untuk mengunggah ulang bukti pembayaran atau melakukan pembayaran kembali melalui aplikasi E-Santren. Apabila ada pertanyaan, silakan menghubungi admin asrama.\n\nJazakumullah khairan katsiran atas perhatian dan kerja samanya.`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  // Handle revoking payment status
  const handleRevokeStatus = async () => {
    if (!selectedSantriPayment || !detailPaymentId) return;
    
    try {
      setDetailLoading(true);
      
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
      
      if (selectedSantriPayment.history) {
        // Look for the latest verification entry
        const historyEntries = Object.values(selectedSantriPayment.history);
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
      
      const paymentStatusRef = doc(db, 'PaymentStatuses', selectedSantriPayment.id);
      
      // Calculate the new paid amount after reverting
      const newPaidAmount = Math.max(0, selectedSantriPayment.paid - amountToRevert);
      
      // Revert status to Belum Lunas and update paid amount
      await updateDoc(paymentStatusRef, {
        status: 'Belum Lunas',
        paid: newPaidAmount, // Update the paid amount by subtracting the reverted amount
        history: {
          ...selectedSantriPayment.history,
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
      const santriRef = doc(db, 'SantriCollection', selectedSantriPayment.santriId);
      await updateDoc(santriRef, {
        statusTanggungan: 'Belum Lunas'
      });
      
      // Update the invoice counter
      const invoiceRef = doc(db, 'Invoices', detailPaymentId);
      await updateDoc(invoiceRef, {
        numberOfPaid: increment(-1)
      });
      
      // Open WhatsApp with the revocation message
      if (selectedSantriPayment.nomorWaliSantri) {
        openWhatsAppWithRevocationMessage(selectedSantriPayment, finalRevokeReason);
      }
      
      // Refresh the data
      await fetchSantriPaymentStatus(detailPaymentId);
      
      setShowRevokeStatusModal(false);
      setShowPaymentHistoryModal(false);
      setRevokeReason('');
      setRevokeReasonType('');
      setCustomRevokeReason('');
    } catch (error) {
      console.error('Error revoking payment status:', error);
      alert('Gagal membatalkan status pembayaran');
    } finally {
      setDetailLoading(false);
    }
  };
  
  // Helper function to open WhatsApp with revocation message
  const openWhatsAppWithRevocationMessage = (payment: SantriPaymentStatus, reason: string) => {
    const phoneNumber = payment.nomorWaliSantri.startsWith('+62') 
      ? payment.nomorWaliSantri.substring(1) 
      : payment.nomorWaliSantri;

    const message = `[Permintaan Unggah Ulang Bukti Pembayaran]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\nKami informasikan bahwa pembayaran untuk *${detailPaymentName}* yang sebelumnya telah terverifikasi terpaksa kami *batalkan* karena:\n\n*${reason}*\n\nDimohon untuk segera menghubungi admin asrama atau mengulang proses pembayaran melalui aplikasi E-Santren.\n\nJazakumullah khairan katsiran atas perhatian dan kerja samanya.`;
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
      message = `[Pembayaran Sebagian Terverifikasi ✅]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Pembayaran sebagian untuk *${detailPaymentName}* sebesar *${formatCurrency(amount)}* telah *berhasil diverifikasi*.\n\nRincian pembayaran:\n• Jumlah dibayarkan: *${formatCurrency(amount)}*\n• Total tagihan: *${formatCurrency(payment.total)}*\n• Sisa yang harus dibayar: *${formatCurrency(payment.total - payment.paid)}*\n\nJangan lupa untuk melunasi sisa pembayaran sebelum batas waktu yang ditentukan yaa! 😊\n\nJazakumullah khairan katsiran atas pembayarannya.`;
    } else if (isPartialPayment) {
      // Message for full payment that leaves the total not fully paid yet
      message = `[Pembayaran Terverifikasi ✅]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Pembayaran untuk *${detailPaymentName}* sebesar *${formatCurrency(amount)}* telah *berhasil diverifikasi*.\n\nRincian pembayaran saat ini:\n• Total dibayarkan: *${formatCurrency(payment.paid)}*\n• Total tagihan: *${formatCurrency(payment.total)}*\n• Sisa yang perlu dilunasi: *${formatCurrency(payment.total - payment.paid)}*\n\nMohon segera melunasi sisa pembayaran untuk menyelesaikan kewajiban ini.\n\nJazakumullah khairan katsiran atas kerjasamanya.`;
    } else {
      // Message for full payment that completes the invoice
      message = `[Pembayaran Lunas Terverifikasi ✅]\n\n*Assalamu'alaikum Wali Santri dari Ananda ${payment.nama}*,\n\n*Alhamdulillah!* Kami sampaikan bahwa pembayaran *${detailPaymentName}* sebesar *${formatCurrency(amount)}* telah *LUNAS dan berhasil diverifikasi*! 🎉\n\nTerimakasih atas komitmen Bapak/Ibu dalam mendukung pendidikan Ananda di pesantren kami. Semoga menjadi amal jariyah dan keberkahan bagi keluarga.\n\nJazakumullah khairan katsiran. 😊`;
    }
    
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // URL parameter handling is now done via the SearchParamsHandler component

  if (loading || !isAuthorized) {
    return (
      <div className="flex justify-center items-center min-h-screen dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // Get unique values for filters in detail view
  const uniqueKamar = [...new Set(santriPayments.map(payment => payment.kamar))];
  const uniqueEducationLevels = [...new Set(santriPayments.map(payment => payment.educationLevel))];
  const uniqueStatuses = [...new Set(santriPayments.map(payment => payment.status))];

  // Detail view component
  const renderDetailView = () => {
    if (!detailPaymentId || !detailPaymentName) return null;
    
    return (
      <div className="container mx-auto py-6 px-4 transition-colors dark:bg-gray-900">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button 
              onClick={handleBackClick}
              className="flex items-center text-blue-600 hover:text-blue-800 mb-2"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali
            </button>
            <h1 className="text-2xl font-bold dark:text-white">Detail Pembayaran: {detailPaymentName}</h1>
          </div>
          
          <button
            onClick={deleteInvoice}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Hapus Tagihan
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label htmlFor="kamar" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter Kamar
              </label>
              <select
                id="kamar"
                name="kamar"
                value={filters.kamar}
                onChange={handleFilterChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Semua Kamar</option>
                {uniqueKamar.map((kamar) => (
                  <option key={kamar} value={kamar}>{kamar}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter Jenjang Pendidikan
              </label>
              <select
                id="educationLevel"
                name="educationLevel"
                value={filters.educationLevel}
                onChange={handleFilterChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Semua Jenjang</option>
                {uniqueEducationLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter Status Pembayaran
              </label>
              <select
                id="status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredPayments.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">Tidak ada data pembayaran santri</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
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
                      Jenjang Pendidikan
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kelas
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Kamar
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {payment.nama}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatCurrency(payment.paid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.educationLevel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.educationGrade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.kamar}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
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
        </div>
      </div>
    );
  };

  // Main list view
  const renderMainView = () => {
    return (
      <div className="container mx-auto py-8 px-4 transition-colors dark:bg-gray-900">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold dark:text-white">Rekapitulasi Pembayaran</h1>
          <div className="flex items-center space-x-4">
            <DarkModeToggle />
            <button 
              onClick={() => setShowTagihanModal(true)} 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Buat Tagihan
            </button>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md transition-colors">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-xl text-center text-gray-500 dark:text-gray-400 py-12">
              Belum ada tagihan pembayaran yang dibuat
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nama Pembayaran
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nominal
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Jumlah Lunas
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Menunggu Verifikasi
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Jumlah Santri Tertagih
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tanggal Pembuatan
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {payments.map((payment) => (
                    <tr 
                      key={payment.id} 
                      onClick={() => handleRowClick(payment)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {payment.paymentName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatCurrency(payment.nominal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.numberOfPaid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.numberOfWaitingVerification}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {payment.numberOfSantriInvoiced}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatDate(payment.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal for creating new payment */}
        <TagihanModal 
          isOpen={showTagihanModal} 
          onClose={() => setShowTagihanModal(false)}
          onSuccess={fetchPayments}
        />
      </div>
    );
  };

  return (
    <>
      {/* Handle URL parameters with proper suspense boundary */}
      <Suspense fallback={null}>
        <SearchParamsHandler onParamsChange={handleParamsChange} />
      </Suspense>
      
      {/* Render either the detail view or the main view */}
      {showDetailView ? renderDetailView() : renderMainView()}
      
      {/* Payment Proof Verification Modal */}
      {showPaymentProofModal && selectedSantriPayment && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Verifikasi Bukti Pembayaran - {selectedSantriPayment.nama}
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
                    const paymentProof = getPaymentProofFromHistory(selectedSantriPayment);
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
                            <p className="text-base font-medium">{formatDateTime(paymentProof.timestamp)}</p>
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
      {showPaymentHistoryModal && selectedSantriPayment && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center bg-black bg-opacity-50">
            <div className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Riwayat Pembayaran - {selectedSantriPayment.nama}
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
                    {selectedSantriPayment && selectedSantriPayment.history && Object.values(selectedSantriPayment.history).length > 0 ? (
                      Object.values(selectedSantriPayment.history)
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
                                <p className="font-medium">{formatDateTime(new Date(historyItem.date))}</p>
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
    </>
  );
}