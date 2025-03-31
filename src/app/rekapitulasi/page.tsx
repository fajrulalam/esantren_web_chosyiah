"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { collection, getDocs, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db, functions } from '@/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { KODE_ASRAMA } from '@/constants';
import TagihanModal from '@/components/TagihanModal';
import RekapDetailView from '@/components/RekapDetailView';
// Now we're using httpsCallable for deleting invoices directly in this component

// Interface for the data displayed in the main table
interface PaymentLog {
  id: string; // This will be the Firestore document ID or the legacy ID
  paymentName: string;
  nominal: number;
  numberOfPaid: number;
  numberOfWaitingVerification: number;
  numberOfSantriInvoiced: number;
  timestamp: Timestamp;
}

// Search params wrapper component
function RekapContent() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTagihanModal, setShowTagihanModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentLog | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentLog | null>(null);
  // selectedPayment state is removed as it's not used for modal/detail view anymore

  // Check for URL parameters that may contain a payment ID
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'waliSantri') {
        router.push('/payment-history');
      } else {
        setIsAuthorized(true);
        fetchPayments().then((fetchedPayments) => {
          // Check if there's an ID in the URL parameters
          const idParam = searchParams.get('id');
          if (idParam && fetchedPayments) {
            // Find the payment with this ID
            const paymentToShow = fetchedPayments.find(p => p.id === idParam);
            if (paymentToShow) {
              // Set the selected payment to show the detail view
              setSelectedPayment(paymentToShow);
            }
          }
        });
      }
    }
  }, [user, loading, router, searchParams]);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      // Get invoices from the new Invoices collection
      const invoicesCollectionRef = collection(db, 'Invoices');
      const invoicesQuery = query(
          invoicesCollectionRef,
          where('kodeAsrama', '==', KODE_ASRAMA),
          orderBy('timestamp', 'desc')
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);

      // Get legacy payments from PembayaranLogs
      const logsCollectionRef = collection(db, `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs`);
      const logsQuery = query(logsCollectionRef, orderBy('timestamp', 'desc'));
      const logsSnapshot = await getDocs(logsQuery);

      const paymentLogsMap = new Map<string, PaymentLog>(); // Use Map for easier duplicate handling

      // Process invoices from the new collection
      invoicesSnapshot.forEach((doc) => {
        const data = doc.data();
        const log: PaymentLog = {
          id: doc.id, // Use the Invoice document ID
          paymentName: data.paymentName || 'Tanpa Nama',
          nominal: data.nominal || 0,
          numberOfPaid: data.numberOfPaid || 0,
          numberOfWaitingVerification: data.numberOfWaitingVerification || 0,
          numberOfSantriInvoiced: data.numberOfSantriInvoiced || 0,
          timestamp: data.timestamp || Timestamp.now()
        };
        paymentLogsMap.set(log.id, log); // Add or overwrite based on Invoice ID
      });

      // Process legacy payment logs
      logsSnapshot.forEach((doc) => {
        const data = doc.data();
        const legacyId = doc.id; // The ID from PembayaranLogs
        const invoiceId = data.invoiceId; // Check if it links to an Invoice

        // If it links to an Invoice and that Invoice was already added, skip.
        if (invoiceId && paymentLogsMap.has(invoiceId)) {
          return;
        }

        // If this legacy log wasn't linked or its linked invoice wasn't found, add it using its own ID.
        // Make sure we don't overwrite an existing entry if by chance a legacyId matches an invoiceId
        if (!paymentLogsMap.has(legacyId)) {
          paymentLogsMap.set(legacyId, {
            id: legacyId, // Use the legacy document ID
            paymentName: data.paymentName || 'Tanpa Nama',
            nominal: data.nominal || 0,
            numberOfPaid: data.numberOfPaid || 0,
            numberOfWaitingVerification: data.numberOfWaitingVerification || 0,
            numberOfSantriInvoiced: data.numberOfSantriInvoiced || 0,
            timestamp: data.timestamp || Timestamp.now()
          });
        }
      });

      // Convert map values to array and sort by timestamp (newest first)
      const combinedLogs = Array.from(paymentLogsMap.values());
      combinedLogs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

      setPayments(combinedLogs);
      
      // Return the combined logs so they can be used by the caller
      return combinedLogs;
    } catch (error) {
      console.error("Error fetching payments:", error);
      // Consider setting an error state here to display to the user
    } finally {
      setIsLoading(false);
    }
    
    return null;
  };

  // Handler for showing the detail component
  const [selectedPayment, setSelectedPayment] = useState<PaymentLog | null>(null);
  
  const handleRowClick = (payment: PaymentLog) => {
    console.log("Showing detail for payment:", payment.id, payment.paymentName);
    
    // Set the selected payment to show the detail view
    setSelectedPayment(payment);
    
    // Update URL to include payment ID (for better UX, but not actually used for routing)
    window.history.pushState({}, '', `/rekapitulasi?id=${encodeURIComponent(payment.id)}`);
  };
  
  // Close handler for the detail view
  const handleCloseDetail = () => {
    setSelectedPayment(null);
    
    // Reset the URL to just the base path
    window.history.pushState({}, '', '/rekapitulasi');
  };
  
  // Handler to show edit payment modal (to add santri)
  const handleEditPayment = (e: React.MouseEvent, payment: PaymentLog) => {
    e.stopPropagation(); // Prevent row click from firing
    setEditingPayment(payment);
  };
  
  // Handler to show delete confirmation
  const handleDeleteClick = (e: React.MouseEvent, payment: PaymentLog) => {
    e.stopPropagation(); // Prevent row click from firing
    setPaymentToDelete(payment);
    setShowDeleteConfirm(true);
  };
  
  // Handler to delete invoice
  const deleteInvoice = async () => {
    if (!paymentToDelete) return;
    
    try {
      setIsLoading(true);
      console.log("Attempting to delete invoice with ID:", paymentToDelete.id);
      
      const deleteInvoiceFunction = httpsCallable(functions, 'deleteInvoiceFunction');
      const result = await deleteInvoiceFunction({ invoiceId: paymentToDelete.id });
      console.log("Delete result:", result);
      
      // Clear the delete confirmation modal
      setShowDeleteConfirm(false);
      setPaymentToDelete(null);
      
      // Refresh the payments list
      fetchPayments();
      
      // Show success message
      alert('Tagihan berhasil dihapus');
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert('Gagal menghapus tagihan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp | undefined | null): string => {
    if (!timestamp) return 'Tidak ada tanggal';
    try {
      const date = timestamp.toDate();
      // Check if the date is valid before formatting
      if (isNaN(date.getTime())) {
        return 'Tanggal tidak valid';
      }
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Error tanggal';
    }
  };


  if (loading || !isAuthorized) {
    return (
        <div className="flex justify-center items-center min-h-screen dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 transition-colors dark:bg-gray-900">
      {/* Show detail view as an overlay when selectedPayment is set */}
      {selectedPayment && (
        <RekapDetailView 
          payment={selectedPayment}
          onClose={() => {
            handleCloseDetail();
            fetchPayments(); // Refresh payments list when closing detail view
          }}
        />
      )}
      
      {/* Only show main content when detail view is not active */}
      {!selectedPayment && (
        <>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold dark:text-white">Rekapitulasi Pembayaran</h1>
            <div>
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
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Aksi
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
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-center space-x-2">
                              <button
                                onClick={(e) => handleEditPayment(e, payment)}
                                className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 shadow-sm hover:bg-blue-100"
                              >
                                Tambah Santri
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(e, payment)}
                                className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-100"
                              >
                                Hapus
                              </button>
                            </div>
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
              onSuccess={fetchPayments} // Refresh list after successful creation
          />
          
          {/* Modal for editing payment (adding santri) */}
          {editingPayment && (
            <TagihanModal
              isOpen={!!editingPayment}
              onClose={() => setEditingPayment(null)}
              onSuccess={fetchPayments}
              existingInvoiceId={editingPayment.id}
              paymentName={editingPayment.paymentName}
              nominalTagihan={editingPayment.nominal}
              editMode={true}
            />
          )}
          
          {/* Delete confirmation modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-30 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Konfirmasi Penghapusan</h3>
                <p className="mb-6">
                  Apakah Anda yakin ingin menghapus tagihan <span className="font-semibold">{paymentToDelete?.paymentName}</span>? Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="flex justify-end space-x-3">
                  <button 
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setPaymentToDelete(null);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={deleteInvoice}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Main page component with suspense
export default function RekapitulasiPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <RekapContent />
    </Suspense>
  );
}