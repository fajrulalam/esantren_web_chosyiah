"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/firebase/auth";
import {
  EyeSlashIcon,
  ShieldExclamationIcon,
  MapIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

interface HiddenPage {
  href: string;
  label: string;
  description: string;
}

interface RestrictedPage {
  href: string;
  label: string;
  description: string;
  forRole: string;
  redirectsTo: string;
}

interface DynamicPage {
  pattern: string;
  label: string;
  reachVia: { href: string; label: string };
}

// Pages superAdmin can already open, but that have no link anywhere in the
// navbar — so they're invisible unless you know the URL.
const HIDDEN_PAGES: HiddenPage[] = [
  {
    href: "/registration",
    label: "Pendaftaran Santri Baru",
    description: "Formulir publik yang dipakai calon santri untuk mendaftar. Tidak ada gerbang login sama sekali.",
  },
  {
    href: "/data-santri/denah",
    label: "Denah Kamar",
    description: "Denah 9 blok asrama dan penempatan santri per kamar. Hanya bisa dibuka lewat tombol di dalam halaman Data Santri.",
  },
  {
    href: "/attendance/history",
    label: "Riwayat Presensi",
    description: "Riwayat sesi presensi yang sudah lampau.",
  },
  {
    href: "/attendance/report",
    label: "Laporan Presensi",
    description: "Rekap presensi dalam rentang tanggal tertentu.",
  },
  {
    href: "/attendance/types",
    label: "Jenis Presensi",
    description: "Pengaturan jenis-jenis sesi presensi (Subuh, Maghrib, Ngaji, dll).",
  },
];

// Pages that actively redirect a superAdmin away — visiting these will bounce
// you back out. Listed here for visibility only; their access checks are
// untouched.
const RESTRICTED_PAGES: RestrictedPage[] = [
  {
    href: "/payment-history",
    label: "History Pembayaran",
    description: "Riwayat pembayaran dari sudut pandang wali santri.",
    forRole: "waliSantri",
    redirectsTo: "/rekapitulasi",
  },
  {
    href: "/my-vouchers",
    label: "Voucher 375",
    description: "Daftar voucher milik satu wali santri / santri.",
    forRole: "waliSantri & santri",
    redirectsTo: "/",
  },
  {
    href: "/izin-santri",
    label: "Izin Sakit / Pulang",
    description: "Daftar pengajuan izin dari sudut pandang wali santri.",
    forRole: "waliSantri",
    redirectsTo: "/",
  },
  {
    href: "/izin-santri/new",
    label: "Ajukan Izin Baru",
    description: "Formulir pengajuan izin sakit/pulang.",
    forRole: "waliSantri",
    redirectsTo: "/",
  },
];

// Routes that need a real record id in the URL — nothing generic to link to,
// so point back at the list page where a real instance can be opened.
const DYNAMIC_PAGES: DynamicPage[] = [
  {
    pattern: "/attendance/[sessionId]",
    label: "Detail Sesi Presensi",
    reachVia: { href: "/attendance", label: "Presensi" },
  },
  {
    pattern: "/izin-admin/[id]",
    label: "Detail Pengajuan Izin",
    reachVia: { href: "/izin-admin", label: "Izin Santri (admin)" },
  },
  {
    pattern: "/izin-santri/[id]",
    label: "Detail Izin (sisi wali santri)",
    reachVia: { href: "/izin-admin", label: "Izin Santri (admin)" },
  },
  {
    pattern: "/rekapitulasi-detail/[id]",
    label: "Detail Rekapitulasi",
    reachVia: { href: "/rekapitulasi", label: "Rekapitulasi" },
  },
];

export default function DebugPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "superAdmin") {
        router.push("/");
      } else {
        setIsAuthorized(true);
      }
    }
  }, [user, loading, router]);

  if (loading || !isAuthorized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 dark:bg-gray-900 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <MapIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        <h1 className="text-2xl font-bold dark:text-white transition-colors">
          Debug — Navigasi Halaman
        </h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-3xl">
        Daftar semua halaman di aplikasi yang tidak muncul di menu navigasi Anda sebagai superAdmin.
        Halaman yang sudah ada di navbar (Rekapitulasi, Data Santri, Presensi, Kegiatan, Izin Santri,
        User Management, Voucher Asrama) tidak diulang di sini.
      </p>

      {/* Hidden but accessible */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <EyeSlashIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold dark:text-white">
            Tersembunyi, tapi bisa dibuka
          </h2>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            ({HIDDEN_PAGES.length})
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Halaman ini tidak punya link di navbar, tapi terbuka normal untuk superAdmin.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HIDDEN_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all border border-transparent hover:border-blue-300 dark:hover:border-blue-700"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {page.label}
                </h3>
                <LinkIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" />
              </div>
              <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
                {page.href}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {page.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Restricted / redirect */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldExclamationIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-lg font-semibold dark:text-white">
            Dibatasi untuk peran lain
          </h2>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            ({RESTRICTED_PAGES.length})
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Halaman ini punya pengecekan peran sendiri yang akan langsung mengalihkan superAdmin.
          Tetap ditampilkan di sini untuk transparansi &mdash; tidak ada perubahan pada logika akses halaman-halaman ini.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RESTRICTED_PAGES.map((page) => (
            <div
              key={page.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border border-amber-200 dark:border-amber-900"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {page.label}
                </h3>
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-400 flex-shrink-0">
                  {page.forRole}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                {page.href}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {page.description}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                Anda akan dialihkan ke <span className="font-mono">{page.redirectsTo}</span> jika membuka ini.
              </p>
              <Link
                href={page.href}
                className="inline-block mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Coba buka tetap &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Dynamic routes */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold dark:text-white">
            Halaman dinamis
          </h2>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            ({DYNAMIC_PAGES.length})
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Butuh ID data spesifik di URL-nya, jadi tidak ada satu link generik untuk dibuka. Buka lewat halaman daftarnya.
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
          {DYNAMIC_PAGES.map((page) => (
            <div
              key={page.pattern}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {page.label}
                </p>
                <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                  {page.pattern}
                </p>
              </div>
              <Link
                href={page.reachVia.href}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Buka via {page.reachVia.label} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
