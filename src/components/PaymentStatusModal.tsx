"use client";
import { useState, useEffect } from 'react';

interface PaymentStatusModalProps {
    closeModal: () => void;
    paymentId: number | null;
    isMobile: boolean;
}

interface PaymentHistoryItem {
    id: number;
    date: string;
    type: 'Bayar Lunas' | 'Bayar Sebagian';
    amount?: number;
    status: 'Terverifikasi' | 'Menunggu Verifikasi' | 'Ditolak';
    imageUrl: string;
    note?: string;
}

interface Payment {
    id: number;
    name: string;
    paid: number;
    total: number;
    status: string;
    history: PaymentHistoryItem[];
}

export default function PaymentStatusModal({ closeModal, paymentId, isMobile }: PaymentStatusModalProps) {
    const [modalClass, setModalClass] = useState('');
    const [expandedItem, setExpandedItem] = useState<number | null>(null);

    // Payments data with embedded history
    const payments: Payment[] = [
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
    
    const payment = payments.find(p => p.id === paymentId) || payments[0];

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

    const toggleExpand = (id: number) => {
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
                    <h3 className="text-xl font-medium">Status {payment.name}</h3>
                    {!isMobile && (
                        <button onClick={resetAndClose} className="text-text-light hover:text-text">
                            ✕
                        </button>
                    )}
                </div>

                <div className="text-gray-600 mb-4">
                    Total: {formatCurrency(payment.total)} • Dibayar: {formatCurrency(payment.paid)} • Sisa: {formatCurrency(payment.total - payment.paid)}
                </div>

                <div className="max-h-[70vh] overflow-y-auto pr-2 modal-scroll">
                    {payment.history.length > 0 ? (
                        <div className="space-y-4">
                            {payment.history.map((item) => (
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
                                    </div>
                                    
                                    {expandedItem === item.id && (
                                        <div className="mt-4 pt-3 border-t border-gray-200">
                                            {item.note && (
                                                <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-md">
                                                    <p className="font-medium mb-1">Catatan:</p>
                                                    <p>{item.note}</p>
                                                </div>
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