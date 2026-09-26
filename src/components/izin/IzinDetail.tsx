"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/firebase/auth";
import type { IzinSakitPulang } from "@/types/izinSakitPulang";
import { formatDate } from "@/utils/date";
import { isIzinOngoing, izinStatusLabel } from "@/utils/izinWorkflow";
import IzinCompletionAction from "./IzinCompletionAction";

export default function IzinDetail({ id, admin = false }: { id: string; admin?: boolean }) {
  const { user, loading, santriName } = useAuth();
  const router = useRouter();
  const [izin, setIzin] = useState<(IzinSakitPulang & { santriName?: string }) | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const base = admin ? "/izin-admin" : "/izin-santri";
  const hasAccess = !!user && (admin
    ? ["pengurus", "pengasuh", "superAdmin"].includes(user.role)
    : (user.role === "waliSantri" || user.role === "bendahara") && !!user.santriId);

  useEffect(() => {
    if (loading) return;
    if (!hasAccess) { router.push("/"); return; }
    let cancelled = false;
    setFetching(true);
    setIzin(null);
    setError(null);
    async function fetchReport() {
      try {
        const snapshot = await getDoc(doc(db, "SakitDanPulangCollection", id));
        if (!snapshot.exists()) throw new Error("Laporan tidak ditemukan.");
        const record = { ...snapshot.data(), id: snapshot.id } as IzinSakitPulang;
        if (!admin && record.santriId !== user?.santriId) {
          throw new Error("Anda tidak memiliki akses untuk melihat laporan ini.");
        }
        let name = santriName || "Santri";
        if (admin) {
          const santri = await getDoc(doc(db, "SantriCollection", record.santriId));
          name = santri.exists() ? santri.data().nama || "Santri" : "Data santri tidak ditemukan";
        }
        if (!cancelled) setIzin({ ...record, santriName: name });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat laporan.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    void fetchReport();
    return () => { cancelled = true; };
  }, [id, admin, user, loading, hasAccess, router, refresh, santriName]);

  if (loading || !hasAccess) return null;
  const completionActor = izin?.izinType === "Pulang"
    ? izin.returnReportedBy || izin.returnVerifiedBy
    : izin?.recoveryReportedBy || izin?.recoveryVerifiedBy;
  const completedAt = izin?.izinType === "Pulang" ? izin.tanggalKembali : izin?.tanggalSembuh;

  return <div className="container mx-auto max-w-3xl px-4 py-8">
    <Link href={base} className="text-sm text-indigo-600 dark:text-indigo-300">← Kembali ke Daftar Laporan</Link>
    {fetching ? <p role="status" className="mt-6">Memuat laporan...</p> : error ? <p role="alert" className="mt-6 text-red-600">{error}</p> : izin &&
      <article className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <h1 className="text-xl font-semibold">Laporan Izin {izin.izinType}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{izin.santriName}</p>
          <p className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-300">{izinStatusLabel(izin)}</p>
        </div>
        <dl className="grid gap-5 p-6 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500 dark:text-gray-400">Dilaporkan</dt><dd className="mt-1">{formatDate(izin.timestamp)}</dd></div>
          <div><dt className="text-gray-500 dark:text-gray-400">{izin.izinType === "Pulang" ? "Alasan" : "Keluhan"}</dt><dd className="mt-1 break-words">{izin.izinType === "Pulang" ? izin.alasan : izin.keluhan}</dd></div>
          {izin.izinType === "Pulang" && <>
            <div><dt className="text-gray-500 dark:text-gray-400">Tanggal Pulang</dt><dd className="mt-1">{formatDate(izin.tglPulang)}</dd></div>
            <div><dt className="text-gray-500 dark:text-gray-400">Rencana Kembali</dt><dd className="mt-1">{formatDate(izin.rencanaTanggalKembali)}</dd></div>
            {typeof izin.kembaliSesuaiRencana === "boolean" && <div><dt className="text-gray-500 dark:text-gray-400">Ketepatan Kembali</dt><dd className="mt-1">{izin.kembaliSesuaiRencana ? "Tepat waktu" : "Terlambat"}</dd></div>}
          </>}
          {completedAt && <div><dt className="text-gray-500 dark:text-gray-400">{izin.izinType === "Pulang" ? "Tanggal Kembali" : "Tanggal Sembuh"}</dt><dd className="mt-1">{formatDate(completedAt)}</dd></div>}
          {completionActor && <div><dt className="text-gray-500 dark:text-gray-400">Dicatat oleh</dt><dd className="mt-1">
            {completionActor.name || (completionActor.role === "waliSantri" || completionActor.role === "bendahara" ? "Santri" : "Pengurus")}
            {completionActor.timestamp && <span className="mt-1 block text-gray-500 dark:text-gray-400">{formatDate(completionActor.timestamp)}</span>}
          </dd></div>}
        </dl>
        {isIzinOngoing(izin) && <div className="border-t border-gray-200 p-6 dark:border-gray-700">
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            {izin.izinType === "Pulang" ? "Santri atau pengurus dapat melaporkan setelah santri kembali ke asrama." : "Santri atau pengurus dapat melaporkan setelah santri sembuh."}
          </p>
          <IzinCompletionAction key={izin.id} izin={izin} onCompleted={() => setRefresh(value => value + 1)} />
        </div>}
      </article>}
  </div>;
}
