"use client";
import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { PaymentStatus, PaymentHistoryItem } from '@/types/santri';

interface PaymentStatusModalProps {
    closeModal: () => void;
    paymentId: string | null;
    isMobile: boolean;
}

export default function PaymentStatusModal({ closeModal, paymentId, isMobile }: PaymentStatusModalProps) {
    const [modalClass, setModalClass] = useState('');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentData, setPaymentData] = useState<PaymentStatus | null>(null);
    const [historyItems, setHistoryItems] = useState<PaymentHistoryItem[]>([]);

    // Fetch payment data
    useEffect(() => {
        const fetchPaymentData = async () => {
            if (!paymentId) return;
            
            try {
                setLoading(true);
                const paymentDoc = doc(db, "PaymentStatuses", paymentId);
                const paymentSnapshot = await getDoc(paymentDoc);
                
                if (paymentSnapshot.exists()) {
                    const data = paymentSnapshot.data() as PaymentStatus;
                    setPaymentData(data);
                    
                    // Convert history object to array and sort by date (newest first)
                    const historyArray = data.history ? 
                        Object.values(data.history).sort((a, b) => 
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        ) : [];
                    
                    setHistoryItems(historyArray);
                } else {
                    setError("Data pembayaran tidak ditemukan");
                }
            } catch (err) {
                console.error("Error fetching payment data:", err);
                setError("Terjadi kesalahan saat mengambil data pembayaran");
            } finally {
                setLoading(false);
            }
        };
        
        fetchPaymentData();
    }, [paymentId]);

    useEffect(() => {
        if (isMobile) {
            setModalClass('transform translate-y-full');
            setTimeout(() => {
                setModalClass('transform translate-y-0');
            }, 10);
        }
    }, [isMobile]);

    const handleClose = () => {
        if (isMobile) {
            setModalClass('transform translate-y-full');
            setTimeout(() => {
                closeModal();
            }, 300);
        } else {
            closeModal();
        }
    };

    const resetAndClose = () => {
        setExpandedItem(null);
        handleClose();
    };

    const toggleExpand = (id: string) => {
        if (expandedItem === id) {
            setExpandedItem(null);
        } else {
            setExpandedItem(id);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getPaymentMethodLabel = (method?: string) => {
        switch (method) {
            case 'transfer': return 'Transfer Bank';
            case 'ewallet': return 'E-Wallet';
            case 'cash': return 'Tunai';
            default: return 'Transfer Bank';
        }
    };

    const containerClass = isMobile ? `modal-mobile ${modalClass}` : 'modal-desktop';

    return (
        <div className={containerClass}>
            {!isMobile && (
                <div className="absolute inset-0" onClick={resetAndClose}></div>
            )}

            <div className={isMobile ? 'w-full rounded-t-xl shadow-lg bg-gray-50' : 'modal-content rounded-lg shadow-lg bg-gray-50'} onClick={(e) => e.stopPropagation()}>
                {isMobile && (
                    <div className="w-16 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium">
                        {paymentData ? `Status ${paymentData.paymentName}` : 'Status Pembayaran'}
                    </h3>
                    {!isMobile && (
                        <button onClick={resetAndClose} className="text-text-light hover:text-text">
                            ✕
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                        {error}
                    </div>
                ) : paymentData ? (
                    <>
                        <div className="text-gray-600 mb-4">
                            Total: {formatCurrency(paymentData.total)} • 
                            Dibayar: {formatCurrency(paymentData.paid)} • 
                            Sisa: {formatCurrency(paymentData.total - paymentData.paid)}
                        </div>
                        
                        <div className="max-h-[70vh] overflow-y-auto pr-2 modal-scroll">
                            {historyItems.length > 0 ? (
                                <div className="space-y-4">
                                    {historyItems.map((item) => (
                                        <div key={item.id} className="rounded-lg p-4 bg-white shadow-sm">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-medium text-gray-900">{formatDate(item.date)}</h4>
                                                    <div className="flex items-center mt-1">
                                                        <p className="text-gray-700">{item.type}</p>
                                                        {item.type === 'Bayar Sebagian' && item.amount && (
                                                            <span className="ml-2 text-gray-700">{formatCurrency(item.amount)}</span>
                                                        )}
                                                    </div>
                                                    {item.paymentMethod && (
                                                        <p className="text-gray-600 text-sm mt-1">
                                                            {getPaymentMethodLabel(item.paymentMethod)}
                                                        </p>
                                                    )}
                                                    <span className={`inline-block px-3 py-1 mt-2 rounded-full text-xs font-medium ${
                                                        item.status === 'Terverifikasi' 
                                                            ? 'bg-green-100 text-green-600' 
                                                            : item.status === 'Ditolak'
                                                                ? 'bg-red-100 text-red-600'
                                                                : 'bg-orange-100 text-orange-600'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                {/* Only show chevron if there's a payment image or details */}
                                                {(item.imageUrl || item.note || (item.status === 'Ditolak' && item.type)) && (
                                                    <button 
                                                        onClick={() => toggleExpand(item.id)}
                                                        className="text-gray-500 hover:text-gray-700"
                                                    >
                                                        <svg 
                                                            className={`w-6 h-6 transform transition-transform ${expandedItem === item.id ? 'rotate-180' : ''}`} 
                                                            xmlns="http://www.w3.org/2000/svg" 
                                                            fill="none" 
                                                            viewBox="0 0 24 24" 
                                                            stroke="currentColor"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {expandedItem === item.id && (
                                                <div className="mt-4 pt-3 border-t border-gray-200">
                                                    {item.note && (
                                                        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-md">
                                                            <p className="font-medium mb-1">Catatan:</p>
                                                            <p>{item.note}</p>
                                                        </div>
                                                    )}
                                                    {item.status === 'Ditolak' && item.type && (item.type === 'Penolakan Pembayaran' || item.type === 'Pembatalan Status Lunas') && (
                                                        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-md">
                                                            <p className="font-medium mb-1">Alasan {item.type === 'Penolakan Pembayaran' ? 'Penolakan' : 'Pembatalan'}:</p>
                                                            <p>{item.note || 'Tidak ada alasan dicantumkan'}</p>
                                                        </div>
                                                    )}
                                                    {item.inputtedBy && (
                                                        <p className="text-gray-600 mb-2">
                                                            Diinput oleh: {item.inputtedBy}
                                                        </p>
                                                    )}
                                                    <p className="text-gray-700 mb-2">Bukti Pembayaran:</p>
                                                    <img 
                                                        src={item.imageUrl} 
                                                        alt="Bukti Pembayaran" 
                                                        className="w-full max-w-xs mx-auto rounded-lg shadow-sm" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-500">
                                    Belum ada riwayat pembayaran
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-6 text-gray-500">
                        Data pembayaran tidak tersedia
                    </div>
                )}

                <div className="mt-6 button-container">
                    <button
                        className="border border-blue-600 bg-white text-blue-600 font-bold px-4 py-2 rounded hover:bg-blue-50 transition-all duration-300"
                        onClick={resetAndClose}
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}