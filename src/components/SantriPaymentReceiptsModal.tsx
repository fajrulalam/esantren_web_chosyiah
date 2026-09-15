"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { PaymentStatus, Santri } from "@/types/santri";

interface ReceiptEntry {
  key: string;
  imageUrl: string;
  paymentName: string;
  type?: string;
  date?: string;
  amount?: number;
  note?: string;
}

interface SantriPaymentReceiptsModalProps {
  santri: Santri;
  onClose: () => void;
}

export default function SantriPaymentReceiptsModal({
  santri,
  onClose,
}: SantriPaymentReceiptsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        setLoading(true);
        setError(null);

        const collected: ReceiptEntry[] = [];

        // Payment proof submitted at registration time
        if (santri.paymentProofUrl) {
          collected.push({
            key: "registration",
            imageUrl: santri.paymentProofUrl,
            paymentName: "Pembayaran Pendaftaran",
            type: "Pendaftaran",
          });
        }

        // Receipts carried over from merged duplicate registrations
        (santri.mergedPaymentProofs || []).forEach((proof, index) => {
          collected.push({
            key: `merged-${index}`,
            imageUrl: proof.imageUrl,
            paymentName: `Pendaftaran (digabung dari "${proof.nama}")`,
            type:
              proof.paymentOption === "pangkalOnly"
                ? "Uang Pangkal Saja"
                : "Uang Pangkal + Syahriah",
            date: proof.mergedAt
              ? new Date(proof.mergedAt).toLocaleDateString("id-ID")
              : undefined,
          });
        });

        // All receipts uploaded for ongoing invoices/syahriah payments
        const statusesRef = collection(db, "PaymentStatuses");
        const statusesQuery = query(
          statusesRef,
          where("santriId", "==", santri.id)
        );
        const snapshot = await getDocs(statusesQuery);

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as PaymentStatus;
          const history = data.history || {};

          Object.entries(history).forEach(([historyId, item]) => {
            if (item?.imageUrl) {
              collected.push({
                key: `${docSnap.id}-${historyId}`,
                imageUrl: item.imageUrl,
                paymentName: data.paymentName || "Pembayaran",
                type: item.type,
                date: item.date,
                amount: item.amount,
                note: item.note,
              });
            }
          });
        });

        // Newest first; entries without a date (e.g. registration proof) go last
        collected.sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });

        setReceipts(collected);
      } catch (err) {
        console.error("Error fetching payment receipts:", err);
        setError("Terjadi kesalahan saat mengambil bukti pembayaran");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, [santri.id, santri.paymentProofUrl]);

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
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Bukti Pembayaran &ndash; {santri.nama}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 dark:text-red-400 py-4">{error}</div>
        ) : receipts.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            Belum ada bukti pembayaran yang diunggah santri ini.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {receipts.map((receipt) => (
              <div
                key={receipt.key}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="mb-2 text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {receipt.paymentName}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {[receipt.type, receipt.date].filter(Boolean).join(" · ") ||
                      "-"}
                  </p>
                  {typeof receipt.amount === "number" && (
                    <p className="text-gray-500 dark:text-gray-400">
                      Rp {receipt.amount.toLocaleString("id-ID")}
                    </p>
                  )}
                  {receipt.note && (
                    <p className="text-gray-500 dark:text-gray-400 italic">
                      &ldquo;{receipt.note}&rdquo;
                    </p>
                  )}
                </div>
                <a
                  href={receipt.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={receipt.imageUrl}
                    alt="Bukti Pembayaran"
                    className="w-full h-auto rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
