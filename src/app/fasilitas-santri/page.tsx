"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Listbox } from "@headlessui/react";
import { toast } from "react-hot-toast";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/firebase/auth";
import {
  createFacilityReport,
  getFacilityReports,
  withdrawFacilityReport,
} from "@/firebase/facilityReports";
import {
  DEFAULT_FACILITY_AREA,
  FACILITY_AREA_OTHER,
  FACILITY_AREAS,
  MAX_FACILITY_DESCRIPTION_LENGTH,
  MAX_FACILITY_PLACE_LENGTH,
  canSubmitFacilityReport,
  canWithdrawFacilityReport,
  createFacilityReportId,
  formatFacilityReportDate,
  validateFacilityReportInput,
  type FacilityArea,
  type FacilityPhoto,
  type FacilityReport,
} from "@/utils/facilityReports";
import FacilityModal from "@/components/facility/FacilityModal";
import FacilityPhotoLightbox from "@/components/facility/FacilityPhotoLightbox";
import FacilityPhotoPicker from "@/components/facility/FacilityPhotoPicker";
import {
  FacilityPhotoGrid,
  FacilityReportRowsSkeleton,
  FacilityStatusBadge,
} from "@/components/facility/FacilityReportParts";

const inputClass =
  "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder:text-gray-400";

export default function FasilitasSantriPage() {
  const { user, loading: authLoading, isPreviewing } = useAuth();
  const router = useRouter();
  const allowed = canSubmitFacilityReport(user);

  const [reports, setReports] = useState<FacilityReport[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [area, setArea] = useState<FacilityArea>(DEFAULT_FACILITY_AREA);
  const [customPlace, setCustomPlace] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<FacilityPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Reused when a submit is retried, so an uncertain network response can't
  // create the same report twice.
  const reportIdRef = useRef<string | null>(null);

  const [withdrawTarget, setWithdrawTarget] = useState<FacilityReport | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string } | null>(null);

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

  const resetForm = () => {
    setArea(DEFAULT_FACILITY_AREA);
    setCustomPlace("");
    setDescription("");
    setPhotos([]);
    reportIdRef.current = null;
  };

  const handleSubmit = async () => {
    if (submitting || uploadingPhoto || !user) return;
    if (isPreviewing) {
      toast.error("Keluar dari Preview UI untuk mengirim laporan.");
      return;
    }
    let input: { place: string; description: string };
    try {
      input = validateFacilityReportInput({
        place: area === FACILITY_AREA_OTHER ? customPlace : area,
        description,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Data laporan belum lengkap.");
      return;
    }

    setSubmitting(true);
    try {
      reportIdRef.current ??= createFacilityReportId();
      await createFacilityReport({ ...input, photos }, user, reportIdRef.current);
      toast.success("Laporan kondisi fasilitas berhasil dikirim ke Super Admin.");
      resetForm();
      setShowForm(false);
      await loadReports();
    } catch (error) {
      console.error("Error submitting facility report:", error);
      toast.error(error instanceof Error ? error.message : "Gagal mengirim laporan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget || withdrawing || !user) return;
    setWithdrawing(true);
    try {
      await withdrawFacilityReport(withdrawTarget.id, user);
      toast.success("Laporan berhasil ditarik kembali.");
      setWithdrawTarget(null);
      await loadReports();
    } catch (error) {
      console.error("Error withdrawing facility report:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menarik laporan.");
    } finally {
      setWithdrawing(false);
    }
  };

  const toggleReport = (reportId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (!allowed) return null;

  const formBusy = submitting || isPreviewing;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 dark:bg-gray-900 transition-colors">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
            <WrenchScrewdriverIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">
              Lapor Kondisi Fasilitas
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Laporkan fasilitas asrama yang rusak, kotor, tidak terawat, atau membutuhkan perbaikan agar
              segera ditangani Super Admin.
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Laporkan Kondisi
          </button>
        )}
      </div>

      {isPreviewing && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          Keluar dari Preview UI untuk mengirim atau menarik laporan.
        </p>
      )}

      {/* New Report Form */}
      {showForm && (
        <section className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-md p-5 space-y-5 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Laporan Baru</h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={submitting || uploadingPhoto}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
              title="Tutup"
              aria-label="Tutup formulir"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <Listbox value={area} onChange={setArea} disabled={formBusy}>
              <Listbox.Label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Lokasi Fasilitas <span className="text-red-500">*</span>
              </Listbox.Label>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-left text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <span className="block truncate">{area}</span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute left-0 z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 border border-gray-100 focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:ring-white/10">
                  {FACILITY_AREAS.map((option) => (
                    <Listbox.Option
                      key={option}
                      value={option}
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
                              selected ? "font-semibold text-blue-600 dark:text-blue-400" : "font-normal"
                            }`}
                          >
                            {option}
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
            {area === FACILITY_AREA_OTHER && (
              <>
                <input
                  type="text"
                  value={customPlace}
                  onChange={(event) => setCustomPlace(event.target.value.slice(0, MAX_FACILITY_PLACE_LENGTH))}
                  placeholder="Contoh: Pintu gerbang depan"
                  aria-label="Sebutkan lokasi fasilitas"
                  className={inputClass}
                  disabled={formBusy}
                  autoFocus
                />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {customPlace.length}/{MAX_FACILITY_PLACE_LENGTH} karakter
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="facility-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Deskripsi Masalah atau Kondisi <span className="text-red-500">*</span>
            </label>
            <textarea
              id="facility-description"
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, MAX_FACILITY_DESCRIPTION_LENGTH))}
              rows={4}
              placeholder="Keran bocor, lampu kamar 203 B mati, dll."
              className={`${inputClass} resize-y`}
              disabled={formBusy}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {description.length}/{MAX_FACILITY_DESCRIPTION_LENGTH}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto (Opsional)</p>
            <FacilityPhotoPicker
              photos={photos}
              onPhotosChange={setPhotos}
              kind="report"
              user={user}
              disabled={formBusy}
              onUploadingChange={setUploadingPhoto}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={formBusy || uploadingPhoto}
            className="flex w-full items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-4 h-4" />
            )}
            {submitting ? "Mengirim..." : "Kirim Laporan"}
          </button>
        </section>
      )}

      {/* Report History */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1 pb-1">
          <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
            Riwayat Laporan Semua Santri
          </h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-2" />
        </div>

        {loading ? (
          <FacilityReportRowsSkeleton />
        ) : reports.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <WrenchScrewdriverIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Belum ada laporan</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Semua laporan kondisi fasilitas yang dikirim santri akan tampil di sini.
            </p>
          </div>
        ) : (
          reports.map((report) => {
            const isExpanded = expandedIds.has(report.id);
            const isMine = report.santriId === user?.santriId;
            return (
              <article
                key={report.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => toggleReport(report.id)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <MapPinIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{report.place}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatFacilityReportDate(report.reportedDate)} · {report.santriName || "Santri"}
                        {isMine && <span className="text-blue-600 dark:text-blue-400"> (Anda)</span>}
                      </p>
                    </div>
                    <FacilityStatusBadge status={report.status} />
                    <ChevronDownIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {canWithdrawFacilityReport(user, report) && (
                    <button
                      type="button"
                      onClick={() => setWithdrawTarget(report)}
                      disabled={isPreviewing}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Tarik kembali laporan"
                      aria-label={`Tarik kembali laporan ${report.place}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3">
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                      {report.description}
                    </p>

                    <FacilityPhotoGrid
                      photos={report.photos}
                      label={`Foto laporan di ${report.place}`}
                      onZoom={setZoomPhoto}
                    />

                    {report.reviewNote && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 p-3">
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Catatan Super Admin
                          {report.reviewedByName ? ` · ${report.reviewedByName}` : ""}
                        </p>
                        <p className="text-sm text-gray-800 dark:text-gray-100 mt-0.5 whitespace-pre-wrap break-words">
                          {report.reviewNote}
                        </p>
                      </div>
                    )}

                    {report.status === "resolved" && report.resolutionPhotos.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                          Bukti Perbaikan ({report.resolutionPhotos.length})
                        </p>
                        <FacilityPhotoGrid
                          photos={report.resolutionPhotos}
                          label={`Bukti perbaikan di ${report.place}`}
                          onZoom={setZoomPhoto}
                        />
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      <FacilityModal
        isOpen={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        busy={withdrawing}
        title="Tarik Kembali Laporan?"
        icon={
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <ExclamationTriangleIcon className="w-5 h-5" />
          </div>
        }
        description={
          <>
            Laporan <strong>“{withdrawTarget?.place}”</strong> akan dihapus dan tidak lagi ditinjau Super Admin.
          </>
        }
      >
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setWithdrawTarget(null)}
            disabled={withdrawing}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleWithdraw()}
            disabled={withdrawing}
            className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {withdrawing ? "Menarik..." : "Tarik Laporan"}
          </button>
        </div>
      </FacilityModal>

      <FacilityPhotoLightbox photo={zoomPhoto} onClose={() => setZoomPhoto(null)} />
    </div>
  );
}
