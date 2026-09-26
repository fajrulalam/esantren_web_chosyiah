"use client";

import React, { useState, useEffect } from "react";
import { OpeningBalance } from "@/types/cashflow";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface OpeningBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: OpeningBalance;
  onSave: (balance: OpeningBalance) => Promise<void>;
  loading?: boolean;
}

export default function OpeningBalanceModal({
  isOpen,
  onClose,
  balance,
  onSave,
  loading = false,
}: OpeningBalanceModalProps) {
  const [cash, setCash] = useState("");
  const [emoney, setEmoney] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCash(balance.openingCash ? new Intl.NumberFormat("id-ID").format(balance.openingCash) : "");
      setEmoney(balance.openingEmoney ? new Intl.NumberFormat("id-ID").format(balance.openingEmoney) : "");
    }
  }, [balance, isOpen]);

  if (!isOpen) return null;

  const parseDigits = (val: string) => parseInt(val.replace(/\D/g, ""), 10) || 0;

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setCash("");
      return;
    }
    setCash(new Intl.NumberFormat("id-ID").format(parseInt(digits, 10)));
  };

  const handleEmoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setEmoney("");
      return;
    }
    setEmoney(new Intl.NumberFormat("id-ID").format(parseInt(digits, 10)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      openingCash: parseDigits(cash),
      openingEmoney: parseDigits(emoney),
    });
  };

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
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Ubah Saldo Awal Bulan
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Atur saldo awal pada awal bulan ini. Saldo akhir bulan sebelumnya akan secara otomatis bergulir ke bulan berikutnya jika tidak diubah secara manual.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Saldo Awal Kas Tunai (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-gray-500">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={cash}
                onChange={handleCashChange}
                placeholder="0"
                className="block w-full pl-10 pr-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-semibold shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Saldo Awal E-Money (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-gray-500">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={emoney}
                onChange={handleEmoneyChange}
                placeholder="0"
                className="block w-full pl-10 pr-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-semibold shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan Saldo Awal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
