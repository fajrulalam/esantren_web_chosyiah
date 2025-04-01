"use client";
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Santri } from '@/types/santri';

interface SantriVerificationModalProps {
    closeModal: () => void;
    santriId: string | null;
    isMobile: boolean;
    onVerificationComplete: () => void;
}

export default function SantriVerificationModal({ 
    closeModal, 
    santriId, 
    isMobile, 
    onVerificationComplete 
}: SantriVerificationModalProps) {
    const [modalClass, setModalClass] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [santriData, setSantriData] = useState<Santri | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectForm, setShowRejectForm] = useState(false);

    // Fetch santri data
    useEffect(() => {
        const fetchSantriData = async () => {
            if (!santriId) return;
            
            try {
                setLoading(true);
                const santriDoc = doc(db, "SantriCollection", santriId);
                const santriSnapshot = await getDoc(santriDoc);
                
                if (santriSnapshot.exists()) {
                    const data = santriSnapshot.data() as Santri;
                    setSantriData({ id: santriSnapshot.id, ...data });
                } else {
                    setError("Data santri tidak ditemukan");
                }
            } catch (err) {
                console.error("Error fetching santri data:", err);
                setError("Terjadi kesalahan saat mengambil data santri");
            } finally {
                setLoading(false);
            }
        };
        
        fetchSantriData();
    }, [santriId]);

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
        handleClose();
    };

    const handleVerify = async () => {
        if (!santriId || !santriData) return;
        
        try {
            setVerifying(true);
            
            // Get kodeAsrama from santri data
            const kodeAsrama = santriData.kodeAsrama;
            
            // Update santri status to 'Aktif'
            const santriRef = doc(db, "SantriCollection", santriId);
            await updateDoc(santriRef, {
                statusAktif: 'Aktif',
                updatedAt: new Date()
            });
            
            // Increment the counter in Counters/activeSantri
            const counterRef = doc(db, "Counters", "activeSantri");
            await updateDoc(counterRef, {
                [kodeAsrama]: increment(1),
                lastUpdated: new Date()
            });
            
            onVerificationComplete();
            resetAndClose();
        } catch (err) {
            console.error("Error verifying santri:", err);
            setError("Terjadi kesalahan saat memverifikasi santri");
        } finally {
            setVerifying(false);
        }
    };

    const handleReject = async () => {
        if (!santriId || !santriData) return;
        
        try {
            setRejecting(true);
            
            // Update santri status to 'Ditolak'
            const santriRef = doc(db, "SantriCollection", santriId);
            await updateDoc(santriRef, {
                statusAktif: 'Ditolak',
                rejectReason: rejectReason,
                updatedAt: new Date()
            });
            
            onVerificationComplete();
            resetAndClose();
        } catch (err) {
            console.error("Error rejecting santri:", err);
            setError("Terjadi kesalahan saat menolak pendaftaran santri");
        } finally {
            setRejecting(false);
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
                        Verifikasi Pendaftaran Santri
                    </h3>
                    {!isMobile && (
                        <button onClick={resetAndClose} className="text-gray-500 hover:text-gray-700">
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
                ) : santriData ? (
                    <>
                        <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                            <h4 className="font-semibold text-lg mb-2">Data Pendaftar</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Nama Lengkap</p>
                                    <p className="font-medium">{santriData.nama}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Email</p>
                                    <p className="font-medium">{santriData.email}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Tempat, Tanggal Lahir</p>
                                    <p className="font-medium">{santriData.tempatLahir}, {santriData.tanggalLahir}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Nama Orang Tua</p>
                                    <p className="font-medium">{santriData.namaOrangTua || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Alamat Rumah</p>
                                    <p className="font-medium">{santriData.alamatRumah || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Program Studi</p>
                                    <p className="font-medium">{santriData.programStudi || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Sekolah Asal</p>
                                    <p className="font-medium">{santriData.sekolahAsal || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Tipe Pembayaran</p>
                                    <p className="font-medium">
                                        {santriData.paymentOption === 'pangkalOnly' 
                                            ? 'Uang Pangkal Saja'
                                            : 'Uang Pangkal + Syahriah 6 Bulan'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Nomor Telepon Santri</p>
                                    <p className="font-medium">{santriData.nomorTelpon || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Nomor Telepon Orang Tua</p>
                                    <p className="font-medium">{santriData.nomorWalisantri || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Payment Proof */}
                        {santriData.paymentProofUrl && (
                            <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
                                <h4 className="font-semibold text-lg mb-2">Bukti Pembayaran</h4>
                                <div className="mt-2 flex justify-center">
                                    {/* Using next/image for optimization */}
                                    <a href={santriData.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="block">
                                        <img 
                                            src={santriData.paymentProofUrl} 
                                            alt="Bukti Pembayaran" 
                                            className="max-w-full h-auto max-h-[300px] rounded-lg shadow-sm border border-gray-200" 
                                        />
                                    </a>
                                </div>
                            </div>
                        )}

                        {showRejectForm ? (
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Alasan Penolakan
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Masukkan alasan penolakan..."
                                />
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setShowRejectForm(false)}
                                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={rejecting || !rejectReason.trim()}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                                    >
                                        {rejecting ? 'Memproses...' : 'Konfirmasi Penolakan'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <button
                                    onClick={handleVerify}
                                    disabled={verifying}
                                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
                                >
                                    {verifying ? 'Memproses...' : 'Terima Pendaftaran'}
                                </button>
                                <button
                                    onClick={() => setShowRejectForm(true)}
                                    disabled={verifying || rejecting}
                                    className="flex-1 px-4 py-3 bg-white border border-red-600 text-red-600 rounded-md hover:bg-red-50 disabled:text-red-300 disabled:border-red-300 disabled:cursor-not-allowed"
                                >
                                    Tolak Pendaftaran
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-6 text-gray-500">
                        Data santri tidak tersedia
                    </div>
                )}

                <div className="mt-6 button-container">
                    <button
                        className="border border-gray-300 bg-white text-gray-700 font-medium px-4 py-2 rounded-md hover:bg-gray-50 transition-all duration-300"
                        onClick={resetAndClose}
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}