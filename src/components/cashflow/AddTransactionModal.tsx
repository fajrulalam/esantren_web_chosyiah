"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { CashflowAccount, CashflowTransaction, CashflowType } from "@/types/cashflow";
import { MIN_CASHFLOW_DATE, getCurrentJakartaDate } from "@/utils/cashflowUtils";
import { XMarkIcon, WalletIcon, CreditCardIcon } from "@heroicons/react/24/outline";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    date: string;
    type: CashflowType;
    description: string;
    amount: number;
    account: CashflowAccount;
  }) => Promise<void>;
  initialType?: CashflowType;
  editingTransaction?: CashflowTransaction | null;
  loading?: boolean;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSave,
  initialType = "income",
  editingTransaction,
  loading = false,
}: AddTransactionModalProps) {
  const [type, setType] = useState<CashflowType>(initialType);
  const [date, setDate] = useState<string>(getCurrentJakartaDate());
  const [rawAmount, setRawAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [account, setAccount] = useState<CashflowAccount>("cash");

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDate(editingTransaction.date);
      setRawAmount(new Intl.NumberFormat("id-ID").format(editingTransaction.amount));
      setDescription(editingTransaction.description);
      setAccount(editingTransaction.account);
    } else {
      setType(initialType);
      setDate(getCurrentJakartaDate());
      setRawAmount("");
      setDescription("");
      setAccount("cash");
    }
  }, [editingTransaction, initialType, isOpen]);

  if (!isOpen) return null;

  const numericAmount = parseInt(rawAmount.replace(/\D/g, ""), 10) || 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setRawAmount("");
      return;
    }
    setRawAmount(new Intl.NumberFormat("id-ID").format(parseInt(digits, 10)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0 || !description.trim() || !date) return;

    const minDate = MIN_CASHFLOW_DATE;
    const maxDate = getCurrentJakartaDate();
    if (date < minDate || date > maxDate) {
      toast.error(`Tanggal transaksi harus antara September 2026 dan hari ini (${maxDate}).`);
      return;
    }

    await onSave({
      id: editingTransaction?.id,
      date,
      type,
      description: description.trim(),
      amount: numericAmount,
      account,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto z-10 transition-all">
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {editingTransaction
              ? "Edit Transaksi"
              : type === "income"
              ? "Catat Pemasukan"
              : "Catat Pengeluaran"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Type selector (only when creating new) */}
        {!editingTransaction && (
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-md mb-5">
            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === "income"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
              }`}
            >
              Pemasukan
            </button>
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === "expense"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
              }`}
            >
              Pengeluaran
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              required
              min={MIN_CASHFLOW_DATE}
              max={getCurrentJakartaDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nominal (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 dark:text-gray-500">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={rawAmount}
                onChange={handleAmountChange}
                placeholder="0"
                className="block w-full pl-10 pr-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-semibold shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Account selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {type === "income" ? "Masuk ke Akun" : "Keluar dari Akun"}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAccount("cash")}
                className={`py-2 px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  account === "cash"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <WalletIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kas Tunai</span>
              </button>
              <button
                type="button"
                onClick={() => setAccount("emoney")}
                className={`py-2 px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  account === "emoney"
                    ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <CreditCardIcon className="w-4 h-4 text-blue-600 shrink-0" />
                <span>E-Money</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Keterangan
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === "income"
                  ? "Contoh: Setoran Kas, Pengumpulan Takzir"
                  : "Contoh: Beli beras 50kg, Token listrik asrama"
              }
              className="block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Action buttons */}
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
              disabled={loading || numericAmount <= 0 || !description.trim()}
              className={`px-4 py-2 text-sm font-medium rounded-md text-white shadow-sm transition-colors disabled:opacity-50 ${
                type === "income"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Menyimpan..." : editingTransaction ? "Simpan Perubahan" : "Simpan Transaksi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
