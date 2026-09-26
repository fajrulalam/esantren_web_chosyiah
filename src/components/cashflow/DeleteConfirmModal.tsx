"use client";

import React from "react";
import { CashflowTransaction } from "@/types/cashflow";
import { fmtAmount, formatDayLabel } from "@/utils/cashflowUtils";
import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  transaction: CashflowTransaction | null;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  loading = false,
}: DeleteConfirmModalProps) {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto z-10 transition-all">
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Hapus Transaksi?
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini akan memperbarui saldo buku kas secara otomatis.
        </p>

        <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 mb-6 space-y-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Tanggal:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatDayLabel(transaction.date)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Keterangan:</span>
            <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[200px] truncate">
              {transaction.description}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Tipe / Akun:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {transaction.type === "income"
                ? "Pemasukan"
                : "Pengeluaran"} ({transaction.account === "cash" ? "Kas Tunai" : "E-Money"})
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-bold">
            <span className="text-gray-700 dark:text-gray-200">Nominal:</span>
            <span className={transaction.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              Rp {fmtAmount(transaction.amount)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Menghapus..." : "Hapus Transaksi"}
          </button>
        </div>
      </div>
    </div>
  );
}
