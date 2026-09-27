import { db, storage } from "./config";
import {
  collection, doc, getDocs, runTransaction, serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { UserData } from "@/firebase/auth";
import { compressImageToLimit } from "@/utils/imageCompression";
import {
  FACILITY_PROOF_PHOTO_PREFIX,
  FACILITY_REPORT_PHOTO_PREFIX,
  FACILITY_REPORTS_COLLECTION,
  MAX_FACILITY_PHOTO_BYTES,
  canReviewFacilityReports,
  canSubmitFacilityReport,
  canTransitionFacilityReport,
  canWithdrawFacilityReport,
  facilityPhotoOwnerPrefix,
  facilityPhotoStoragePath,
  isFacilityReportStatus,
  normalizeFacilityPhotos,
  sortFacilityReports,
  todayJakartaISO,
  validateFacilityReportInput,
  validateFacilityReviewNote,
  type FacilityPhoto,
  type FacilityReport,
  type FacilityReportStatus,
} from "@/utils/facilityReports";

// Report photo URLs are immutable (unique path per upload), so browsers may
// keep them for repeat visits.
const PHOTO_CACHE_CONTROL = "private, max-age=31536000, immutable";

const actorName = (user: UserData) => user.name || user.email || "Super Admin";

function toMillis(value: unknown): number | null {
  const timestamp = value as { toMillis?: () => number } | null | undefined;
  return typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : null;
}

function asPhotos(value: unknown): FacilityPhoto[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((photo) => photo && typeof photo.url === "string")
    .map((photo) => ({ url: photo.url, storagePath: String(photo.storagePath || "") }));
}

function asReport(id: string, data: DocumentData): FacilityReport {
  return {
    id,
    santriId: String(data.santriId || ""),
    santriName: String(data.santriName || ""),
    kamar: data.kamar || null,
    reportedByUid: String(data.reportedByUid || ""),
    place: String(data.place || ""),
    description: String(data.description || ""),
    photos: asPhotos(data.photos),
    resolutionPhotos: asPhotos(data.resolutionPhotos),
    status: isFacilityReportStatus(data.status) ? data.status : "pending",
    reportedDate: String(data.reportedDate || ""),
    // Firestore Timestamps are converted once here so pages only handle numbers.
    reportedAtMillis: toMillis(data.reportedAt),
    reviewNote: data.reviewNote || null,
    reviewedByName: data.reviewedByName || null,
    reviewedAtMillis: toMillis(data.reviewedAt),
    resolvedByName: data.resolvedByName || null,
    resolvedAtMillis: toMillis(data.resolvedAt),
  };
}

/** Every report, newest first. Santri see all reports so duplicates are visible. */
export async function getFacilityReports(): Promise<FacilityReport[]> {
  const snapshot = await getDocs(collection(db, FACILITY_REPORTS_COLLECTION));
  return sortFacilityReports(snapshot.docs.map((document) => asReport(document.id, document.data())));
}

/**
 * Compresses and uploads one photo. Report photos are scoped to the santri,
 * proof-of-fix photos to the super admin, since neither has a report id yet.
 */
export async function uploadFacilityPhoto(
  file: File, kind: "report" | "proof", user: UserData,
): Promise<FacilityPhoto> {
  let prefix: string;
  let ownerId: string;
  if (kind === "report") {
    if (!canSubmitFacilityReport(user)) throw new Error("Hanya santri yang dapat mengunggah foto laporan.");
    prefix = FACILITY_REPORT_PHOTO_PREFIX;
    ownerId = user.santriId!;
  } else {
    if (!canReviewFacilityReports(user)) throw new Error("Hanya Super Admin yang dapat mengunggah bukti perbaikan.");
    prefix = FACILITY_PROOF_PHOTO_PREFIX;
    ownerId = user.uid;
  }

  const compressed = await compressImageToLimit(file, MAX_FACILITY_PHOTO_BYTES);
  const storagePath = facilityPhotoStoragePath(prefix, ownerId);
  const photoRef = ref(storage, storagePath);
  await uploadBytes(photoRef, compressed, {
    contentType: "image/jpeg",
    cacheControl: PHOTO_CACHE_CONTROL,
  });
  return { url: await getDownloadURL(photoRef), storagePath };
}

export async function createFacilityReport(
  input: { place: string; description: string; photos: FacilityPhoto[] },
  user: UserData,
  reportId: string,
): Promise<string> {
  if (!canSubmitFacilityReport(user)) {
    throw new Error("Hanya santri yang dapat melaporkan kondisi fasilitas.");
  }
  const { place, description } = validateFacilityReportInput(input);
  const santriId = user.santriId!;
  const photos = normalizeFacilityPhotos(input.photos, facilityPhotoOwnerPrefix(FACILITY_REPORT_PHOTO_PREFIX, santriId));

  const reportRef = doc(db, FACILITY_REPORTS_COLLECTION, reportId);
  const santriRef = doc(db, "SantriCollection", santriId);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reportRef);
    if (existing.exists()) {
      if (existing.data().santriId !== santriId) throw new Error("Laporan tidak sesuai dengan akun santri.");
      return; // A retry after an uncertain network response keeps the original report.
    }
    const santri = await transaction.get(santriRef);
    if (!santri.exists()) throw new Error("Data santri tidak ditemukan.");
    const now = serverTimestamp();
    transaction.set(reportRef, {
      id: reportId,
      santriId,
      santriName: santri.data().nama || user.name || "Santri",
      kamar: santri.data().kamar || null,
      reportedByUid: user.uid,
      place,
      description,
      photos,
      resolutionPhotos: [],
      status: "pending" satisfies FacilityReportStatus,
      reportedDate: todayJakartaISO(),
      reportedAt: now,
      updatedAt: now,
    });
  });
  return reportId;
}

export async function withdrawFacilityReport(reportId: string, user: UserData): Promise<void> {
  const reportRef = doc(db, FACILITY_REPORTS_COLLECTION, reportId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reportRef);
    if (!snapshot.exists()) throw new Error("Laporan fasilitas tidak ditemukan.");
    const report = asReport(snapshot.id, snapshot.data());
    if (!canWithdrawFacilityReport(user, report)) {
      throw new Error(report.santriId === user.santriId
        ? "Laporan yang sudah diproses tidak dapat ditarik kembali."
        : "Laporan ini bukan milik Anda.");
    }
    transaction.delete(reportRef);
  });
}

/**
 * Closes a pending report as resolved or declined. When resolving, the super
 * admin may attach photos of the fixed facility in the same step.
 */
export async function reviewFacilityReport(
  reportId: string,
  nextStatus: FacilityReportStatus,
  reviewNote: string,
  resolutionPhotos: FacilityPhoto[] | undefined,
  user: UserData,
): Promise<void> {
  if (!canReviewFacilityReports(user)) {
    throw new Error("Anda tidak memiliki kewenangan untuk meninjau laporan fasilitas.");
  }
  const note = validateFacilityReviewNote(nextStatus, reviewNote);
  const reportRef = doc(db, FACILITY_REPORTS_COLLECTION, reportId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reportRef);
    if (!snapshot.exists()) throw new Error("Laporan fasilitas tidak ditemukan.");
    const current = asReport(snapshot.id, snapshot.data());
    if (!canTransitionFacilityReport(current.status, nextStatus)) {
      throw new Error("Laporan ini sudah diproses sebelumnya.");
    }
    const now = serverTimestamp();
    const update: Record<string, unknown> = {
      status: nextStatus,
      reviewNote: note || null,
      reviewedByUid: user.uid,
      reviewedByName: actorName(user),
      reviewedAt: now,
      updatedAt: now,
    };
    if (nextStatus === "resolved") {
      update.resolvedByUid = user.uid;
      update.resolvedByName = actorName(user);
      update.resolvedAt = now;
      if (resolutionPhotos !== undefined) {
        update.resolutionPhotos = normalizeFacilityPhotos(
          resolutionPhotos, facilityPhotoOwnerPrefix(FACILITY_PROOF_PHOTO_PREFIX, user.uid), current.resolutionPhotos,
        );
      }
    }
    transaction.update(reportRef, update);
  });
}

/** Adds, replaces, or removes proof-of-fix photos on a resolved report. */
export async function saveFacilityRepairProof(
  reportId: string, resolutionPhotos: FacilityPhoto[], user: UserData,
): Promise<void> {
  if (!canReviewFacilityReports(user)) {
    throw new Error("Hanya Super Admin yang dapat memperbarui bukti perbaikan.");
  }
  const reportRef = doc(db, FACILITY_REPORTS_COLLECTION, reportId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reportRef);
    if (!snapshot.exists()) throw new Error("Laporan fasilitas tidak ditemukan.");
    const current = asReport(snapshot.id, snapshot.data());
    if (current.status !== "resolved") {
      throw new Error("Bukti perbaikan hanya dapat dikelola pada laporan yang sudah selesai.");
    }
    transaction.update(reportRef, {
      resolutionPhotos: normalizeFacilityPhotos(
        resolutionPhotos, facilityPhotoOwnerPrefix(FACILITY_PROOF_PHOTO_PREFIX, user.uid), current.resolutionPhotos,
      ),
      updatedAt: serverTimestamp(),
    });
  });
}
