"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/auth";
import { db } from "@/firebase/config";
import { toast } from "react-hot-toast";
import {
  CashflowAccount,
  CashflowRow,
  CashflowTransaction,
  CashflowType,
  OpeningBalance,
} from "@/types/cashflow";
import {
  MIN_CASHFLOW_MONTH,
  fetchAvailableMonths,
  fetchTransactionsForMonth,
  fetchOpeningBalance,
  saveOpeningBalance,
  addCashflowTransaction,
  updateCashflowTransaction,
  deleteCashflowTransaction,
  buildCashflowRows,
  filterRowsByAccount,
  formatMonthLabel,
  formatDayFullLabel,
  fmtAmount,
  getCurrentJakartaMonth,
  getAdjacentMonth,
} from "@/utils/cashflowUtils";
import AddTransactionModal from "@/components/cashflow/AddTransactionModal";
import OpeningBalanceModal from "@/components/cashflow/OpeningBalanceModal";
import DeleteConfirmModal from "@/components/cashflow/DeleteConfirmModal";
import { Listbox } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BanknotesIcon,
  CreditCardIcon,
  WalletIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

export default function CashflowPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [transactions, setTransactions] = useState<CashflowTransaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState<OpeningBalance>({
    openingCash: 0,
    openingEmoney: 0,
  });
  const [allRows, setAllRows] = useState<CashflowRow[]>([]);
  const [activeAccount, setActiveAccount] = useState<CashflowAccount | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMonths, setIsLoadingMonths] = useState(true);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<CashflowType>("income");
  const [editingTransaction, setEditingTransaction] = useState<CashflowTransaction | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<CashflowTransaction | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Access Control: superAdmin, pengurus, and bendahara allowed
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "superAdmin" && user.role !== "pengurus" && user.role !== "bendahara") {
        toast.error("Hanya Admin, Pengurus, dan Bendahara yang dapat mengakses laporan arus kas.");
        router.push("/");
      }
    }
  }, [user, authLoading, router]);

  // Load available months
  useEffect(() => {
    let cancelled = false;
    setIsLoadingMonths(true);

    fetchAvailableMonths(db)
      .then((m) => {
        if (cancelled) return;
        setMonths(m);
        const cur = getCurrentJakartaMonth();
        if (m.includes(cur)) {
          setSelectedMonth(cur);
        } else if (m.length > 0) {
          setSelectedMonth(m[0]);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat daftar bulan:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMonths(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load transactions and opening balance for the selected month
  const loadMonthData = useCallback(async () => {
    if (!selectedMonth) return;
    setIsLoading(true);
    try {
      const [txns, opening] = await Promise.all([
        fetchTransactionsForMonth(db, selectedMonth),
        fetchOpeningBalance(db, selectedMonth),
      ]);
      setTransactions(txns);
      setOpeningBalance(opening);
      setAllRows(buildCashflowRows(txns, opening));
    } catch (err) {
      console.error("Gagal memuat data arus kas:", err);
      toast.error("Gagal memuat data arus kas.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadMonthData();
  }, [loadMonthData]);

  // Current month in Jakarta timezone
  const currentMonth = getCurrentJakartaMonth();
  const canStepPrev = Boolean(selectedMonth && selectedMonth > MIN_CASHFLOW_MONTH);
  const canStepNext = Boolean(selectedMonth && selectedMonth < currentMonth);

  // Navigate months via step buttons (< and >)
  const handleStepMonth = (delta: number) => {
    if (!selectedMonth) return;
    const targetMonth = getAdjacentMonth(selectedMonth, delta);
    if (targetMonth < MIN_CASHFLOW_MONTH || targetMonth > currentMonth) {
      return;
    }
    if (!months.includes(targetMonth)) {
      setMonths((prev) => [targetMonth, ...prev].sort((a, b) => b.localeCompare(a)));
    }
    setSelectedMonth(targetMonth);
  };

  // Account card toggle
  const handleAccountToggle = (acct: CashflowAccount) => {
    setActiveAccount((prev) => (prev === acct ? null : acct));
  };

  // Save Opening Balance
  const handleSaveOpeningBalance = async (b: OpeningBalance) => {
    setModalLoading(true);
    try {
      await saveOpeningBalance(
        db,
        selectedMonth,
        b,
        user ? { uid: user.uid, name: user.name || user.email || "" } : undefined
      );
      toast.success("Saldo awal berhasil diperbarui.");
      setShowOpeningModal(false);
      await loadMonthData();
    } catch (err) {
      console.error("Error saving opening balance:", err);
      toast.error("Gagal menyimpan saldo awal.");
    } finally {
      setModalLoading(false);
    }
  };

  // Add / Edit Transaction
  const handleSaveTransaction = async (data: {
    id?: string;
    date: string;
    type: CashflowType;
    description: string;
    amount: number;
    account: CashflowAccount;
  }) => {
    setModalLoading(true);
    try {
      if (data.id) {
        await updateCashflowTransaction(db, data.id, {
          date: data.date,
          type: data.type,
          description: data.description,
          amount: data.amount,
          account: data.account,
        });
        toast.success("Transaksi berhasil diperbarui.");
      } else {
        await addCashflowTransaction(db, {
          date: data.date,
          type: data.type,
          description: data.description,
          amount: data.amount,
          account: data.account,
          createdBy: user
            ? {
                uid: user.uid,
                name: user.name || user.email || "Pengguna",
                role: user.role,
              }
            : undefined,
        });
        toast.success("Transaksi berhasil dicatat.");
      }

      setShowAddModal(false);
      setEditingTransaction(null);

      // If added transaction is in a month not currently selected, switch to it if in valid range
      const txMonth = data.date.substring(0, 7);
      if (txMonth >= MIN_CASHFLOW_MONTH && txMonth <= currentMonth) {
        if (txMonth !== selectedMonth) {
          if (!months.includes(txMonth)) {
            setMonths((prev) => [txMonth, ...prev].sort((a, b) => b.localeCompare(a)));
          }
          setSelectedMonth(txMonth);
        } else {
          await loadMonthData();
        }
      } else {
        await loadMonthData();
      }
    } catch (err) {
      console.error("Error saving transaction:", err);
      toast.error("Gagal menyimpan transaksi.");
    } finally {
      setModalLoading(false);
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setModalLoading(true);
    try {
      await deleteCashflowTransaction(db, transactionToDelete.id);
      toast.success("Transaksi berhasil dihapus.");
      setTransactionToDelete(null);
      await loadMonthData();
    } catch (err) {
      console.error("Error deleting transaction:", err);
      toast.error("Gagal menghapus transaksi.");
    } finally {
      setModalLoading(false);
    }
  };

  // Open creation modal
  const openCreateModal = (type: CashflowType) => {
    setEditingTransaction(null);
    setAddModalType(type);
    setShowAddModal(true);
  };

  // Open edit modal
  const openEditModal = (txn: CashflowTransaction) => {
    setEditingTransaction(txn);
    setAddModalType(txn.type);
    setShowAddModal(true);
  };

  // Computed values
  const displayRows = activeAccount
    ? filterRowsByAccount(allRows, activeAccount)
    : allRows;

  const openingRow = allRows.find((r) => r.rowType === "opening");
  const closingRow = allRows.find((r) => r.rowType === "closing");

  const closingCash = closingRow?.cashBalance ?? 0;
  const closingEmoney = closingRow?.emoneyBalance ?? 0;
  const totalBalance = closingCash + closingEmoney;


  // Group transaction rows by rawDate for mobile feed view
  const groupedFeed = useMemo(() => {
    const map = new Map<string, CashflowRow[]>();
    for (const r of displayRows) {
      if (r.rowType === "opening" || r.rowType === "closing") continue;
      const key = r.rawDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [displayRows]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 dark:bg-gray-900 transition-colors pb-24">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
          Buku Kas &amp; Arus Kas
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pencatatan kas operasional asrama.
        </p>
      </div>

      {/* Financial Summary Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-5 shadow-md border border-gray-100 dark:border-gray-700 transition-colors mb-6">
        {/* Top: Total Saldo Bersih (Clickable toggle for "Semua") */}
        <button
          type="button"
          onClick={() => setActiveAccount(null)}
          className={`w-full text-left p-3 rounded-lg transition-all border ${
            activeAccount === null
              ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60 ring-2 ring-blue-500/20"
              : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/40"
          }`}
          title="Klik untuk menampilkan semua transaksi (Kas Tunai & E-Money)"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Saldo Bersih
              </span>
              {activeAccount === null && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-600 text-white">
                  Semua
                </span>
              )}
            </div>
            <div
              className={`p-2.5 rounded-full transition-colors ${
                activeAccount === null
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
              }`}
            >
              <BanknotesIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-1">
            <p className="text-3xl font-bold text-gray-900 dark:text-white transition-colors">
              Rp {fmtAmount(totalBalance)}
            </p>
          </div>
        </button>

        {/* Bottom Split between Cash and E-Money */}
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveAccount("cash")}
            className={`p-2.5 rounded-md transition-all text-left flex items-center gap-2.5 border ${
              activeAccount === "cash"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/30"
                : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent"
            }`}
            title="Klik untuk filter transaksi Kas Tunai saja"
          >
            <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 shrink-0">
              <WalletIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-500 dark:text-gray-400">Kas Tunai</p>
                {activeAccount === "cash" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                Rp {fmtAmount(closingCash)}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveAccount("emoney")}
            className={`p-2.5 rounded-md transition-all text-left flex items-center gap-2.5 border ${
              activeAccount === "emoney"
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/30"
                : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-transparent"
            }`}
            title="Klik untuk filter transaksi E-Money saja"
          >
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 shrink-0">
              <CreditCardIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-500 dark:text-gray-400">E-Money</p>
                {activeAccount === "emoney" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                Rp {fmtAmount(closingEmoney)}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-md mb-6 border border-gray-100 dark:border-gray-700 transition-colors">
        {/* Month Selector */}
        <div className="inline-flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleStepMonth(-1)}
            disabled={!canStepPrev || isLoadingMonths}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Bulan Sebelumnya"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <Listbox
            value={selectedMonth}
            onChange={setSelectedMonth}
            disabled={isLoadingMonths}
          >
            <div className="relative flex-1 sm:flex-initial min-w-[210px]">
              <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-left text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <span className="block truncate">
                  {formatMonthLabel(selectedMonth) || "Pilih Bulan"}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>

              <Listbox.Options className="absolute left-0 z-50 mt-1 max-h-60 w-full min-w-[220px] overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 border border-gray-100 focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:ring-white/10">
                {months
                  .filter((m) => m >= MIN_CASHFLOW_MONTH && m <= currentMonth)
                  .map((m) => (
                    <Listbox.Option
                      key={m}
                      value={m}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-3 pr-8 transition-colors ${
                          active
                            ? "bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected
                                ? "font-semibold text-blue-600 dark:text-blue-400"
                                : "font-normal"
                            }`}
                          >
                            {formatMonthLabel(m)}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-blue-600 dark:text-blue-400">
                              <CheckIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
              </Listbox.Options>
            </div>
          </Listbox>
          <button
            type="button"
            onClick={() => handleStepMonth(1)}
            disabled={!canStepNext || isLoadingMonths}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Bulan Berikutnya"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        /* Card Layout View */
        <div className="space-y-4">
          {/* Saldo Awal Card */}
          {openingRow && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <CalendarDaysIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Saldo Awal Bulan
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Kas: Rp {fmtAmount(openingRow.cashBalance)} &bull; E-Money: Rp{" "}
                    {fmtAmount(openingRow.emoneyBalance)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowOpeningModal(true)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
              >
                Ubah
              </button>
            </div>
          )}

          {/* Grouped Daily Transactions */}
          {groupedFeed.map(([rawDate, dayRows]) => (
            <div key={rawDate} className="space-y-2">
              {/* Day Header Badge */}
              <div className="flex items-center gap-2 px-1 pt-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  {formatDayFullLabel(rawDate)}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-2" />
              </div>

              {/* Transactions in this day */}
              <div className="space-y-2">
                {dayRows.map((row, idx) => {
                  const isIncome = row.rowType === "income";

                  return (
                    <div
                      key={row.id || idx}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left Details */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isIncome
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeftIcon className="w-4 h-4" />
                            ) : (
                              <ArrowUpRightIcon className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug break-words">
                              {row.description}
                            </h4>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {row.sourceAccount === "cash" ? (
                                  <>
                                    <WalletIcon className="w-3.5 h-3.5 text-gray-500" />
                                    <span>Kas Tunai</span>
                                  </>
                                ) : (
                                  <>
                                    <CreditCardIcon className="w-3.5 h-3.5 text-blue-500" />
                                    <span>E-Money</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Amounts & Running Balance */}
                        <div className="text-right shrink-0">
                          {isIncome ? (
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              +Rp{" "}
                              {fmtAmount(row.cashAmount > 0 ? row.cashAmount : row.emoneyAmount)}
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">
                              -Rp{" "}
                              {fmtAmount(
                                Math.abs(row.cashAmount < 0 ? row.cashAmount : row.emoneyAmount)
                              )}
                            </p>
                          )}

                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {activeAccount === "cash"
                              ? `Saldo: Rp ${fmtAmount(row.cashBalance)}`
                              : activeAccount === "emoney"
                              ? `Saldo: Rp ${fmtAmount(row.emoneyBalance)}`
                              : `Kas: ${fmtAmount(row.cashBalance)} | E-M: ${fmtAmount(
                                  row.emoneyBalance
                                )}`}
                          </p>

                          {row.originalTransaction && (
                            <div className="flex items-center justify-end gap-1 mt-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(row.originalTransaction!)}
                                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
                                title="Edit"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setTransactionToDelete(row.originalTransaction!)}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
                                title="Hapus"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {groupedFeed.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <p className="font-semibold text-gray-700 dark:text-gray-300">
                Belum ada transaksi di bulan {formatMonthLabel(selectedMonth)}.
              </p>
            </div>
          )}

          {/* Saldo Akhir Card */}
          {closingRow && (
            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-between transition-colors">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Saldo Akhir Bulan
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Kas: Rp {fmtAmount(closingCash)} &bull; E-Money: Rp {fmtAmount(closingEmoney)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">
                  Total Saldo
                </span>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  Rp {fmtAmount(totalBalance)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-3 z-30 shadow-lg">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => openCreateModal("income")}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            <span>Pemasukan</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal("expense")}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-md text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
          >
            <MinusIcon className="w-4 h-4 shrink-0" />
            <span>Pengeluaran</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        initialType={addModalType}
        editingTransaction={editingTransaction}
        loading={modalLoading}
      />

      <OpeningBalanceModal
        isOpen={showOpeningModal}
        onClose={() => setShowOpeningModal(false)}
        balance={openingBalance}
        onSave={handleSaveOpeningBalance}
        loading={modalLoading}
      />

      <DeleteConfirmModal
        isOpen={!!transactionToDelete}
        onClose={() => setTransactionToDelete(null)}
        onConfirm={handleDeleteTransaction}
        transaction={transactionToDelete}
        loading={modalLoading}
      />
    </div>
  );
}
