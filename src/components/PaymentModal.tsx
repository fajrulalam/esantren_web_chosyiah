"use client";
import { useState, useEffect } from 'react';

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

interface PaymentModalProps {
    closeModal: () => void;
    paymentId: number | null;
    isMobile: boolean;
}

export default function PaymentModal({ closeModal, paymentId, isMobile }: PaymentModalProps) {
    const [isPartial, setIsPartial] = useState(false);
    const [amount, setAmount] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [modalClass, setModalClass] = useState('');

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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    useEffect(() => {
        if (isMobile) {
            setModalClass('transform translate-y-full');
            setTimeout(() => {
                setModalClass('transform translate-y-0');
            }, 10);
        }
    }, [isMobile]);

    const [error, setError] = useState('');
    
    const handlePayment = () => {
        // Reset error message
        setError('');
        
        // Validate form
        if (!image) {
            setError('Silakan pilih bukti pembayaran');
            return;
        }
        
        if (isPartial && (!amount || amount === '0')) {
            setError('Silakan masukkan jumlah pembayaran');
            return;
        }

        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            closeModal();
        }, 1500); // Simulate upload
    };

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
        setIsPartial(false);
        setAmount('');
        setImage(null);
        setError('');
        handleClose();
    };

    const containerClass = isMobile ? `modal-mobile ${modalClass}` : 'modal-desktop';

    return (
        <div className={containerClass}>
            {!isMobile && (
                <div className="absolute inset-0" onClick={resetAndClose}></div>
            )}

            <div className={isMobile ? 'w-full rounded-t-xl shadow-lg bg-gray-50 ' : 'modal-content rounded-lg shadow-lg bg-gray-50'} onClick={(e) => e.stopPropagation()}>
                {isMobile && (
                    <div className="w-16 h-1 bg-gray-50  rounded-full mx-auto mb-4"></div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium">Bayar {payment.name}</h3>
                    {!isMobile && (
                        <button onClick={resetAndClose} className="text-text-light hover:text-text">
                            ✕
                        </button>
                    )}
                </div>

                <div className="mb-6">
                    <div className="text-gray-600 mb-2">
                        Total: {formatCurrency(payment.total)} • Dibayar: {formatCurrency(payment.paid)} • Sisa: {formatCurrency(payment.total - payment.paid)}
                    </div>
                    <label className="block text-text-light mb-2">Jenis Pembayaran</label>
                    <div className="flex items-center space-x-4">
                        <button
                            className={`w-1/2 py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                !isPartial ? 'bg-blue-600 text-white border border-blue-600 focus:ring-blue-500' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
                            }`}
                            onClick={() => setIsPartial(false)}
                            type="button"
                        >
                            Bayar Lunas
                        </button>
                        <button
                            className={`w-1/2 py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                isPartial ? 'bg-blue-600 text-white border border-blue-600 focus:ring-blue-500' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
                            }`}
                            onClick={() => setIsPartial(true)}
                            type="button"
                        >
                            Bayar Sebagian
                        </button>
                    </div>
                </div>

                {isPartial && (
                    <div className="mb-6">
                        <label className="block text-text-light mb-2">Jumlah Pembayaran</label>
                        <input
                            type="number"
                            className="w-full p-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Masukkan jumlah"
                        />
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-text-light mb-2">Bukti Pembayaran</label>
                    <div className="relative">
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-all duration-200">
                            {image ? (
                                <div className="text-text">
                                    <img src={URL.createObjectURL(image)} alt="Bukti Pembayaran" className="w-32 h-32 mx-auto mb-3 rounded-md" />
                                    <p className="mb-1">File dipilih:</p>
                                    <p className="font-medium">{image.name}</p>
                                    <button
                                        className="mt-2 text-danger hover:underline text-sm inline-flex items-center"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setImage(null);
                                        }}
                                    >
                                        <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        Hapus
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <svg className="w-10 h-10 mx-auto mb-3 text-text-light" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <p className="text-text-light mb-1">Klik untuk memilih file</p>
                                    <p className="text-xs text-text-light">Maksimal 5MB (JPG, PNG, PDF)</p>
                                </div>
                            )}
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => setImage(e.target.files ? e.target.files[0] : null)}
                                accept=".jpg,.jpeg,.png,.pdf"
                            />
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md border border-red-300">
                        {error}
                    </div>
                )}
                
                <div className="button-container">
                    <button
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded font-medium transition-all duration-200 hover:bg-gray-100"
                        onClick={resetAndClose}
                        disabled={loading}
                    >
                        Batal
                    </button>
                    <button
                        className="px-4 py-2 bg-blue-600 text-white rounded font-medium transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        onClick={handlePayment}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Mengirim...
                            </span>
                        ) : (
                            'Kirim Bukti'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}