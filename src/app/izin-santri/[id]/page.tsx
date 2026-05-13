"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/firebase/auth";
import { useRouter } from "next/navigation";
import { IzinSakitPulang } from "@/types/izinSakitPulang";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeftIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { deleteIzinApplication } from "@/firebase/izinSakitPulang";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

export default function IzinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading, santriName } = useAuth();
  const router = useRouter();
  const [izin, setIzin] = useState<IzinSakitPulang | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Load application data
  useEffect(() => {
    const fetchIzinData = async () => {
      if (loading) return;

      if (!user || user.role !== "waliSantri" || !user.santriId) {
        setError("Anda tidak memiliki akses ke halaman ini.");
        setIsLoading(false);
        return;
      }

      try {
        const izinRef = doc(db, "SakitDanPulangCollection", id);
        const izinSnap = await getDoc(izinRef);

        if (!izinSnap.exists()) {
          setError("Permohonan tidak ditemukan.");
          setIsLoading(false);
          return;
        }

        const izinData = izinSnap.data() as any;

        // Check if this application belongs to the current user's santri
        if (izinData.santriId !== user.santriId) {
          setError("Anda tidak memiliki akses untuk melihat permohonan ini.");
          setIsLoading(false);
          return;
        }

        // Set the data with ID
        setIzin({
          id: id,
          ...izinData
        } as IzinSakitPulang);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching izin data:", err);
        setError("Gagal memuat data. Silakan coba lagi.");
        setIsLoading(false);
      }
    };

    fetchIzinData();
  }, [id, user, loading]);

  // Check if application can be deleted
  const canDelete = () => {
    if (!izin) return false;
    // return  false;
    return izin.status !== "Proses Pulang" && "Dalam Masa Sakit" && "Sudah Kembali" && "Sudah Sembuh" && "Ditolak Ustadzah" && "Ditolak Ndalem";
  };

  // Handle delete application
  const handleDelete = async () => {
    if (!izin) return;

    if (!confirm("Apakah Anda yakin ingin menghapus permohonan ini?")) {
      return;
    }

    try {
      setDeleting(true);
      const success = await deleteIzinApplication(izin.id);
      if (success) {
        router.push("/izin-santri");
      }
    } catch (err) {
      console.error("Error deleting application:", err);
      alert("Gagal menghapus permohonan. Silakan coba lagi.");
      setDeleting(false);
    }
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    let colorClass = "";
    let icon = null;

    switch (status) {
      case "Menunggu Persetujuan Ustadzah":
      case "Menunggu Diperiksa Ustadzah":
      case "Menunggu Persetujuan Ndalem":
        colorClass = "bg-yellow-100 text-yellow-800";
        icon = <ClockIcon className="w-5 h-5 inline mr-1" />;
        break;
      case "Disetujui":
      case "Sudah Kembali":
      case "Sudah Sembuh":
      case "Proses Pulang":
      case "Dalam Masa Sakit":
        colorClass = "bg-green-100 text-green-800";
        icon = <CheckCircleIcon className="w-5 h-5 inline mr-1" />;
        break;
      case "Ditolak":
        colorClass = "bg-red-100 text-red-800";
        icon = <XCircleIcon className="w-5 h-5 inline mr-1" />;
        break;
      default:
        colorClass = "bg-gray-100 text-gray-800";
    }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
        {icon}{status}
      </span>
    );
  };

  // Redirect if not waliSantri
  if (!loading && (!user || user.role !== "waliSantri")) {
    router.push("/");
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/izin-santri"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" /> Kembali ke Daftar Permohonan
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Memuat data...</p>
        </div>
      ) : izin ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Detail Permohonan Izin {izin.izinType}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {santriName ? `Santri: ${santriName}` : ''}
                </p>
              </div>
              <div>
                {renderStatusBadge(izin.status)}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200">
            <dl>
              {/* Common Fields */}
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Jenis Izin</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  Izin {izin.izinType}
                </dd>
              </div>

              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Tanggal Dibuat</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(izin.timestamp)}
                </dd>
              </div>

              {/* Izin Type-specific Fields */}
              {izin.izinType === "Sakit" ? (
                <>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Keluhan</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {izin.keluhan}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Alasan</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {izin.alasan}
                    </dd>
                  </div>

                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Tanggal Pulang</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {formatDate(izin.tglPulang)}
                    </dd>
                  </div>

                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Rencana Tanggal Kembali</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {formatDate(izin.rencanaTanggalKembali)}
                    </dd>
                  </div>

                  {izin.pemberiIzin && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Pemberi Izin</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {izin.pemberiIzin}
                      </dd>
                    </div>
                  )}

                  {izin.sudahKembali !== null && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Status Kepulangan</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {izin.sudahKembali ? "Sudah Kembali" : "Belum Kembali"}
                      </dd>
                    </div>
                  )}

                  {izin.kembaliSesuaiRencana !== null && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Kembali Sesuai Rencana</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {izin.kembaliSesuaiRencana ? "Ya" : "Tidak"}
                      </dd>
                    </div>
                  )}
                </>
              )}

              {/* Status Fields */}
              <div className={`${izin.izinType === "Pulang" ? "bg-gray-50" : "bg-white"} px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}>
                <dt className="text-sm font-medium text-gray-500">Status Persetujuan Ustadzah</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {izin.sudahDapatIzinUstadzah === null ? (
                    "Menunggu"
                  ) : izin.sudahDapatIzinUstadzah ? (
                    <span className="text-green-600 font-medium">Disetujui</span>
                  ) : (
                    <span className="text-red-600 font-medium">Ditolak</span>
                  )}
                </dd>
              </div>

              {izin.izinType === "Pulang" && (
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Status Persetujuan Ndalem</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {izin.sudahDapatIzinNdalem ? (
                      <span className="text-green-600 font-medium">Disetujui</span>
                    ) : (
                      <span className="text-yellow-600 font-medium">Menunggu</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {canDelete() && (
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 border-t border-gray-200">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menghapus...
                  </>
                ) : (
                  'Hapus Permohonan'
                )}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}