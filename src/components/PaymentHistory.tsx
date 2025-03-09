"use client";
import PaymentModal from './PaymentModal';
import PaymentStatusModal from './PaymentStatusModal';
import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useAuth } from '../firebase/auth';

export default function PaymentHistory() {
    const { user, santriName } = useAuth();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [santriData, setSantriData] = useState<any>(null);
    const [payments, setPayments] = useState<any[]>([]);
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
    
    // Fetch payment data for the santri
    const fetchPayments = async (santriId: string) => {
        try {
            const paymentsRef = collection(db, "PembayaranCollection");
            const q = query(paymentsRef, where("santriId", "==", santriId));
            
            const querySnapshot = await getDocs(q);
            
            const paymentList = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.nama,
                    paid: data.jumlahDibayar || 0,
                    total: data.jumlahTotal,
                    status: getPaymentStatus(data.jumlahDibayar, data.jumlahTotal, data.statusVerifikasi),
                    history: data.historyPembayaran || []
                };
            });
            
            setPayments(paymentList.length > 0 ? paymentList : dummyPayments);
        } catch (err) {
            console.error("Error fetching payments:", err);
            setPayments(dummyPayments); // Fallback to dummy data
        }
    };
    
    // Helper function to determine payment status
    const getPaymentStatus = (paid: number, total: number, verificationStatus?: string) => {
        if (paid === 0) return "Belum Lunas";
        if (paid < total) {
            if (verificationStatus === "pending") return "Menunggu Verifikasi";
            return "Belum Lunas";
        }
        return "Lunas";
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

    // Dummy payment data for fallback
    const dummyPayments = [
        { 
            id: 1, 
            name: 'Syariyah Januari', 
            paid: 1000000, 
            total: 1000000, 
            status: 'Lunas',
            history: [
                { 
                    id: 1, 
                    date: '2023-01-15 14:30', 
                    type: 'Bayar Lunas', 
                    status: 'Terverifikasi',
                    imageUrl: 'https://via.placeholder.com/300x400'
                }
            ]
        },
        { 
            id: 2, 
            name: 'Syariyah Februari', 
            paid: 0, 
            total: 1000000, 
            status: 'Belum Lunas',
            history: []
        },
        { 
            id: 3, 
            name: 'Syariyah Maret', 
            paid: 500000, 
            total: 1000000, 
            status: 'Menunggu Verifikasi',
            history: [
                { 
                    id: 1, 
                    date: '2023-03-20 10:30', 
                    type: 'Bayar Sebagian', 
                    amount: 500000,
                    status: 'Menunggu Verifikasi',
                    imageUrl: 'https://via.placeholder.com/300x400' 
                }
            ]
        },
        { 
            id: 4, 
            name: 'Syariyah April', 
            paid: 0, 
            total: 800000, 
            status: 'Belum Lunas',
            history: []
        },
        { 
            id: 5, 
            name: 'Syariyah Mei', 
            paid: 300000, 
            total: 800000, 
            status: 'Belum Lunas',
            history: [
                { 
                    id: 1, 
                    date: '2023-05-05 16:45', 
                    type: 'Bayar Sebagian', 
                    amount: 300000,
                    status: 'Terverifikasi',
                    imageUrl: 'https://via.placeholder.com/300x400' 
                },
                { 
                    id: 2, 
                    date: '2023-05-01 09:30', 
                    type: 'Bayar Sebagian', 
                    amount: 200000,
                    status: 'Ditolak',
                    imageUrl: 'https://via.placeholder.com/300x400',
                    note: 'Bukti pembayaran tidak jelas. Mohon kirim ulang dengan resolusi yang lebih baik.'
                }
            ]
        },
        { 
            id: 6, 
            name: 'Dana Pengembangan', 
            paid: 2000000, 
            total: 2000000, 
            status: 'Lunas',
            history: [
                { 
                    id: 1, 
                    date: '2023-02-10 11:15', 
                    type: 'Bayar Lunas', 
                    status: 'Terverifikasi',
                    imageUrl: 'https://via.placeholder.com/300x400'
                }
            ]
        },
    ];

    const handleOpenPaymentModal = (id: number) => {
        setSelectedPayment(id);
        setShowPaymentModal(true);
    };
    
    const handleOpenStatusModal = (id: number) => {
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
                History Pembayaran {santriName || 'Santri'}
            </h1>
            
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                    <span className="block sm:inline">{error}</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {payments.map((payment) => (
                        <div
                            key={payment.id}
                            className="invoice-card max-w-full border border-gray-200 rounded-lg p-4 bg-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.03] transform"
                        >
                            {isSmallScreen ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="col-span-1 md:col-span-1 w-[75%]">
                                        <div className="text-base font-medium truncate mb-2">{payment.name}</div>
                                        <div className="text-sm text-gray-600">
                                            {formatCurrency(payment.paid)} / {formatCurrency(payment.total)}
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-end items-end">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium mb-3 ${
                                        payment.status === 'Lunas'
                                            ? 'bg-green-100 text-green-600'
                                            : payment.status === 'Menunggu Verifikasi'
                                                ? 'bg-orange-200 text-orange-700'
                                                : 'bg-red-100 text-red-600'
                                    }`}>
                                        {payment.status}
                                    </span>

                                        {payment.status === 'Belum Lunas' ? (
                                            <button
                                                className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                onClick={() => handleOpenPaymentModal(payment.id)}
                                            >
                                                Bayar
                                            </button>
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
                                    <div className="text-base font-medium truncate">{payment.name}</div>

                                    <div className="flex flex-col items-center justify-center">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium mb-1 ${
                                        payment.status === 'Lunas'
                                            ? 'bg-green-100 text-green-600'
                                            : payment.status === 'Menunggu Verifikasi'
                                                ? 'bg-orange-200 text-orange-700'
                                                : 'bg-red-100 text-red-600'
                                    }`}>
                                        {payment.status}
                                    </span>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {formatCurrency(payment.paid)} / {formatCurrency(payment.total)}
                                        </div>
                                    </div>

                                    <div className="button-container">
                                        {payment.status === 'Belum Lunas' ? (
                                            <button
                                                className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                onClick={() => handleOpenPaymentModal(payment.id)}
                                            >
                                                Bayar
                                            </button>
                                        ) : (
                                            <button
                                                className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                                                onClick={() => handleOpenStatusModal(payment.id)}
                                            >
                                                Lihat Status
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