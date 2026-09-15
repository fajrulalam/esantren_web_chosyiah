"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Santri } from "@/types/santri";

interface SantriMergeModalProps {
  santris: Santri[];
  onClose: () => void;
  onConfirm: (primaryId: string) => Promise<void>;
  isSubmitting: boolean;
}

export default function SantriMergeModal({
  santris,
  onClose,
  onConfirm,
  isSubmitting,
}: SantriMergeModalProps) {
  const [mounted, setMounted] = useState(false);
  const [primaryId, setPrimaryId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleConfirm = () => {
    if (!primaryId) return;

    const confirmed = window.confirm(
      `${santris.length - 1} pendaftaran duplikat akan dihapus permanen dan tidak bisa dikembalikan. Lanjutkan?`
    );
    if (!confirmed) return;

    onConfirm(primaryId);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2000000 }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        style={{ zIndex: 2000000 }}
      />

      {/* Modal content */}
      <div
        className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-6 text-left shadow-xl relative"
        style={{ zIndex: 2000001 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Gabungkan Pendaftaran Santri
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Pilih satu data yang akan disimpan sebagai data utama. Data lainnya
          akan dihapus permanen, dan info tipe pembayaran serta bukti
          pembayarannya akan dicatat otomatis di kolom Catatan pada data
          utama.
        </p>

        <div className="space-y-3 mb-6">
          {santris.map((santri) => (
            <label
              key={santri.id}
              className={`block border rounded-lg p-4 cursor-pointer transition-colors ${
                primaryId === santri.id
                  ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="primarySantri"
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  checked={primaryId === santri.id}
                  onChange={() => setPrimaryId(santri.id)}
                />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {santri.nama}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {santri.programStudi || santri.jenjangPendidikan || "-"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {santri.paymentOption === "pangkalOnly"
                        ? "Uang Pangkal Saja"
                        : "Uang Pangkal + Syahriah"}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {santri.nomorTelpon || santri.nomorWalisantri || "-"}
                    </p>
                  </div>
                  {santri.paymentProofUrl && (
                    <a
                      href={santri.paymentProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={santri.paymentProofUrl}
                        alt="Bukti Pembayaran"
                        className="w-full h-auto max-h-24 object-cover rounded-md border border-gray-200 dark:border-gray-600 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!primaryId || isSubmitting}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-purple-300 dark:disabled:bg-purple-800/50"
          >
            {isSubmitting ? "Menggabungkan..." : "Gabungkan Sekarang"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
