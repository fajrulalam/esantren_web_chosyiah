"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { Santri } from "@/types/santri";

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
  onVerificationComplete,
}: SantriVerificationModalProps) {
  const [modalClass, setModalClass] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [santriData, setSantriData] = useState<Santri | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedReasonOption, setSelectedReasonOption] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Predefined rejection reasons
  const rejectionReasons = [
    "Asrama sudah penuh",
    "Pembayaran belum diterima",
    "Bukti pembayaran kurang jelas",
    "Data santri belum lengkap",
  ];

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
      setModalClass("transform translate-y-full");
      setTimeout(() => {
        setModalClass("transform translate-y-0");
      }, 10);
    }
  }, [isMobile]);

  const handleClose = () => {
    if (isMobile) {
      setModalClass("transform translate-y-full");
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
        statusAktif: "Aktif",
        updatedAt: new Date(),
      });

      // Increment the counter in Counters/activeSantri
      const counterRef = doc(db, "Counters", "activeSantri");
      await updateDoc(counterRef, {
        [kodeAsrama]: increment(1),
        lastUpdated: new Date(),
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

  // Generate WhatsApp message for rejection
  const getWhatsAppLink = (phoneNumber: string, reason: string) => {
    if (!phoneNumber) return "#";

    // Format phone number for WhatsApp
    let formattedPhone = phoneNumber;
    if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.substring(1);
    }

    // Create a custom message based on the reason
    const message = encodeURIComponent(
      `Assalamu'alaikum, mohon maaf kami belum dapat menerima pendaftaran Anda di Asrama Hurun Inn dengan alasan: ${reason}. ${
        reason === "Asrama sudah penuh"
          ? "Kami akan menghubungi Anda jika ada kuota tersedia."
          : reason === "Pembayaran belum diterima"
          ? "Silakan lakukan pembayaran dan kirimkan bukti pembayaran yang jelas."
          : reason === "Bukti pembayaran kurang jelas"
          ? "Mohon kirimkan ulang bukti pembayaran dengan lebih jelas."
          : "Mohon melengkapi data pendaftaran Anda."
      } Terima kasih.`
    );

    return `https://wa.me/${formattedPhone}?text=${message}`;
  };

  const handleReject = async () => {
    if (!santriId || !santriData || !selectedReasonOption) return;

    try {
      setRejecting(true);

      // Create rejection reason by combining selected option and additional notes
      const fullReason = rejectReason.trim()
        ? `${selectedReasonOption} - ${rejectReason}`
        : selectedReasonOption;

      // Get santri phone number for WhatsApp
      const phoneNumber = santriData.nomorTelpon || "";

      // Update santri status to 'Ditolak' instead of deleting
      const santriRef = doc(db, "SantriCollection", santriId);
      await updateDoc(santriRef, {
        statusAktif: "Ditolak",
        rejectReason: fullReason,
        updatedAt: new Date(),
      });

      // Redirect to WhatsApp
      const whatsappLink = getWhatsAppLink(phoneNumber, selectedReasonOption);
      window.open(whatsappLink, "_blank");

      onVerificationComplete();
      resetAndClose();
    } catch (err) {
      console.error("Error rejecting santri:", err);
      setError("Terjadi kesalahan saat menolak pendaftaran santri");
    } finally {
      setRejecting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 999999 }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={closeModal}
        style={{ zIndex: 999999 }}
      />

      {/* Modal content */}
      <div
        className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all relative"
        style={{ zIndex: 1000000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
          Verifikasi Pendaftaran Santri
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400 py-4">{error}</div>
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
                  <p className="font-medium">
                    {santriData.tempatLahir}, {santriData.tanggalLahir}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nama Orang Tua</p>
                  <p className="font-medium">
                    {santriData.namaOrangTua || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Alamat Rumah</p>
                  <p className="font-medium">{santriData.alamatRumah || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Program Studi</p>
                  <p className="font-medium">
                    {santriData.programStudi || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sekolah Asal</p>
                  <p className="font-medium">{santriData.sekolahAsal || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tipe Pembayaran</p>
                  <p className="font-medium">
                    {santriData.paymentOption === "pangkalOnly"
                      ? "Uang Pangkal Saja"
                      : "Uang Pangkal + Syahriah 6 Bulan"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nomor Telepon Santri</p>
                  <p className="font-medium">{santriData.nomorTelpon || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    Nomor Telepon Orang Tua
                  </p>
                  <p className="font-medium">
                    {santriData.nomorWalisantri || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Proof */}
            {santriData.paymentProofUrl && (
              <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
                <h4 className="font-semibold text-lg mb-2">Bukti Pembayaran</h4>
                <div className="mt-2 flex justify-center">
                  <a
                    href={santriData.paymentProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={santriData.paymentProofUrl}
                      alt="Bukti Pembayaran"
                      className="max-w-full w-auto h-auto max-h-[250px] rounded-lg shadow-sm border border-gray-200"
                    />
                  </a>
                </div>
                <div className="mt-2 text-center">
                  <a
                    href={santriData.paymentProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Lihat gambar asli
                  </a>
                </div>
              </div>
            )}

            {showRejectForm ? (
              <div className="mb-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alasan Penolakan <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedReasonOption}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedReasonOption(e.target.value);
                    }}
                    required
                  >
                    <option value="">-- Pilih alasan --</option>
                    {rejectionReasons.map((reason, index) => (
                      <option key={index} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => {
                      e.stopPropagation();
                      setRejectReason(e.target.value);
                    }}
                    placeholder="Masukkan catatan tambahan jika ada..."
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-400 dark:text-blue-300"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Menolak pendaftaran akan mengubah status santri menjadi{" "}
                        <strong>Ditolak</strong> dan mengarahkan Anda ke
                        WhatsApp untuk mengirim pesan penolakan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRejectForm(false);
                      setSelectedReasonOption("");
                      setRejectReason("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Batal
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject();
                    }}
                    disabled={rejecting || !selectedReasonOption}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                  >
                    {rejecting ? "Memproses..." : "Tolak & Kirim WhatsApp"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVerify();
                  }}
                  disabled={verifying}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
                >
                  {verifying ? "Memproses..." : "Terima Pendaftaran"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRejectForm(true);
                  }}
                  disabled={verifying || rejecting}
                  className="flex-1 px-4 py-3 bg-white border border-red-600 text-red-600 rounded-md hover:bg-red-50 disabled:text-red-300 disabled:border-red-300 disabled:cursor-not-allowed"
                >
                  Tolak Pendaftaran
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-500 dark:text-gray-400 py-4">
            Tidak ada data yang tersedia
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
