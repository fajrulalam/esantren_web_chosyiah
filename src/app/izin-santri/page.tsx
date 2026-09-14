"use client";

import { useAuth } from "@/firebase/auth";
import { useEffect, useState } from "react";
import {
  getIzinApplicationsBySantri,
} from "@/firebase/izinSakitPulang";
import { IzinSakitPulang } from "@/types/izinSakitPulang";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import IzinCard from "@/components/izin/IzinCard";

export default function IzinSantriPage() {
  const { user, loading } = useAuth();
  const [izinList, setIzinList] = useState<IzinSakitPulang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

  // Load izin data
  useEffect(() => {
    const loadIzinData = async () => {
      if (loading) return;

      if (!user || user.role !== "waliSantri" || !user.santriId) {
        setError("Anda tidak memiliki akses ke halaman ini.");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getIzinApplicationsBySantri(user.santriId);
        setIzinList(data);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading izin data:", err);
        setError("Gagal memuat data. Silakan coba lagi.");
        setIsLoading(false);
      }
    };

    loadIzinData();
  }, [user, loading]);

  // Redirect if not waliSantri. Done in an effect (not during render) so we
  // don't update the router while IzinSantriPage itself is still rendering.
  useEffect(() => {
    if (!loading && (!user || user.role !== "waliSantri")) {
      router.push("/");
    }
  }, [loading, user, router]);

  // If user is not waliSantri, the effect above will redirect to home.
  if (!loading && (!user || user.role !== "waliSantri")) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Laporan Izin Sakit/Pulang</h1>
        <Link
          href="/izin-santri/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Lapor Izin
        </Link>
      </div>

      <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">Laporkan izin langsung. Setelah kembali atau sembuh, santri atau pengurus dapat mencatatnya di sini.</p>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Memuat data...</p>
        </div>
      ) : (
        <>
          {izinList.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400">
                Belum ada laporan izin sakit/pulang
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {izinList.map((izin) => (
                <IzinCard
                  key={izin.id}
                  izin={izin}
                  formatDate={formatDate}
                  detailLink={`/izin-santri/${izin.id}`}
                  onCompleted={() => {
                    if (user?.santriId) getIzinApplicationsBySantri(user.santriId)
                      .then(setIzinList).catch(() => setError("Laporan tersimpan, tetapi daftar gagal dimuat ulang."));
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
