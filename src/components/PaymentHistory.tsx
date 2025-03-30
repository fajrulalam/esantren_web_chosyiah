"use client";
import PaymentModal from './PaymentModal';
import PaymentStatusModal from './PaymentStatusModal';
import { useState, useEffect } from 'react';
import { db, functions } from '../firebase/config';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../firebase/auth';
import { PaymentStatus } from '@/types/santri';

export default function PaymentHistory() {
    const { user, santriName } = useAuth();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [santriData, setSantriData] = useState<any>(null);
    const [payments, setPayments] = useState<PaymentStatus[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    // Fetch santri data based on user information
    useEffect(() => {
        const fetchSantriData = async () => {
            try {
                setIsLoading(true);
                
                if (!user) return;
                
                // For wali santri, fetch using the santri ID if available
                if (user.role === 'waliSantri' && user.santriId) {
                    const santriDoc = doc(db, "SantriCollection", user.santriId);
                    const santriSnapshot = await getDoc(santriDoc);
                    
                    if (santriSnapshot.exists()) {
                        setSantriData(santriSnapshot.data());
                        fetchPayments(user.santriId);
                    } else {
                        setError("Data santri tidak ditemukan");
                    }
                } 
                // If we have a santri name from login but no santriId in user object
                else if (santriName) {
                    // Query the collection to find the santri
                    const santriRef = collection(db, "SantriCollection");
                    const q = query(
                        santriRef, 
                        where("nama", "==", santriName.trim().toLowerCase())
                    );
                    
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        // Take the first match
                        const doc = querySnapshot.docs[0];
                        setSantriData(doc.data());
                        fetchPayments(doc.id);
                    } else {
                        setError("Data santri tidak ditemukan");
                    }
                }
            } catch (err) {
                console.error("Error fetching santri data:", err);
                setError("Terjadi kesalahan saat mengambil data santri");
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchSantriData();
    }, [user, santriName]);
    
    // Fetch payment data for the santri using Cloud Function
    const fetchPayments = async (santriId: string) => {
        try {
            setIsLoading(true);
            const getSantriPaymentHistory = httpsCallable(functions, 'getSantriPaymentHistory');
            const result = await getSantriPaymentHistory({ santriId });
            
            const paymentList = result.data as PaymentStatus[];
            
            // Sort payments by timestamp (newest first)
            setPayments(paymentList.sort((a, b) => b.timestamp - a.timestamp));
        } catch (err) {
            console.error("Error fetching payments:", err);
            setError("Gagal mengambil data pembayaran. Silakan coba lagi nanti.");
            setPayments([]);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Refresh payments after a new payment is submitted
    const handlePaymentComplete = () => {
        setIsLoading(true); // Show loading state immediately
        if (user?.santriId) {
            fetchPayments(user.santriId);
        } else if (santriData?.id) {
            fetchPayments(santriData.id);
        }
    };
    
    // Helper function to determine payment status
    const getPaymentStatusClass = (status: string) => {
        switch (status) {
            case 'Lunas':
                return 'bg-green-100 text-green-600';
            case 'Menunggu Verifikasi':
                return 'bg-orange-200 text-orange-700';
            default:
                return 'bg-red-100 text-red-600';
        }
    };

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    const [isSmallScreen, setIsSmallScreen] = useState(false);
    
    useEffect(() => {
        const checkScreenSize = () => {
            setIsSmallScreen(window.innerWidth < 830);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);

        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    const handleOpenPaymentModal = (id: string) => {
        setSelectedPayment(id);
        setShowPaymentModal(true);
    };
    
    const handleOpenStatusModal = (id: string) => {
        setSelectedPayment(id);
        setShowStatusModal(true);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="container mx-auto py-6 px-4">
            <h1 className="text-2xl font-bold mb-6">
                History Pembayaran {santriName || (santriData?.nama || 'Santri')}
            </h1>
            
            {isLoading ? (
                <div className="space-y-4">
                    {/* Shimmer loading animation for payment cards */}
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="invoice-card max-w-full border border-gray-200 rounded-lg p-4 bg-white shadow-lg">
                            {isSmallScreen ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="col-span-1 md:col-span-1 w-[75%]">
                                        <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse mb-2"></div>
                                        <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                    <div className="flex flex-col justify-end items-end">
                                        <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse mb-3"></div>
                                        <div className="h-10 w-20 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4 items-center">
                                    <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse mb-1"></div>
                                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-1"></div>
                                    </div>
                                    <div className="flex justify-end">
                                        <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                    <span className="block sm:inline">{error}</span>
                </div>
            ) : payments.length === 0 ? (
                <div className="bg-white shadow-lg rounded-lg p-6 text-center">
                    <p className="text-gray-700 mb-4">Belum ada riwayat pembayaran</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {payments.map((payment) => (
                        <div
                            key={payment.id}
                            className="invoice-card max-w-full border border-gray-200 rounded-lg p-4 bg-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] transform"
                        >
                            {isSmallScreen ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="col-span-1 md:col-span-1 w-[75%]">
                                        <div className="text-base font-medium truncate mb-2">{payment.paymentName}</div>
                                        <div className="text-sm text-gray-600">
                                            {formatCurrency(payment.paid)} / {formatCurrency(payment.total)}
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-end items-end">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium mb-3 ${getPaymentStatusClass(payment.status)}`}>
                                        {payment.status}
                                    </span>

                                        {payment.status === 'Belum Lunas' ? (
                                            <div className="flex flex-col space-y-2">
                                                <button
                                                    className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                    onClick={() => handleOpenPaymentModal(payment.id)}
                                                >
                                                    Bayar
                                                </button>
                                                <button
                                                    className="text-blue-600 text-sm hover:underline"
                                                    onClick={() => handleOpenStatusModal(payment.id)}
                                                >
                                                    Lihat Riwayat
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                onClick={() => handleOpenStatusModal(payment.id)}
                                            >
                                                Lihat Detail
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4 items-center">
                                    <div className="text-base font-medium truncate">{payment.paymentName}</div>

                                    <div className="flex flex-col items-center justify-center">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium mb-1 ${getPaymentStatusClass(payment.status)}`}>
                                        {payment.status}
                                    </span>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {formatCurrency(payment.paid)} / {formatCurrency(payment.total)}
                                        </div>
                                    </div>

                                    <div className="button-container flex justify-end">
                                        {payment.status === 'Belum Lunas' ? (
                                            <div className="flex flex-col space-y-2">
                                                <button
                                                    className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                    onClick={() => handleOpenPaymentModal(payment.id)}
                                                >
                                                    Bayar
                                                </button>
                                                <button
                                                    className="text-blue-600 text-sm hover:underline"
                                                    onClick={() => handleOpenStatusModal(payment.id)}
                                                >
                                                    Lihat Riwayat
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                onClick={() => handleOpenStatusModal(payment.id)}
                                            >
                                                Lihat Detail
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showPaymentModal &&
                <PaymentModal
                    closeModal={() => setShowPaymentModal(false)}
                    paymentId={selectedPayment}
                    isMobile={isMobile}
                    onPaymentComplete={handlePaymentComplete}
                />
            }

            {showStatusModal &&
                <PaymentStatusModal
                    closeModal={() => setShowStatusModal(false)}
                    paymentId={selectedPayment}
                    isMobile={isMobile}
                />
            }
        </div>
    );
}