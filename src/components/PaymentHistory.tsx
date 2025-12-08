"use client";
import PaymentModal from './PaymentModal';
import PaymentStatusModal from './PaymentStatusModal';
import { useState, useEffect, useRef } from 'react';
import { db, functions } from '../firebase/config';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
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
    const [showEmptyState, setShowEmptyState] = useState(false);
    const [santriData, setSantriData] = useState<any>(null);
    const [payments, setPayments] = useState<PaymentStatus[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    // Simple cache to prevent unnecessary refetches
    const cacheRef = useRef<{
        santriId?: string;
        data?: PaymentStatus[];
        timestamp?: number;
    }>({});
    
    // Optimized data fetching - combine santri and payment data fetching
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                if (!user) return;
                
                let santriId: string | null = null;
                let santriDocData: any = null;
                
                // Get santri ID and data efficiently
                if (user.role === 'waliSantri' && user.santriId) {
                    santriId = user.santriId;
                    // Fetch santri data in parallel with payment data
                    const santriDoc = doc(db, "SantriCollection", santriId);
                    const santriSnapshot = await getDoc(santriDoc);
                    
                    if (santriSnapshot.exists()) {
                        santriDocData = santriSnapshot.data();
                        setSantriData(santriDocData);
                    } else {
                        setError("Data santri tidak ditemukan");
                        return;
                    }
                } else if (santriName) {
                    // Query to find santri by name (optimized with proper casing)
                    const santriRef = collection(db, "SantriCollection");
                    const q = query(santriRef, where("nama", "==", santriName));
                    
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const docSnapshot = querySnapshot.docs[0];
                        santriId = docSnapshot.id;
                        santriDocData = docSnapshot.data();
                        setSantriData(santriDocData);
                    } else {
                        setError("Data santri tidak ditemukan");
                        return;
                    }
                }
                
                // Fetch payment data directly from Firestore (much faster than Cloud Function)
                if (santriId) {
                    await fetchPaymentsDirect(santriId);
                }
                
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Terjadi kesalahan saat mengambil data");
            } finally {
                setIsLoading(false);
                setShowEmptyState(true);
            }
        };
        
        fetchData();
    }, [user, santriName]);

    // Smart payment fetching - tries direct query first, falls back to cloud function
    const fetchPaymentsDirect = async (santriId: string, forceRefresh = false) => {
        try {
            // Check cache first (cache for 5 minutes)
            const now = Date.now();
            const cacheExpiry = 5 * 60 * 1000; // 5 minutes
            
            if (!forceRefresh && 
                cacheRef.current.santriId === santriId && 
                cacheRef.current.data && 
                cacheRef.current.timestamp && 
                (now - cacheRef.current.timestamp) < cacheExpiry) {
                
                setPayments(cacheRef.current.data);
                return;
            }
            
            let paymentList: PaymentStatus[] = [];
            
            // Try direct Firestore query first (faster)
            try {
                const paymentRef = collection(db, "PaymentStatuses");
                const q = query(
                    paymentRef,
                    where("santriId", "==", santriId),
                    orderBy("createdAt", "desc"),
                    limit(50)
                );
                
                const querySnapshot = await getDocs(q);
                
                querySnapshot.forEach((doc) => {
                    paymentList.push({
                        id: doc.id,
                        ...doc.data()
                    } as PaymentStatus);
                });
                
                // If direct query succeeded and returned data, use it
                if (paymentList.length > 0) {
                    console.log("Using direct Firestore query for payments");
                }
            } catch (directError) {
                console.warn("Direct query failed, falling back to cloud function:", directError);
                
                // Fallback to cloud function if direct query fails
                try {
                    const getSantriPaymentHistory = httpsCallable(functions, 'getSantriPaymentHistory');
                    const result = await getSantriPaymentHistory({ santriId });
                    paymentList = (result.data as any)?.paymentHistory || result.data as PaymentStatus[];
                    console.log("Using cloud function fallback for payments");
                } catch (cloudError) {
                    console.error("Cloud function also failed:", cloudError);
                    throw cloudError;
                }
            }
            
            // Update cache
            cacheRef.current = {
                santriId,
                data: paymentList,
                timestamp: now
            };
            
            setPayments(paymentList);
            
        } catch (err) {
            console.error("Error fetching payments:", err);
            setError("Gagal mengambil data pembayaran. Silakan coba lagi nanti.");
            setPayments([]);
        }
    };
    
    // Refresh payments after a new payment is submitted
    const handlePaymentComplete = async () => {
        setIsLoading(true);
        try {
            const santriId = user?.santriId || santriData?.id;
            if (santriId) {
                await fetchPaymentsDirect(santriId, true); // Force refresh after payment
            }
        } catch (err) {
            console.error("Error refreshing payments:", err);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Helper function to determine payment status
    const getPaymentStatusClass = (status: string) => {
        switch (status) {
            case 'Lunas':
                return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300';
            case 'Menunggu Verifikasi':
                return 'bg-orange-200 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
            default:
                return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300';
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
            <h1 className="text-2xl font-bold mb-6 dark:text-white">
                History Pembayaran {santriName || (santriData?.nama || 'Santri')}
            </h1>
            
            {isLoading || (!showEmptyState && payments.length === 0) ? (
                <div className="space-y-4">
                    {/* Shimmer loading animation for payment cards */}
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="invoice-card max-w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-lg">
                            {isSmallScreen ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="col-span-1 md:col-span-1 w-[75%]">
                                        <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                                        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                    </div>
                                    <div className="flex flex-col justify-end items-end">
                                        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mb-3"></div>
                                        <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4 items-center">
                                    <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mb-1"></div>
                                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
                                    </div>
                                    <div className="flex justify-end">
                                        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded relative mb-4">
                    <span className="block sm:inline">{error}</span>
                </div>
            ) : payments.length === 0 && showEmptyState ? (
                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 text-center">
                    <p className="text-gray-700 dark:text-gray-300 mb-4">Belum ada riwayat pembayaran</p>
                    <button 
                        onClick={() => {
                            const santriId = user?.santriId || santriData?.id;
                            if (santriId) {
                                setIsLoading(true);
                                fetchPaymentsDirect(santriId, true).finally(() => setIsLoading(false)); // Force refresh
                            }
                        }}
                        className="bg-blue-600 dark:bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-amber-700 transition-colors"
                    >
                        Muat Ulang Data
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {payments.map((payment) => (
                        <div
                            key={payment.id}
                            className="invoice-card max-w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] transform"
                        >
                            {isSmallScreen ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="col-span-1 md:col-span-1 w-[75%]">
                                        <div className="text-base font-medium truncate mb-2 dark:text-white">{payment.paymentName}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
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
                                                    className="border border-blue-600 dark:border-amber-500 bg-white dark:bg-gray-800 text-blue-600 dark:text-amber-500 font-bold px-4 py-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-300"
                                                    onClick={() => handleOpenPaymentModal(payment.id)}
                                                >
                                                    Bayar
                                                </button>
                                                <button
                                                    className="text-blue-600 dark:text-amber-500 text-sm hover:underline"
                                                    onClick={() => handleOpenStatusModal(payment.id)}
                                                >
                                                    Lihat Riwayat
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="border border-blue-600 dark:border-amber-500 bg-white dark:bg-gray-800 text-blue-600 dark:text-amber-500 font-bold px-4 py-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-300"
                                                onClick={() => handleOpenStatusModal(payment.id)}
                                            >
                                                Lihat Detail
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4 items-center">
                                    <div className="text-base font-medium truncate dark:text-white">{payment.paymentName}</div>

                                    <div className="flex flex-col items-center justify-center">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium mb-1 ${getPaymentStatusClass(payment.status)}`}>
                                        {payment.status}
                                    </span>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {formatCurrency(payment.paid)} / {formatCurrency(payment.total)}
                                        </div>
                                    </div>

                                    <div className="button-container flex justify-end">
                                        {payment.status === 'Belum Lunas' ? (
                                            <div className="flex flex-col space-y-2">
                                                <button
                                                    className="border border-blue-600 dark:border-amber-500 bg-white dark:bg-gray-800 text-blue-600 dark:text-amber-500 font-bold px-4 py-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-300"
                                                    onClick={() => handleOpenPaymentModal(payment.id)}
                                                >
                                                    Bayar
                                                </button>
                                                <button
                                                    className="text-blue-600 dark:text-amber-500 text-sm hover:underline"
                                                    onClick={() => handleOpenStatusModal(payment.id)}
                                                >
                                                    Lihat Riwayat
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                className="border border-blue-600 dark:border-amber-500 bg-white dark:bg-gray-800 text-blue-600 dark:text-amber-500 font-bold px-4 py-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-300"
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