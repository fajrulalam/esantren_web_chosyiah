// Rules shared by the santri report page, the super admin review page, and
// the Firestore service, so all three agree on who may do what. Kept free of
// Firebase and "@/" imports so it can be unit tested with plain Node.

export const FACILITY_REPORTS_COLLECTION = "FacilityReports";

export const FACILITY_SANTRI_PATH = "/fasilitas-santri";
export const FACILITY_ADMIN_PATH = "/fasilitas-admin";

/**
 * The reporting form offers this fixed list of asrama areas plus "Lainnya",
 * which reveals a free-text field instead. `place` on the report itself stays
 * a plain string either way.
 */
export const FACILITY_AREAS = [
  "Kamar Tidur",
  "Kamar Mandi",
  "Musholla",
  "Kantin & Loker",
  "Lorong & Tangga",
  "Area Jemuran",
  "Halaman Asrama",
  "Lainnya",
] as const;

export type FacilityArea = (typeof FACILITY_AREAS)[number];

export const DEFAULT_FACILITY_AREA: FacilityArea = "Kamar Mandi";
export const FACILITY_AREA_OTHER: FacilityArea = "Lainnya";

export function isFacilityArea(value: unknown): value is FacilityArea {
  return typeof value === "string" && (FACILITY_AREAS as readonly string[]).includes(value);
}

/**
 * A report starts `pending`. The super admin closes it as `resolved` (with
 * optional proof photos of the fix) or `declined` (always with a reason).
 */
export const FACILITY_REPORT_STATUSES = ["pending", "resolved", "declined"] as const;

export type FacilityReportStatus = (typeof FACILITY_REPORT_STATUSES)[number];

export const FACILITY_REPORT_STATUS_LABELS: Record<FacilityReportStatus, string> = {
  pending: "Menunggu",
  resolved: "Selesai",
  declined: "Ditolak",
};

export function isFacilityReportStatus(value: unknown): value is FacilityReportStatus {
  return typeof value === "string" && (FACILITY_REPORT_STATUSES as readonly string[]).includes(value);
}

export function facilityReportStatusTone(status: FacilityReportStatus): string {
  switch (status) {
    case "resolved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";
    case "declined":
      return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
    default:
      return "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200";
  }
}

/** Only a pending report can be closed, and only as resolved or declined. */
export function canTransitionFacilityReport(
  from: FacilityReportStatus,
  to: FacilityReportStatus,
): boolean {
  return from === "pending" && (to === "resolved" || to === "declined");
}

export const MAX_FACILITY_PLACE_LENGTH = 160;
export const MAX_FACILITY_DESCRIPTION_LENGTH = 2000;
export const MAX_FACILITY_REVIEW_NOTE_LENGTH = 500;
export const MIN_FACILITY_DECLINE_REASON_LENGTH = 8;

/** Each photo is compressed client-side to this cap before upload. */
export const MAX_FACILITY_PHOTO_BYTES = 1024 * 1024;
export const MAX_FACILITY_PHOTOS = 5;

// Santri sessions have no Firebase Auth, so their uploads must live under the
// same public-uploads prefix the registration form already writes to.
export const FACILITY_REPORT_PHOTO_PREFIX = "public-uploads/facility-reports/";
export const FACILITY_PROOF_PHOTO_PREFIX = "public-uploads/facility-report-proofs/";
// Firebase Storage download URLs, plus the local Storage emulator's.
const STORAGE_URL_PREFIXES = ["https://firebasestorage.googleapis.com/", "http://127.0.0.1:", "http://localhost:"];

/** The object path a Storage download URL points at (".../o/<encoded path>?..."). */
function storageObjectPath(url: string): string | null {
  try {
    const encodedPath = new URL(url).pathname.split("/o/")[1];
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

export interface FacilityPhoto {
  url: string;
  storagePath: string;
}

export interface FacilityReport {
  id: string;
  santriId: string;
  santriName: string;
  kamar?: string | null;
  reportedByUid: string;
  place: string;
  description: string;
  photos: FacilityPhoto[];
  /** Photos the super admin attached after the facility was fixed. */
  resolutionPhotos: FacilityPhoto[];
  status: FacilityReportStatus;
  /** Jakarta calendar date (YYYY-MM-DD) of submission. */
  reportedDate: string;
  reportedAtMillis: number | null;
  reviewNote?: string | null;
  reviewedByName?: string | null;
  reviewedAtMillis?: number | null;
  resolvedByName?: string | null;
  resolvedAtMillis?: number | null;
}

/** The subset of the signed-in user these rules look at. */
export interface FacilityActor {
  uid?: string | null;
  role?: string | null;
  santriId?: string | null;
}

/** Every santri (including a santri serving as bendahara) can report. */
export function canSubmitFacilityReport(user: FacilityActor | null | undefined): boolean {
  if (!user?.santriId) return false;
  return user.role === "waliSantri" || user.role === "bendahara";
}

/** Only the super admin reviews reports and records the fix. */
export function canReviewFacilityReports(user: FacilityActor | null | undefined): boolean {
  return user?.role === "superAdmin";
}

/**
 * A reporter may take back their own report until it has been acted on; the
 * super admin may remove any report.
 */
export function canWithdrawFacilityReport(
  user: FacilityActor | null | undefined,
  report: Pick<FacilityReport, "santriId" | "status">,
): boolean {
  if (canReviewFacilityReports(user)) return true;
  return canSubmitFacilityReport(user) && user!.santriId === report.santriId && report.status === "pending";
}

function requireText(raw: unknown, label: string, max: number, min = 1): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length < min) {
    throw new Error(min > 1 ? `${label} wajib diisi minimal ${min} karakter.` : `${label} wajib diisi.`);
  }
  if (value.length > max) throw new Error(`${label} maksimal ${max} karakter.`);
  return value;
}

export function validateFacilityReportInput(input: { place: unknown; description: unknown }) {
  return {
    place: requireText(input.place, "Lokasi fasilitas", MAX_FACILITY_PLACE_LENGTH),
    description: requireText(
      input.description,
      "Deskripsi masalah atau kondisi",
      MAX_FACILITY_DESCRIPTION_LENGTH,
    ),
  };
}

/** A rejection must always explain itself; a resolution note is optional. */
export function validateFacilityReviewNote(status: FacilityReportStatus, raw: unknown): string {
  const note = typeof raw === "string" ? raw.trim() : "";
  if (status === "declined" && note.length < MIN_FACILITY_DECLINE_REASON_LENGTH) {
    throw new Error(`Alasan penolakan wajib diisi minimal ${MIN_FACILITY_DECLINE_REASON_LENGTH} karakter.`);
  }
  if (note.length > MAX_FACILITY_REVIEW_NOTE_LENGTH) {
    throw new Error(`Catatan maksimal ${MAX_FACILITY_REVIEW_NOTE_LENGTH} karakter.`);
  }
  return note;
}

/**
 * Accepts only Firebase Storage photos under `expectedPrefix`. Photos already
 * on the report are kept even if someone else uploaded them.
 */
export function normalizeFacilityPhotos(
  raw: unknown,
  expectedPrefix: string,
  existing: readonly FacilityPhoto[] = [],
): FacilityPhoto[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("Daftar foto tidak valid.");
  if (raw.length > MAX_FACILITY_PHOTOS) {
    throw new Error(`Maksimal ${MAX_FACILITY_PHOTOS} foto per laporan.`);
  }
  const existingUrls = new Set(existing.map((photo) => photo.url));
  return raw.map((entry, index) => {
    const photo = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const url = typeof photo.url === "string" ? photo.url.trim() : "";
    const storagePath = typeof photo.storagePath === "string" ? photo.storagePath : "";
    if (!STORAGE_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new Error(`Foto ke-${index + 1} tidak valid.`);
    }
    if (existingUrls.has(url)) return { url, storagePath };
    if (storageObjectPath(url) !== storagePath) {
      throw new Error(`Foto ke-${index + 1} tidak valid.`);
    }
    if (!storagePath.startsWith(expectedPrefix)) {
      throw new Error(`Foto ke-${index + 1} bukan unggahan Anda.`);
    }
    return { url, storagePath };
  });
}

export function todayJakartaISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** e.g. FAC-20260927-3F9A1C0B7D2E — readable, sortable, and collision-safe. */
export function createFacilityReportId(now: Date = new Date(), uuid: string = crypto.randomUUID()): string {
  const suffix = uuid.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `FAC-${todayJakartaISO(now).replaceAll("-", "")}-${suffix}`;
}

/** The folder holding one santri's (or the super admin's) uploads. */
export function facilityPhotoOwnerPrefix(prefix: string, ownerId: string): string {
  return `${prefix}${ownerId.replace(/[^A-Za-z0-9_-]/g, "_")}/`;
}

/** A unique object path so several photos uploaded together never collide. */
export function facilityPhotoStoragePath(
  prefix: string,
  ownerId: string,
  now: number = Date.now(),
  uuid: string = crypto.randomUUID(),
): string {
  return `${facilityPhotoOwnerPrefix(prefix, ownerId)}${now}_${uuid.slice(0, 8)}.jpg`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function formatFacilityReportDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  const [year, month, day] = value.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] || month} ${year}`;
}

/** Newest first; reports without a server timestamp fall back to their date. */
export function sortFacilityReports<T extends Pick<FacilityReport, "reportedAtMillis" | "reportedDate">>(
  reports: T[],
): T[] {
  return [...reports].sort((a, b) => {
    const timestampA = Number(a.reportedAtMillis || 0);
    const timestampB = Number(b.reportedAtMillis || 0);
    if (timestampA !== timestampB) return timestampB - timestampA;
    return String(b.reportedDate || "").localeCompare(String(a.reportedDate || ""));
  });
}

export function countFacilityReportsByStatus(reports: Pick<FacilityReport, "status">[]) {
  const counts: Record<FacilityReportStatus | "all", number> = {
    all: reports.length,
    pending: 0,
    resolved: 0,
    declined: 0,
  };
  for (const report of reports) counts[report.status] += 1;
  return counts;
}
