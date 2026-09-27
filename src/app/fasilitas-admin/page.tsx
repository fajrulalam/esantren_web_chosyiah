"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowPathIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  HandThumbDownIcon,
  MapPinIcon,
  PhotoIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/firebase/auth";
import {
  getFacilityReports,
  reviewFacilityReport,
  saveFacilityRepairProof,
} from "@/firebase/facilityReports";
import {
  FACILITY_REPORT_STATUS_LABELS,
  MAX_FACILITY_REVIEW_NOTE_LENGTH,
  MIN_FACILITY_DECLINE_REASON_LENGTH,
  canReviewFacilityReports,
  countFacilityReportsByStatus,
  formatFacilityReportDate,
  validateFacilityReviewNote,
  type FacilityPhoto,
  type FacilityReport,
  type FacilityReportStatus,
} from "@/utils/facilityReports";
import FacilityModal from "@/components/facility/FacilityModal";
import FacilityPhotoLightbox from "@/components/facility/FacilityPhotoLightbox";
import FacilityPhotoPicker from "@/components/facility/FacilityPhotoPicker";
import {
  FacilityPhotoGrid,
  FacilityReportRowsSkeleton,
  FacilityStatusBadge,
} from "@/components/facility/FacilityReportParts";

type StatusFilter = "all" | FacilityReportStatus;
type ZoomHandler = (photo: { url: string; title: string }) => void;

const sectionLabelClass = "text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

function FacilityReportDetails({
  report,
  onZoom,
  onManageProof,
}: {
  report: FacilityReport;
  onZoom: ZoomHandler;
  onManageProof: (report: FacilityReport) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div>
          <p className={sectionLabelClass}>Lokasi Fasilitas</p>
          <p className="mt-0.5 break-words text-sm font-semibold text-gray-900 dark:text-white">{report.place}</p>
        </div>
        <div>
          <p className={sectionLabelClass}>Deskripsi Masalah atau Kondisi</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-200">
            {report.description}
          </p>
        </div>
        {report.reviewNote && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <p className={sectionLabelClass}>
              Catatan Tinjauan{report.reviewedByName ? ` · ${report.reviewedByName}` : ""}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">
              {report.reviewNote}
            </p>
          </div>
        )}
        {report.status === "resolved" && report.resolvedByName && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Diselesaikan Oleh
            </p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-900 dark:text-emerald-100">{report.resolvedByName}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className={sectionLabelClass}>
            Bukti Foto Laporan {report.photos.length > 0 ? `(${report.photos.length})` : ""}
          </p>
          <FacilityPhotoGrid
            photos={report.photos}
            label={`Foto laporan di ${report.place}`}
            emptyLabel="Tanpa bukti foto laporan"
            onZoom={onZoom}
            columns={2}
          />
        </div>
        {report.status === "resolved" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className={sectionLabelClass}>
                Bukti Foto Perbaikan {report.resolutionPhotos.length > 0 ? `(${report.resolutionPhotos.length})` : ""}
              </p>
              <button
                type="button"
                onClick={() => onManageProof(report)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <CameraIcon className="h-3.5 w-3.5" />
                {report.resolutionPhotos.length > 0 ? "Kelola Foto" : "Unggah Foto"}
              </button>
            </div>
            <FacilityPhotoGrid
              photos={report.resolutionPhotos}
              label={`Bukti perbaikan di ${report.place}`}
              emptyLabel="Tidak ada foto bukti perbaikan"
              onZoom={onZoom}
              columns={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_TILES: { filter: StatusFilter; label: string; count: string; active: string; idle: string; activeLabel: string }[] = [
  {
    filter: "pending",
    label: FACILITY_REPORT_STATUS_LABELS.pending,
    count: "text-amber-500 dark:text-amber-400",
    active: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/30",
    idle: "hover:bg-amber-50/50 dark:hover:bg-amber-950/20",
    activeLabel: "text-amber-700 dark:text-amber-300",
  },
  {
    filter: "resolved",
    label: FACILITY_REPORT_STATUS_LABELS.resolved,
    count: "text-emerald-500 dark:text-emerald-400",
    active: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/30",
    idle: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
    activeLabel: "text-emerald-700 dark:text-emerald-300",
  },
  {
    filter: "declined",
    label: FACILITY_REPORT_STATUS_LABELS.declined,
    count: "text-red-500 dark:text-red-400",
    active: "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 ring-2 ring-red-500/30",
    idle: "hover:bg-red-50/50 dark:hover:bg-red-950/20",
    activeLabel: "text-red-700 dark:text-red-300",
  },
  {
    filter: "all",
    label: "Total Laporan",
    count: "text-gray-700 dark:text-gray-100",
    active: "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 ring-2 ring-gray-400/30",
    idle: "hover:bg-gray-50 dark:hover:bg-gray-700/40",
    activeLabel: "text-gray-700 dark:text-gray-200",
  },
];

export default function FasilitasAdminPage() {
  const { user, loading: authLoading, isPreviewing } = useAuth();
  const router = useRouter();
  const allowed = canReviewFacilityReports(user);

  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string } | null>(null);

  const [reviewTarget, setReviewTarget] = useState<{ report: FacilityReport; nextStatus: FacilityReportStatus } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<FacilityPhoto[]>([]);
  const [proofTarget, setProofTarget] = useState<FacilityReport | null>(null);
  const [proofPhotos, setProofPhotos] = useState<FacilityPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redirect in an effect (not during render) so the router isn't updated
  // while this page is still rendering.
  useEffect(() => {
    if (!authLoading && !allowed) router.push("/");
  }, [authLoading, allowed, router]);

  const loadReports = useCallback(async () => {
    try {
      setReports(await getFacilityReports());
    } catch (error) {
      console.error("Error loading facility reports:", error);
      toast.error("Gagal memuat laporan fasilitas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && allowed) void loadReports();
  }, [authLoading, allowed, loadReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const counts = useMemo(() => countFacilityReportsByStatus(reports), [reports]);
  const filteredReports = useMemo(
    () => (statusFilter === "all" ? reports : reports.filter((report) => report.status === statusFilter)),
    [reports, statusFilter],
  );

  const toggleExpanded = (id: string) => setExpandedId((current) => (current === id ? null : id));

  const openReviewDialog = (report: FacilityReport, nextStatus: FacilityReportStatus) => {
    setReviewTarget({ report, nextStatus });
    setReviewNote("");
    setReviewPhotos(report.resolutionPhotos);
  };

  const openProofDialog = (report: FacilityReport) => {
    setProofTarget(report);
    setProofPhotos(report.resolutionPhotos);
  };

  const submitReview = async () => {
    if (!reviewTarget || saving || uploadingPhoto || !user) return;
    if (isPreviewing) {
      toast.error("Keluar dari Preview UI untuk menyimpan tinjauan.");
      return;
    }
    let note: string;
    try {
      note = validateFacilityReviewNote(reviewTarget.nextStatus, reviewNote);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Catatan tidak valid.");
      return;
    }

    setSaving(true);
    try {
      await reviewFacilityReport(
        reviewTarget.report.id,
        reviewTarget.nextStatus,
        note,
        reviewTarget.nextStatus === "resolved" ? reviewPhotos : undefined,
        user,
      );
      toast.success(
        `Laporan "${reviewTarget.report.place}" ditandai ${FACILITY_REPORT_STATUS_LABELS[reviewTarget.nextStatus]}.`,
      );
      setReviewTarget(null);
      await loadReports();
    } catch (error) {
      console.error("Error reviewing facility report:", error);
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui laporan.");
    } finally {
      setSaving(false);
    }
  };

  const submitProof = async () => {
    if (!proofTarget || saving || uploadingPhoto || !user) return;
    if (isPreviewing) {
      toast.error("Keluar dari Preview UI untuk menyimpan bukti perbaikan.");
      return;
    }
    setSaving(true);
    try {
      await saveFacilityRepairProof(proofTarget.id, proofPhotos, user);
      toast.success(`Bukti perbaikan di ${proofTarget.place} berhasil diperbarui.`);
      setProofTarget(null);
      await loadReports();
    } catch (error) {
      console.error("Error saving facility repair proof:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan bukti perbaikan.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!allowed) return null;

  const busy = saving || uploadingPhoto;
  const isDeclining = reviewTarget?.nextStatus === "declined";

  return (
    <div className="container mx-auto py-8 px-4 dark:bg-gray-900 transition-colors">
      {/* Page Header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
          <WrenchScrewdriverIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
            Review Kondisi Fasilitas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tinjau laporan fasilitas yang rusak, kotor, tidak terawat, atau membutuhkan perbaikan dari santri, lalu
            laporkan hasil perbaikannya.
          </p>
        </div>
      </div>

      {/* Summary / Filters */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
          Ringkasan Laporan
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{filteredReports.length} ditampilkan</span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-40"
            title="Muat ulang"
            aria-label="Muat ulang laporan"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_TILES.map((tile) => {
          const isActive = statusFilter === tile.filter;
          return (
            <button
              key={tile.filter}
              type="button"
              onClick={() => setStatusFilter(isActive && tile.filter !== "all" ? "all" : tile.filter)}
              aria-pressed={isActive}
              className={`min-h-20 rounded-lg border p-3 sm:p-4 text-center shadow-sm transition-all ${
                isActive ? tile.active : `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${tile.idle}`
              }`}
            >
              <div className={`text-2xl font-bold ${tile.count}`}>{counts[tile.filter]}</div>
              <div
                className={`mt-0.5 text-xs font-medium ${
                  isActive ? tile.activeLabel : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {tile.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Reports */}
      <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md transition-colors">
        {loading ? (
          <div className="p-3 sm:p-4">
            <FacilityReportRowsSkeleton />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-12 text-center">
            <WrenchScrewdriverIcon className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tidak ada laporan</p>
            <p className="mt-0.5 px-4 text-xs text-gray-500 dark:text-gray-400">
              Belum ada laporan kondisi fasilitas pada filter ini.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-3 md:hidden">
              {filteredReports.map((report) => {
                const isExpanded = expandedId === report.id;
                return (
                  <article
                    key={report.id}
                    className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpanded(report.id)}
                      aria-expanded={isExpanded}
                      className="w-full p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300">
                          <MapPinIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                              {report.place || "—"}
                            </h3>
                            <FacilityStatusBadge status={report.status} />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            {report.description || "—"}
                          </p>
                          <p className="mt-2 truncate text-xs text-gray-400 dark:text-gray-500">
                            {report.santriName || "—"}
                            {report.kamar ? ` · Kamar ${report.kamar}` : ""} · {formatFacilityReportDate(report.reportedDate)}
                          </p>
                        </div>
                        <ChevronDownIcon
                          className={`mt-1 h-4 w-4 shrink-0 transition-transform ${
                            isExpanded ? "rotate-180 text-blue-600" : "text-gray-400"
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 pl-12 text-xs font-medium">
                        <div className="flex min-w-0 items-center gap-2">
                          {report.photos.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                              <PhotoIcon className="h-3.5 w-3.5" />
                              {report.photos.length} foto
                            </span>
                          )}
                          {report.resolutionPhotos.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                              {report.resolutionPhotos.length} bukti
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-blue-600 dark:text-blue-400">
                          {isExpanded ? "Tutup detail" : "Lihat detail"}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
                        <FacilityReportDetails report={report} onZoom={setZoomPhoto} onManageProof={openProofDialog} />
                        {report.status === "pending" && (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => openReviewDialog(report, "resolved")}
                              className="flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              Selesai
                            </button>
                            <button
                              type="button"
                              onClick={() => openReviewDialog(report, "declined")}
                              className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-red-200 dark:border-red-800/60 bg-white dark:bg-gray-800 px-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <HandThumbDownIcon className="h-4 w-4" />
                              Tolak
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="w-10" />
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Pelapor
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Lokasi &amp; Kondisi
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      Tanggal
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tindakan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredReports.map((report) => {
                    const isExpanded = expandedId === report.id;
                    return (
                      <Fragment key={report.id}>
                        <tr
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          onClick={() => toggleExpanded(report.id)}
                        >
                          <td className="pl-4 py-4 align-top">
                            <ChevronRightIcon
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? "rotate-90 text-blue-600" : "text-gray-400"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                              {report.santriName || "—"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {report.kamar ? `Kamar ${report.kamar}` : "Kamar belum diatur"}
                            </span>
                          </td>
                          <td className="max-w-md px-4 py-4 align-top">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                              <MapPinIcon className="h-4 w-4 shrink-0 text-blue-500" />
                              <span className="truncate">{report.place}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                              {report.description}
                            </span>
                            {report.photos.length > 0 && (
                              <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                <PhotoIcon className="h-3.5 w-3.5" />
                                {report.photos.length > 1 ? `${report.photos.length} foto` : "Ada foto"}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-gray-600 dark:text-gray-300">
                            {formatFacilityReportDate(report.reportedDate)}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <FacilityStatusBadge status={report.status} />
                          </td>
                          <td className="px-4 py-4 align-top text-right" onClick={(event) => event.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {report.status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openReviewDialog(report, "resolved")}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                                  >
                                    <CheckCircleIcon className="h-3.5 w-3.5" />
                                    Selesai
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openReviewDialog(report, "declined")}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                  >
                                    <HandThumbDownIcon className="h-3.5 w-3.5" />
                                    Tolak
                                  </button>
                                </>
                              )}
                              {report.status === "resolved" && (
                                <button
                                  type="button"
                                  onClick={() => openProofDialog(report)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                >
                                  <CameraIcon className="h-3.5 w-3.5" />
                                  {report.resolutionPhotos.length > 0 ? "Bukti Foto" : "+ Bukti Foto"}
                                </button>
                              )}
                              {report.status === "declined" && (
                                <span className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500">Buka detail</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50 dark:bg-gray-900/40 p-4 sm:p-5">
                              <FacilityReportDetails report={report} onZoom={setZoomPhoto} onManageProof={openProofDialog} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Resolve / decline dialog */}
      <FacilityModal
        isOpen={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        busy={busy}
        size="lg"
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />}
        title={reviewTarget ? `Tandai ${FACILITY_REPORT_STATUS_LABELS[reviewTarget.nextStatus]}` : "Tinjau Laporan"}
        description={
          <>
            Laporan <strong>“{reviewTarget?.report.place}”</strong> oleh <strong>{reviewTarget?.report.santriName}</strong>.
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="facility-review-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {isDeclining ? (
                <>
                  Alasan Penolakan <span className="text-red-500">*</span>
                </>
              ) : (
                "Catatan Perbaikan (Opsional)"
              )}
            </label>
            <textarea
              id="facility-review-note"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value.slice(0, MAX_FACILITY_REVIEW_NOTE_LENGTH))}
              rows={3}
              disabled={saving}
              placeholder={
                isDeclining
                  ? "Contoh: Fasilitas ini sudah dilaporkan sebelumnya."
                  : "Contoh: Keran sudah diganti pada Senin, 28 September."
              }
              className="block min-h-24 w-full resize-y rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {reviewNote.length}/{MAX_FACILITY_REVIEW_NOTE_LENGTH} karakter
              {isDeclining ? ` · minimal ${MIN_FACILITY_DECLINE_REASON_LENGTH}` : ""}
            </p>
          </div>

          {reviewTarget?.nextStatus === "resolved" && (
            <div className="space-y-1.5">
              <p className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bukti Foto Perbaikan (Opsional)</p>
              <FacilityPhotoPicker
                photos={reviewPhotos}
                onPhotosChange={setReviewPhotos}
                kind="proof"
                user={user}
                disabled={saving || isPreviewing}
                onUploadingChange={setUploadingPhoto}
              />
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setReviewTarget(null)}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void submitReview()}
              disabled={busy || isPreviewing}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDeclining ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {saving ? "Menyimpan..." : isDeclining ? "Tolak Laporan" : "Tandai Selesai"}
            </button>
          </div>
        </div>
      </FacilityModal>

      {/* Manage proof-of-fix photos on a resolved report */}
      <FacilityModal
        isOpen={Boolean(proofTarget)}
        onClose={() => setProofTarget(null)}
        busy={busy}
        size="lg"
        icon={<CameraIcon className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        title="Kelola Bukti Perbaikan"
        description={
          <>
            Laporan <strong>“{proofTarget?.place}”</strong>. Tambah, ganti, atau hapus foto kondisi fasilitas setelah
            diperbaiki.
          </>
        }
      >
        <div className="space-y-4">
          <FacilityPhotoPicker
            photos={proofPhotos}
            onPhotosChange={setProofPhotos}
            kind="proof"
            user={user}
            disabled={saving || isPreviewing}
            onUploadingChange={setUploadingPhoto}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setProofTarget(null)}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void submitProof()}
              disabled={busy || isPreviewing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan Bukti Foto"}
            </button>
          </div>
        </div>
      </FacilityModal>

      <FacilityPhotoLightbox photo={zoomPhoto} onClose={() => setZoomPhoto(null)} />
    </div>
  );
}
