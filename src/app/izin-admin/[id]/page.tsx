"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/firebase/auth";
import { useRouter } from "next/navigation";
import { IzinSakitPulang } from "@/types/izinSakitPulang";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import "react-datepicker/dist/react-datepicker.css";
import { 
  updateIzinApplicationStatus, 
  updateNdalemApprovalStatus,
  verifySantriReturn,
  verifySantriRecovered
} from "@/firebase/izinSakitPulang";

export default function IzinAdminDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<IzinSakitPulang & { santriName?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [returnDate, setReturnDate] = useState<Date>(new Date());
  const [actionType, setActionType] = useState<"ustadzah" | "ndalem">("ustadzah");

  // Load application data
  useEffect(() => {
    const fetchApplicationData = async () => {
      if (loading) return;
      
      if (!user || (user.role !== "pengurus" && user.role !== "pengasuh" && user.role !== "superAdmin")) {
        router.push("/");
        return;
      }
      
      try {
        const applicationRef = doc(db, "SakitDanPulangCollection", params.id);
        const applicationSnap = await getDoc(applicationRef);
        
        if (!applicationSnap.exists()) {
          setError("Permohonan tidak ditemukan.");
          setIsLoading(false);
          return;
        }
        
        const applicationData = applicationSnap.data() as any;
        
        // Fetch santri name
        try {
          const santriRef = doc(db, "SantriCollection", applicationData.santriId);
          const santriSnap = await getDoc(santriRef);
          
          let santriName = "Santri";
          if (santriSnap.exists()) {
            santriName = santriSnap.data().nama || "Santri";
          }
          
          setApplication({
            id: params.id,
            ...applicationData,
            santriName
          });
        } catch (err) {
          console.error("Error fetching santri data:", err);
          setApplication({
            id: params.id,
            ...applicationData,
            santriName: "Santri"
          });
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching application data:", err);
        setError("Gagal memuat data. Silakan coba lagi.");
        setIsLoading(false);
      }
    };

    fetchApplicationData();
  }, [params.id, user, loading, router]);

  // Format timestamp to readable date
  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Check if user can approve/reject as ustadzah
  const canApproveAsUstadzah = () => {
    if (!application) return false;
    
    // Must be pengurus, pengasuh, or superAdmin
    if (user?.role !== "pengurus" && user?.role !== "pengasuh" && user?.role !== "superAdmin") {
      return false;
    }
    
    // Check if already approved/rejected
    if (application.sudahDapatIzinUstadzah !== null) {
      return false;
    }
    
    // Check if status is correct
    return application.status === "Menunggu Persetujuan Ustadzah" || 
           application.status === "Menunggu Diperiksa Ustadzah";
  };
  
  // Check if user can approve/reject as ndalem
  const canApproveAsNdalem = () => {
    if (!application) return false;
    
    // Only pengasuh or superAdmin can approve as ndalem
    if (user?.role !== "pengasuh" && user?.role !== "superAdmin") {
      return false;
    }
    
    // Must be Izin Pulang
    if (application.izinType !== "Pulang") {
      return false;
    }
    
    // Check if already approved by ustadzah
    if (application.sudahDapatIzinUstadzah !== true) {
      return false;
    }
    
    // Check if already approved/rejected by ndalem
    if ((application as any).sudahDapatIzinNdalem !== undefined && 
        (application as any).sudahDapatIzinNdalem !== null) {
      return false;
    }
    
    // Check if status is correct
    return application.status === "Menunggu Persetujuan Ndalem";
  };
  
  // Check if user can verify santri return from pulang
  const canVerifySantriReturn = () => {
    if (!application) return false;
    
    // Must be pengasuh or superAdmin
    if (user?.role !== "pengasuh" && user?.role !== "superAdmin") {
      return false;
    }
    
    // Must be Izin Pulang with both approvals
    if (application.izinType !== "Pulang" ||
        application.sudahDapatIzinUstadzah !== true ||
        (application as any).sudahDapatIzinNdalem !== true) {
      return false;
    }
    
    // Check if already marked as returned
    if ((application as any).sudahKembali === true) {
      return false;
    }
    
    // Check if status is correct
    return application.status === "Proses Pulang";
  };
  
  // Check if user can verify santri recovery from sickness
  const canVerifySantriRecovery = () => {
    if (!application) return false;
    
    // Must be pengasuh or superAdmin
    if (user?.role !== "pengasuh" && user?.role !== "superAdmin") {
      return false;
    }
    
    // Must be Izin Sakit with approval
    if (application.izinType !== "Sakit" || 
        application.sudahDapatIzinUstadzah !== true) {
      return false;
    }
    
    // Check if status is correct (not already recovered)
    return application.status === "Dalam Masa Sakit";
  };

  // Handle approve action
  const handleApprove = async () => {
    if (!application || !user) return;
    
    setProcessingAction(true);
    
    try {
      let success;
      
      if (actionType === "ustadzah") {
        success = await updateIzinApplicationStatus(
          application.id,
          true, // approved
          user
        );
      } else {
        success = await updateNdalemApprovalStatus(
          application.id,
          true, // approved
          user
        );
      }
      
      if (success) {
        // Redirect back to admin page
        router.push("/izin-admin");
      }
    } catch (err) {
      console.error("Error approving application:", err);
      setError("Gagal menyetujui permohonan. Silakan coba lagi.");
      setProcessingAction(false);
    }
  };

  // Handle reject action
  const handleReject = async () => {
    if (!application || !user) return;
    
    setProcessingAction(true);
    
    try {
      let success;
      
      if (actionType === "ustadzah") {
        success = await updateIzinApplicationStatus(
          application.id,
          false, // rejected
          user,
          rejectionReason || undefined
        );
      } else {
        success = await updateNdalemApprovalStatus(
          application.id,
          false, // rejected
          user,
          rejectionReason || undefined
        );
      }
      
      if (success) {
        // Redirect back to admin page
        router.push("/izin-admin");
      }
    } catch (err) {
      console.error("Error rejecting application:", err);
      setError("Gagal menolak permohonan. Silakan coba lagi.");
      setProcessingAction(false);
    }
  };

  // Open reject modal
  const openRejectModal = (type: "ustadzah" | "ndalem") => {
    setActionType(type);
    setRejectionReason("");
    setShowRejectModal(true);
  };
  
  // Handle verifying santri return
  const handleVerifyReturn = async () => {
    if (!application || !user) return;
    
    setProcessingAction(true);
    
    try {
      const success = await verifySantriReturn(
        application.id,
        user,
        returnDate
      );
      
      if (success) {
        // Redirect back to admin page or refresh current view
        router.push("/izin-admin");
      }
    } catch (err) {
      console.error("Error verifying santri return:", err);
      setError("Gagal memverifikasi kepulangan santri. Silakan coba lagi.");
      setProcessingAction(false);
    }
  };
  
  // Handle verifying santri recovery
  const handleVerifyRecovery = async () => {
    if (!application || !user) return;
    
    setProcessingAction(true);
    
    try {
      const success = await verifySantriRecovered(
        application.id,
        user
      );
      
      if (success) {
        // Redirect back to admin page or refresh current view
        router.push("/izin-admin");
      }
    } catch (err) {
      console.error("Error verifying santri recovery:", err);
      setError("Gagal memverifikasi kesembuhan santri. Silakan coba lagi.");
      setProcessingAction(false);
    }
  };

  // Render action buttons based on state
  const renderActionButtons = () => {
    if (canApproveAsUstadzah()) {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setActionType("ustadzah");
              handleApprove();
            }}
            disabled={processingAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="-ml-1 mr-2 h-5 w-5" />
            Setujui
          </button>
          <button
            onClick={() => openRejectModal("ustadzah")}
            disabled={processingAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="-ml-1 mr-2 h-5 w-5" />
            Tolak
          </button>
        </div>
      );
    } else if (canApproveAsNdalem()) {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setActionType("ndalem");
              handleApprove();
            }}
            disabled={processingAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="-ml-1 mr-2 h-5 w-5" />
            Setujui (Ndalem)
          </button>
          <button
            onClick={() => openRejectModal("ndalem")}
            disabled={processingAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="-ml-1 mr-2 h-5 w-5" />
            Tolak (Ndalem)
          </button>
        </div>
      );
    } else if (canVerifySantriReturn()) {
      return (
        <div className="flex space-x-3">
          <button
            onClick={() => setShowReturnModal(true)}
            disabled={processingAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="-ml-1 mr-2 h-5 w-5" />
            Verifikasi Kepulangan Santri
          </button>
        </div>
      );
    } else if (canVerifySantriRecovery()) {
      return (
        <div className="flex space-x-3">
          <button
            onClick={handleVerifyRecovery}
            disabled={processingAction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="-ml-1 mr-2 h-5 w-5" />
            Verifikasi Kesembuhan Santri
          </button>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8 dark:bg-gray-900">
      <div className="mb-8">
        <Link 
          href="/izin-admin" 
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> Kembali ke Daftar Permohonan
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {processingAction && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 dark:border-indigo-400 mb-4"></div>
            <p className="text-gray-700 dark:text-gray-300">Memproses...</p>
          </div>
        </div>
      )}
      
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Alasan Penolakan {actionType === "ndalem" ? "(Ndalem)" : ""}
            </h3>
            <div className="mb-4">
              <textarea
                rows={4}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md"
                placeholder="Tuliskan alasan penolakan (opsional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              ></textarea>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-900"
              >
                Tolak Permohonan
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showReturnModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Verifikasi Kepulangan Santri
            </h3>
            <div className="mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Tanggal rencana kembali: {application ? formatDate((application as any).rencanaTanggalKembali) : '-'}
              </p>
              
              <label htmlFor="returnDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tanggal Kembali Aktual
              </label>
              <input
                type="datetime-local"
                id="returnDate"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md"
                value={returnDate.toISOString().slice(0, 16)} 
                onChange={(e) => {
                  if (e.target.value) {
                    setReturnDate(new Date(e.target.value));
                  }
                }}
              />
              
              {application && returnDate && (application as any).rencanaTanggalKembali && (
                <div className={`mt-2 text-sm ${
                  returnDate.getTime() <= (application as any).rencanaTanggalKembali.toDate().getTime() 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
                }`}>
                  {returnDate.getTime() <= (application as any).rencanaTanggalKembali.toDate().getTime() 
                    ? 'Santri kembali tepat waktu' 
                    : 'Santri terlambat kembali'
                  }
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReturnModal(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
              >
                Batal
              </button>
              <button
                onClick={handleVerifyReturn}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
              >
                Konfirmasi Kepulangan
              </button>
            </div>
          </div>
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      ) : application ? (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Detail Permohonan Izin {application.izinType}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Santri: {application.santriName}
                </p>
              </div>
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  application.status.includes("Menunggu") ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100" :
                  application.status.includes("Ditolak") ? "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" :
                  "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                }`}>
                  {application.status}
                </span>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700">
            <dl>
              {/* Common Fields */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Jenis Izin</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                  Izin {application.izinType}
                </dd>
              </div>
              
              <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tanggal Dibuat</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                  {formatDate(application.timestamp)}
                </dd>
              </div>
              
              {/* Izin Type-specific Fields */}
              {application.izinType === "Sakit" ? (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Keluhan</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                      {(application as any).keluhan}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Alasan</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                      {(application as any).alasan}
                    </dd>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tanggal Pulang</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                      {formatDate((application as any).tglPulang)}
                    </dd>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Rencana Tanggal Kembali</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                      {formatDate((application as any).rencanaTanggalKembali)}
                    </dd>
                  </div>
                  
                  {(application as any).pemberiIzin && (
                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Pemberi Izin</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                        {(application as any).pemberiIzin}
                      </dd>
                    </div>
                  )}
                </>
              )}
              
              {/* Status Fields */}
              <div className={`${application.izinType === "Pulang" ? "bg-gray-50 dark:bg-gray-700" : "bg-gray-50 dark:bg-gray-700"} px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status Persetujuan Ustadzah</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                  {application.sudahDapatIzinUstadzah === null ? (
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">Menunggu</span>
                  ) : application.sudahDapatIzinUstadzah ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">Disetujui</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-medium">Ditolak</span>
                  )}
                  
                  {/* Show approver info if available */}
                  {(application as any).approvedBy && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Oleh: {(application as any).approvedBy.name} ({(application as any).approvedBy.role})
                      <br />
                      Pada: {formatDate((application as any).approvedBy.timestamp)}
                    </div>
                  )}
                  
                  {/* Show rejection reason if available */}
                  {(application as any).rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
                      <span className="font-medium">Alasan penolakan:</span> {(application as any).rejectionReason}
                    </div>
                  )}
                </dd>
              </div>
              
              {application.izinType === "Pulang" && (
                <div className={`${(application as any).ndalemApproval ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-700"} px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status Persetujuan Ndalem</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-2">
                    {(application as any).sudahDapatIzinNdalem === undefined || (application as any).sudahDapatIzinNdalem === null ? (
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">Menunggu</span>
                    ) : (application as any).sudahDapatIzinNdalem ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">Disetujui</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-medium">Ditolak</span>
                    )}
                    
                    {/* Show ndalem approver info if available */}
                    {(application as any).ndalemApproval && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Oleh: {(application as any).ndalemApproval.name} ({(application as any).ndalemApproval.role})
                        <br />
                        Pada: {formatDate((application as any).ndalemApproval.timestamp)}
                      </div>
                    )}
                    
                    {/* Show ndalem rejection reason if available */}
                    {(application as any).ndalemRejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
                        <span className="font-medium">Alasan penolakan:</span> {(application as any).ndalemRejectionReason}
                      </div>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          
          {/* Action buttons for approval/rejection/verification */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 text-right sm:px-6 border-t border-gray-200 dark:border-gray-700">
            {renderActionButtons()}
          </div>
        </div>
      ) : null}
    </div>
  );
}