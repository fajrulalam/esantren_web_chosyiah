"use client";
import { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, getDoc, updateDoc, setDoc, arrayUnion, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '../firebase/auth';
import { PaymentStatus, PaymentHistoryItem } from '@/types/santri';

interface PaymentModalProps {
    closeModal: () => void;
    paymentId: string | null;
    isMobile: boolean;
    onPaymentComplete?: () => void;
}

export default function PaymentModal({ closeModal, paymentId, isMobile, onPaymentComplete }: PaymentModalProps) {
    const { user, santriName } = useAuth();
    const [isPartial, setIsPartial] = useState(false);
    const [amount, setAmount] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [modalClass, setModalClass] = useState('');
    const [error, setError] = useState('');
    const [paymentData, setPaymentData] = useState<PaymentStatus | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string>('transfer');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch payment data
    useEffect(() => {
        const fetchPaymentData = async () => {
            if (!paymentId) return;
            
            try {
                const paymentDoc = doc(db, "PaymentStatuses", paymentId);
                const paymentSnapshot = await getDoc(paymentDoc);
                
                if (paymentSnapshot.exists()) {
                    // Include the document ID in the payment data
                    const data = paymentSnapshot.data() as PaymentStatus;
                    setPaymentData({
                        ...data,
                        id: paymentSnapshot.id // Add the document ID
                    });
                    
                    // If it's a partial payment already, default to partial
                    if (data.paid > 0 && data.paid < data.total) {
                        setIsPartial(true);
                    }
                } else {
                    setError("Data pembayaran tidak ditemukan");
                }
            } catch (err) {
                console.error("Error fetching payment data:", err);
                setError("Terjadi kesalahan saat mengambil data pembayaran");
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

    useEffect(() => {
        // Set default amount for full payment if not partial
        if (paymentData && !isPartial) {
            setAmount(String(paymentData.total - paymentData.paid));
        } else if (paymentData && isPartial && amount === '') {
            // Clear amount if switching to partial
            setAmount('');
        }
    }, [isPartial, paymentData]);

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            setError('Ukuran file terlalu besar. Maksimal 5MB.');
            return;
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Format file tidak didukung. Gunakan JPG, PNG, atau PDF.');
            return;
        }

        setImage(file);
        
        // Generate preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            // Use a placeholder for PDFs
            setImagePreview('/file.svg');
        }
    };

    const uploadPaymentProof = async (file: File, santriId: string, paymentId: string): Promise<string> => {
        if (!file) throw new Error('No file provided');
        
        const sanitizedSantriName = santriName?.replace(/\s+/g, '_').toLowerCase() || 'unknown_santri';
        const paymentName = paymentData?.paymentName?.replace(/\s+/g, '_').toLowerCase() || 'unknown_payment';
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        
        // Create a reference to the storage location
        const storageRef = ref(storage, `payment_proofs/${sanitizedSantriName}/${paymentName}_${timestamp}.${fileExtension}`);
        
        // Upload the file
        const uploadResult = await uploadBytes(storageRef, file);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);
        
        return downloadURL;
    };

    const updateSantriStatus = async (santriId: string) => {
        const santriRef = doc(db, "SantriCollection", santriId);
        await updateDoc(santriRef, {
            statusTanggungan: "Menunggu Verifikasi"
        });
    };

    const handlePayment = async () => {
        // Reset error message
        setError('');
        
        // Basic validation
        if (!paymentData) {
            setError('Data pembayaran tidak valid');
            return;
        }
        
        if (!image) {
            setError('Silakan pilih bukti pembayaran');
            return;
        }
        
        // Parse amount - remove any non-numeric characters (like dots for thousand separators)
        const numericAmount = amount.replace(/\./g, '').replace(/[^\d]/g, '');
        const paymentAmount = isPartial ? parseInt(numericAmount, 10) : (paymentData.total - paymentData.paid);
        
        if (isPartial && (!numericAmount || parseInt(numericAmount, 10) <= 0)) {
            setError('Silakan masukkan jumlah pembayaran yang valid');
            return;
        }
        
        if (isPartial && parseInt(numericAmount, 10) > (paymentData.total - paymentData.paid)) {
            setError(`Jumlah maksimal yang dapat dibayarkan adalah ${formatCurrency(paymentData.total - paymentData.paid)}`);
            return;
        }

        try {
            setLoading(true);
            
            // Upload the image to Firebase Storage
            const imageUrl = await uploadPaymentProof(image, paymentData.santriId, paymentData.id);
            
            // Create the payment history item
            const historyItem: PaymentHistoryItem = {
                id: `payment_${Date.now()}`,
                date: new Date().toISOString(),
                type: isPartial ? 'Bayar Sebagian' : 'Bayar Lunas',
                amount: paymentAmount,
                status: 'Menunggu Verifikasi',
                imageUrl: imageUrl,
                paymentMethod: paymentMethod,
                inputtedBy: user?.name || santriName || 'Wali Santri'
            };
            
            // Make sure we have a valid payment ID
            if (!paymentData || !paymentData.id) {
                throw new Error("Payment ID is missing. Cannot update payment status.");
            }
            
            // Update the payment status document
            const paymentRef = doc(db, "PaymentStatuses", paymentData.id);
            
            // Update with the new payment history
            const historyUpdate = {};
            historyUpdate[`history.${historyItem.id}`] = historyItem;
            
            // Don't update the 'paid' field yet - wait until verification
            // Just update status and add to history
            await updateDoc(paymentRef, {
                status: 'Menunggu Verifikasi',
                // Keep paid amount as is until verification
                ...historyUpdate
            });
            
            // Update santri status to "Menunggu Verifikasi"
            await updateSantriStatus(paymentData.santriId);
            
            // Update invoice counters to increment numberOfWaitingVerification
            if (paymentData.invoiceId) {
                const invoiceRef = doc(db, "Invoices", paymentData.invoiceId);
                await updateDoc(invoiceRef, {
                    numberOfWaitingVerification: increment(1)
                });
            }
            
            // Record the payment activity
            if (paymentData.kodeAsrama) {
                const activityRef = collection(db, "AktivitasCollection", paymentData.kodeAsrama, "PembayaranLogs");
                await setDoc(doc(activityRef), {
                    type: "pembayaran_baru",
                    paymentId: paymentData.id,
                    invoiceId: paymentData.invoiceId,
                    santriId: paymentData.santriId,
                    santriName: paymentData.nama,
                    paymentName: paymentData.paymentName,
                    amount: paymentAmount,
                    timestamp: serverTimestamp(),
                    status: "menunggu_verifikasi"
                });
            }
            
            setLoading(false);
            if (onPaymentComplete) onPaymentComplete();
            resetAndClose();
        } catch (err) {
            console.error("Error processing payment:", err);
            // Provide more specific error message if available
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Terjadi kesalahan saat memproses pembayaran: ${errorMessage}. Silakan coba lagi.`);
            setLoading(false);
        }
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
        setImagePreview(null);
        setError('');
        handleClose();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const containerClass = isMobile ? `modal-mobile ${modalClass}` : 'modal-desktop';

    return (
        <div className={containerClass}>
            {!isMobile && (
                <div className="absolute inset-0" onClick={resetAndClose}></div>
            )}

            <div className={isMobile ? 'w-full rounded-t-xl shadow-lg bg-gray-50 z-30' : 'modal-content rounded-lg shadow-lg bg-gray-50 z-30'} onClick={(e) => e.stopPropagation()}>
                {isMobile && (
                    <div className="w-16 h-1 bg-gray-300 rounded-full mx-auto mb-4"></div>
                )}

                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-medium">
                        {paymentData ? `Bayar ${paymentData.paymentName}` : 'Pembayaran'}
                    </h3>
                    {!isMobile && (
                        <button onClick={resetAndClose} className="text-text-light hover:text-text">
                            ✕
                        </button>
                    )}
                </div>

                {paymentData ? (
                    <div className="mb-6">
                        <div className="text-gray-600 mb-2">
                            Total: {formatCurrency(paymentData.total)} • 
                            Dibayar: {formatCurrency(paymentData.paid)} • 
                            Sisa: {formatCurrency(paymentData.total - paymentData.paid)}
                        </div>
                        <label className="block text-text-light mb-2">Jenis Pembayaran</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                className={`w-full py-3 px-4 rounded-md font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    !isPartial ? 'bg-blue-600 text-white border border-blue-600 focus:ring-blue-500' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
                                }`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsPartial(false);
                                }}
                                type="button"
                            >
                                Bayar Lunas
                            </button>
                            {/*<button*/}
                            {/*    className={`w-full py-2 px-4 rounded-md transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 text-sm ${*/}
                            {/*        isPartial ? 'bg-gray-200 text-gray-800 border border-gray-300 focus:ring-gray-400' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 focus:ring-gray-300'*/}
                            {/*    }`}*/}
                            {/*    onClick={(e) => {*/}
                            {/*        e.preventDefault(); */}
                            {/*        e.stopPropagation();*/}
                            {/*        setIsPartial(true);*/}
                            {/*    }}*/}
                            {/*    type="button"*/}
                            {/*>*/}
                            {/*    Bayar Sebagian*/}
                            {/*</button>*/}
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {isPartial && (
                    <div className="mb-6">
                        <label className="block text-text-light mb-2">Jumlah Pembayaran</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500">Rp</span>
                            </div>
                            <input
                                type="text"
                                inputMode="numeric"
                                className="w-full p-3 pl-10 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                                value={amount}
                                onChange={(e) => {
                                    // Remove all non-numeric characters
                                    const value = e.target.value.replace(/[^\d]/g, '');
                                    
                                    // Don't allow empty input
                                    if (value === '') {
                                        setAmount('');
                                        return;
                                    }
                                    
                                    // Parse as number
                                    const numValue = parseInt(value, 10);
                                    
                                    // Ensure it doesn't exceed remaining amount
                                    if (paymentData && numValue > (paymentData.total - paymentData.paid)) {
                                        // If exceeds, set to max remaining amount
                                        const maxAmount = paymentData.total - paymentData.paid;
                                        const formattedMax = new Intl.NumberFormat('id-ID').format(maxAmount);
                                        setAmount(formattedMax);
                                        return;
                                    }
                                    
                                    // Format with thousand separators
                                    const formattedValue = new Intl.NumberFormat('id-ID').format(numValue);
                                    setAmount(formattedValue);
                                }}
                                placeholder="Masukkan jumlah"
                            />
                        </div>
                        {paymentData && (
                            <p className="mt-1 text-sm text-gray-500">
                                Sisa yang harus dibayar: {formatCurrency(paymentData.total - paymentData.paid)}
                            </p>
                        )}
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-text-light mb-2">Metode Pembayaran</label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            className={`py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                                paymentMethod === 'transfer' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => setPaymentMethod('transfer')}
                            type="button"
                        >
                            Transfer Bank
                        </button>
                        <button
                            className={`py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                                paymentMethod === 'ewallet' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => setPaymentMethod('ewallet')}
                            type="button"
                        >
                            E-Wallet
                        </button>
                        <button
                            className={`py-2 px-4 rounded-md font-medium transition-all duration-200 ${
                                paymentMethod === 'cash' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                            onClick={() => setPaymentMethod('cash')}
                            type="button"
                        >
                            Tunai
                        </button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-text-light mb-2">Bukti Pembayaran</label>
                    <div className="relative">
                        <div 
                            className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-all duration-200"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {imagePreview ? (
                                <div className="text-text">
                                    <img 
                                        src={imagePreview} 
                                        alt="Bukti Pembayaran" 
                                        className="w-32 h-32 mx-auto mb-3 rounded-md object-contain" 
                                    />
                                    <p className="mb-1">File dipilih:</p>
                                    <p className="font-medium">{image?.name}</p>
                                    <button
                                        className="mt-2 text-danger hover:underline text-sm inline-flex items-center"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setImage(null);
                                            setImagePreview(null);
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
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
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
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
                        disabled={loading || !paymentData}
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