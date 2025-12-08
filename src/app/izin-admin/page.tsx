"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/firebase/auth";
import {
  getPendingIzinApplications,
  getNdalemPendingIzinApplications,
  getOngoingIzinApplications,
  getIzinHistory,
  updateIzinApplicationStatus,
  updateNdalemApprovalStatus,
  getIzinReport,
  IzinReportItem,
} from "@/firebase/izinSakitPulang";
import { IzinSakitPulang } from "@/types/izinSakitPulang";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  DocumentTextIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import IzinCard from "@/components/izin/IzinCard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { formatDate, formatDateOnly, formatISODate } from "@/utils/date";

type TabType = "pending" | "ndalem" | "ongoing" | "history" | "report";

export default function IzinAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [applications, setApplications] = useState<
    (IzinSakitPulang & { santriName?: string })[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // History tab states
  const [historyStartDate, setHistoryStartDate] = useState<Date>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [historyEndDate, setHistoryEndDate] = useState<Date>(new Date());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilterApplied, setHistoryFilterApplied] = useState(false);

  // Report tab states
  const [reportData, setReportData] = useState<IzinReportItem[]>([]);
  const [startDate, setStartDate] = useState<Date>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const csvLinkRef = useRef<HTMLAnchorElement>(null);

  // Load applications based on active tab
  useEffect(() => {
    const fetchApplications = async () => {
      if (loading) return;

      if (
        !user ||
        (user.role !== "pengurus" &&
          user.role !== "pengasuh" &&
          user.role !== "superAdmin")
      ) {
        router.push("/");
        return;
      }

      // Skip data fetching for the history tab as it requires user interaction first
      if (activeTab === "history" && !historyFilterApplied) {
        setIsLoading(false);
        return;
      }

      // Skip data fetching for report tab as it requires user interaction
      if (activeTab === "report") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let data: (IzinSakitPulang & { santriName?: string })[] = [];

        switch (activeTab) {
          case "pending":
            data = await getPendingIzinApplications();
            break;
          case "ndalem":
            // All admin roles can see ndalem pending applications
            data = await getNdalemPendingIzinApplications();
            break;
          case "ongoing":
            data = await getOngoingIzinApplications();
            break;
          case "history":
            // If filter is applied, get history with date range
            if (historyFilterApplied) {
              data = await getIzinHistory(historyStartDate, historyEndDate);
            } else {
              // Get limited recent history (will be empty initially)
              data = await getIzinHistory();
            }
            break;
        }

        setApplications(data);
      } catch (err) {
        console.error(`Error fetching ${activeTab} applications:`, err);
        setError(`Gagal memuat data. Silakan coba lagi.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplications();
  }, [
    activeTab,
    user,
    loading,
    router,
    refreshTrigger,
    historyFilterApplied,
    historyStartDate,
    historyEndDate,
  ]);

  // Format timestamp to readable date
  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Refresh data
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Render tab button
  const renderTabButton = (tabName: TabType, label: string) => {
    const isActive = activeTab === tabName;
    const baseClasses = "px-4 py-2 text-sm font-medium";
    const activeClasses =
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-100 rounded-md shadow-sm";
    const inactiveClasses =
      "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md";

    // Show all tabs for all admin roles
    return (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`${baseClasses} ${
          isActive ? activeClasses : inactiveClasses
        }`}
      >
        {label}
      </button>
    );
  };

  // Render applications count badge
  const renderCountBadge = (count: number) => {
    return (
      <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
        {count}
      </span>
    );
  };

  // Handle approval directly from list
  const handleQuickApprove = async (
    application: IzinSakitPulang & { santriName?: string },
    isNdalemApproval: boolean
  ) => {
    if (!user) return;

    try {
      if (isNdalemApproval) {
        await updateNdalemApprovalStatus(application.id, true, user);
      } else {
        await updateIzinApplicationStatus(application.id, true, user);
      }

      // Refresh the list
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error with quick approval:", err);
      setError("Gagal menyetujui permohonan. Silakan coba lagi.");
    }
  };

  // Handle rejection directly from list
  const handleQuickReject = async (
    application: IzinSakitPulang & { santriName?: string },
    isNdalemApproval: boolean
  ) => {
    if (!user) return;

    try {
      if (isNdalemApproval) {
        await updateNdalemApprovalStatus(application.id, false, user);
      } else {
        await updateIzinApplicationStatus(application.id, false, user);
      }

      // Refresh the list
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error with quick rejection:", err);
      setError("Gagal menolak permohonan. Silakan coba lagi.");
    }
  };

  // Check if user can approve as ndalem
  const canApproveAsNdalem = () => {
    return user?.role === "pengasuh" || user?.role === "superAdmin";
  };

  // Load history data with date range
  const loadHistoryData = async () => {
    if (
      !user ||
      (user.role !== "pengurus" &&
        user.role !== "pengasuh" &&
        user.role !== "superAdmin")
    ) {
      setError("Anda tidak memiliki akses untuk melihat data sejarah izin.");
      return;
    }

    // Validate date range - maximum 3 months apart
    const diffTime = Math.abs(
      historyEndDate.getTime() - historyStartDate.getTime()
    );
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 90) {
      setError("Rentang tanggal maksimal 3 bulan (90 hari).");
      return;
    }

    if (historyEndDate < historyStartDate) {
      setError("Tanggal akhir harus setelah tanggal awal.");
      return;
    }

    setIsLoadingHistory(true);
    setError(null);

    try {
      // Set endDate to end of day to include all records on that day
      const adjustedEndDate = new Date(historyEndDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const data = await getIzinHistory(historyStartDate, adjustedEndDate);
      setApplications(data);
      setHistoryFilterApplied(true);
    } catch (err) {
      console.error("Error loading history data:", err);
      setError("Gagal memuat data sejarah izin. Silakan coba lagi.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Generate report based on date range
  const generateReport = async () => {
    if (
      !user ||
      (user.role !== "pengurus" &&
        user.role !== "pengasuh" &&
        user.role !== "superAdmin")
    ) {
      setError("Anda tidak memiliki akses untuk melihat laporan.");
      return;
    }

    // Validate date range - maximum 1 month apart
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 31) {
      setError("Rentang tanggal maksimal 1 bulan (31 hari).");
      return;
    }

    if (endDate < startDate) {
      setError("Tanggal akhir harus setelah tanggal awal.");
      return;
    }

    setIsGeneratingReport(true);
    setError(null);

    try {
      // Set endDate to end of day to include all records on that day
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);

      const data = await getIzinReport(startDate, adjustedEndDate);
      setReportData(data);
    } catch (err) {
      console.error("Error generating report:", err);
      setError("Gagal membuat laporan. Silakan coba lagi.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Export report data to CSV
  const exportToCSV = () => {
    if (reportData.length === 0) return;

    const headers = [
      "Nama Santri",
      "Kamar",
      "Semester",
      "Jumlah Izin Pulang",
      "Jumlah Izin Sakit",
      "Jumlah Terlambat Kembali",
      "Alasan Pulang",
      "Keluhan Sakit",
    ];

    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(","));

    // Add data rows
    for (const item of reportData) {
      const values = [
        `"${item.nama}"`,
        `"${item.kamar}"`,
        item.semester,
        item.jumlahIzinPulang,
        item.jumlahIzinSakit,
        item.jumlahTerlambatKembali,
        `"${item.alasanPulang}"`,
        `"${item.keluhanSakit}"`,
      ];

      csvRows.push(values.join(","));
    }

    // Create CSV content
    const csvContent = csvRows.join("\n");

    // Create blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Format date range for filename
    const startDateStr = formatISODate(startDate);
    const endDateStr = formatISODate(endDate);

    // Create download link
    if (csvLinkRef.current) {
      csvLinkRef.current.href = url;
      csvLinkRef.current.setAttribute(
        "download",
        `izin_report_${startDateStr}_to_${endDateStr}.csv`
      );
      csvLinkRef.current.click();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 dark:bg-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">
          Manajemen Izin Sakit &amp; Pulang
        </h1>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
        >
          <ArrowPathIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex flex-wrap space-x-1 md:space-x-4">
          {renderTabButton("pending", `Menunggu Persetujuan`)}
          {renderTabButton("ndalem", `Menunggu Persetujuan Ndalem`)}
          {renderTabButton("ongoing", `Sedang Berlangsung`)}
          {renderTabButton("history", `Sejarah Izin`)}
          {renderTabButton("report", `Laporan`)}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      {/* History Tab Content */}
      {activeTab === "history" ? (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
          {/* Date Filter Controls */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Mulai
                </label>
                <DatePicker
                  selected={historyStartDate}
                  onChange={(date) => setHistoryStartDate(date as Date)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dateFormat="dd/MM/yyyy"
                  maxDate={new Date()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Akhir
                </label>
                <DatePicker
                  selected={historyEndDate}
                  onChange={(date) => setHistoryEndDate(date as Date)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dateFormat="dd/MM/yyyy"
                  maxDate={new Date()}
                />
              </div>
              <div>
                <button
                  onClick={loadHistoryData}
                  disabled={isLoadingHistory}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
                >
                  {isLoadingHistory ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    "Tampilkan Data"
                  )}
                </button>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              <p>
                Tampilkan sejarah izin yang sudah selesai atau ditolak. Maksimal
                rentang waktu adalah 3 bulan.
              </p>
              {!historyFilterApplied && applications.length > 0 && (
                <p className="mt-1 italic">
                  Menampilkan 8 data terbaru. Gunakan filter untuk melihat lebih
                  banyak data.
                </p>
              )}
            </div>
          </div>

          {/* Applications List */}
          {isLoading || isLoadingHistory ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 dark:border-indigo-400 mx-auto"></div>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Memuat data...
              </p>
            </div>
          ) : (
            <>
              {applications.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800">
                  <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {historyFilterApplied
                      ? "Tidak ada data izin sejarah dalam rentang waktu yang dipilih."
                      : "Silakan pilih rentang tanggal dan klik 'Tampilkan Data'."}
                  </p>
                </div>
              ) : (
                <div className="px-4 py-4 grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {applications.map((application) => (
                    <IzinCard
                      key={application.id}
                      izin={application}
                      formatDate={formatDate}
                      detailLink={`/izin-admin/${application.id}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === "report" ? (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
          {/* Date Filter and Export Controls */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Mulai
                </label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date as Date)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dateFormat="dd/MM/yyyy"
                  maxDate={new Date()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Akhir
                </label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date as Date)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  dateFormat="dd/MM/yyyy"
                  maxDate={new Date()}
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={generateReport}
                  disabled={isGeneratingReport}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
                >
                  {isGeneratingReport ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ChartBarIcon className="mr-2 h-4 w-4" />
                      Buat Laporan
                    </>
                  )}
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={reportData.length === 0 || isGeneratingReport}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-900"
                >
                  <DocumentArrowDownIcon className="mr-2 h-4 w-4" />
                  Export CSV
                </button>
                <a ref={csvLinkRef} className="hidden"></a>
              </div>
            </div>
          </div>

          {/* Report Table */}
          {isGeneratingReport ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 dark:border-indigo-400 mx-auto"></div>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Memproses laporan...
              </p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto" />
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Belum ada data laporan. Silakan pilih rentang tanggal dan klik
                "Buat Laporan".
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Nama Santri
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Kamar
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Semester/Kelas
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Izin Pulang
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Izin Sakit
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Terlambat Kembali
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Alasan Pulang
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Keluhan Sakit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                  {reportData.map((item) => (
                    <tr
                      key={item.santriId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {item.nama}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.kamar}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.semester}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.jumlahIzinPulang}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.jumlahIzinSakit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.jumlahTerlambatKembali}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {item.alasanPulang || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {item.keluhanSakit || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Loading state for other tabs */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 dark:border-indigo-400 mx-auto"></div>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Memuat data...
              </p>
            </div>
          ) : (
            <>
              {/* No applications */}
              {applications.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">
                    Tidak ada pengajuan{" "}
                    {activeTab === "pending"
                      ? "yang menunggu persetujuan"
                      : activeTab === "ndalem"
                      ? "yang menunggu persetujuan ndalem"
                      : activeTab === "ongoing"
                      ? "yang sedang berlangsung"
                      : ""}
                    .
                  </p>
                </div>
              ) : (
                <div className="px-4 py-4 grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {applications.map((application) => (
                    <IzinCard
                      key={application.id}
                      izin={application}
                      formatDate={formatDate}
                      detailLink={`/izin-admin/${application.id}`}
                      showQuickApprove={
                        activeTab === "pending" ||
                        (activeTab === "ndalem" && canApproveAsNdalem())
                      }
                      showQuickReject={
                        activeTab === "pending" ||
                        (activeTab === "ndalem" && canApproveAsNdalem())
                      }
                      onQuickApprove={handleQuickApprove}
                      onQuickReject={handleQuickReject}
                      isNdalemAction={activeTab === "ndalem"}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
