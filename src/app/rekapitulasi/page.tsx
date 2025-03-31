"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { collection, getDocs, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config'; // Assuming functions is not directly used here, removed import
import { KODE_ASRAMA } from '@/constants';
import TagihanModal from '@/components/TagihanModal';
// Removed import for httpsCallable as it wasn't used in the final code provided
// import { httpsCallable } from 'firebase/functions';

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

export default function RekapitulasiPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTagihanModal, setShowTagihanModal] = useState(false);
  // selectedPayment state is removed as it's not used for modal/detail view anymore

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
    } catch (error) {
      console.error("Error fetching payments:", error);
      // Consider setting an error state here to display to the user
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW Improved Navigation Handler ---
  const handleRowClick = (payment: PaymentLog) => {
    console.log("Clicked on payment:", payment.id, payment.paymentName);

    // Create a base64 encoded version of the ID to avoid all URL parsing issues
    const base64PaymentId = btoa(payment.id);
    
    // Add the payment name as a query parameter to improve UX
    const queryParams = new URLSearchParams({
      name: payment.paymentName,
    }).toString();

    // Construct the URL with the base64 encoded ID and query parameters
    const url = `/rekapitulasi-detail/${base64PaymentId}?${queryParams}`;

    console.log("Navigating to URL:", url);

    // Navigate to the detail page
    router.push(url);
  };
  // --- End of NEW Improved Navigation Handler ---

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

  // Main list view (no separate detail view rendering logic needed here anymore)
  return (
      <div className="container mx-auto py-8 px-4 transition-colors dark:bg-gray-900">
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
                  </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {payments.map((payment) => (
                      <tr
                          key={payment.id}
                          onClick={() => handleRowClick(payment)} // Uses the corrected function
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
            onSuccess={fetchPayments} // Refresh list after successful creation
        />
      </div>
  );
}