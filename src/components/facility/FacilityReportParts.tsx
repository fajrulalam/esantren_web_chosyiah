import { PhotoIcon } from "@heroicons/react/24/outline";
import {
  FACILITY_REPORT_STATUS_LABELS,
  facilityReportStatusTone,
  type FacilityPhoto,
  type FacilityReportStatus,
} from "@/utils/facilityReports";

export function FacilityStatusBadge({ status }: { status: FacilityReportStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-semibold ${facilityReportStatusTone(status)}`}
    >
      {FACILITY_REPORT_STATUS_LABELS[status]}
    </span>
  );
}

/** Placeholder rows shaped like the real report cards (place, date line, badge). */
export function FacilityReportRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-100 animate-pulse dark:bg-gray-700" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-40 max-w-full rounded-full bg-gray-200 animate-pulse dark:bg-gray-700" />
            <div className="h-2.5 w-56 max-w-full rounded-full bg-gray-100 animate-pulse dark:bg-gray-700/60" />
          </div>
          <div className="h-5 w-16 shrink-0 rounded bg-gray-100 animate-pulse dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

interface FacilityPhotoGridProps {
  photos: FacilityPhoto[];
  /** Used for alt text and the lightbox title, e.g. "Foto laporan di Musholla". */
  label: string;
  onZoom: (photo: { url: string; title: string }) => void;
  emptyLabel?: string;
  columns?: 2 | 3;
}

export function FacilityPhotoGrid({ photos, label, onZoom, emptyLabel, columns = 3 }: FacilityPhotoGridProps) {
  if (photos.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs font-medium text-gray-500 dark:border-gray-600 dark:bg-gray-700/40 dark:text-gray-400">
        <PhotoIcon className="h-5 w-5" />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {photos.map((photo, index) => (
        <button
          key={photo.url}
          type="button"
          onClick={() => onZoom({ url: photo.url, title: `${label} (${index + 1}/${photos.length})` })}
          className="block aspect-square cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-700"
          aria-label={`Buka ${label.toLowerCase()}, foto ${index + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={`${label} ${index + 1}`}
            // Grids only mount once a report is expanded, so load right away.
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
          />
        </button>
      ))}
    </div>
  );
}
