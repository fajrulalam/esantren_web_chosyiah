"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { KODE_ASRAMA } from '@/constants';
import TagihanModal from '@/components/TagihanModal';
import SantriPaymentStatusModal from '@/components/SantriPaymentStatusModal';

interface PaymentLog {
  id: string;
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
  const [showSantriStatusModal, setShowSantriStatusModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentLog | null>(null);

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
      const paymentsCollectionRef = collection(db, `AktivitasCollection/${KODE_ASRAMA}/PembayaranLogs`);
      const paymentsQuery = query(paymentsCollectionRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(paymentsQuery);
      
      const paymentLogs: PaymentLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
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
      
      setPayments(paymentLogs);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (payment: PaymentLog) => {
    setSelectedPayment(payment);
    setShowSantriStatusModal(true);
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
        <h1 className="text-2xl font-bold">Rekapitulasi Pembayaran</h1>
        <div className="flex space-x-4">
          <button 
            onClick={() => setShowTagihanModal(true)} 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Buat Tagihan
          </button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : payments.length === 0 ? (
          <p className="text-xl text-center text-gray-500 py-12">
            Belum ada tagihan pembayaran yang dibuat
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Pembayaran
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nominal
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jumlah Lunas
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Menunggu Verifikasi
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Jumlah Santri Tertagih
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal Pembuatan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr 
                    key={payment.id} 
                    onClick={() => handleRowClick(payment)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.paymentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(payment.nominal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.numberOfPaid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.numberOfWaitingVerification}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.numberOfSantriInvoiced}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payment.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <TagihanModal 
        isOpen={showTagihanModal} 
        onClose={() => setShowTagihanModal(false)}
        onSuccess={fetchPayments}
      />

      {selectedPayment && (
        <SantriPaymentStatusModal
          isOpen={showSantriStatusModal}
          onClose={() => setShowSantriStatusModal(false)}
          paymentId={selectedPayment.id}
          paymentName={selectedPayment.paymentName}
        />
      )}
    </div>
  );
}