import {
  collection,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  AcademicSemesterPeriod,
  getAcademicSemesterIndex,
  getAcademicSemesterPeriod,
} from "@/utils/academicSemester";

const MAX_SEMESTER = 12;

type SantriData = Record<string, unknown>;
type SyncOutcome = "baselined" | "updated" | "unchanged" | "skipped" | "error";

export interface SantriSemesterSyncResult {
  currentPeriod: AcademicSemesterPeriod;
  updatedCount: number;
  baselinedCount: number;
  skippedCount: number;
  errorCount: number;
}

function isHigherEducation(data: SantriData) {
  const educationLevel = String(data.jenjangPendidikan ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  return educationLevel === "perguruan tinggi" || educationLevel === "pt";
}

export function isHigherEducationSantri(data: {
  jenjangPendidikan?: unknown;
}) {
  return isHigherEducation(data as SantriData);
}

export function getCurrentAcademicSemesterKey() {
  return getAcademicSemesterPeriod().key;
}

function getSemesterNumber(data: SantriData) {
  for (const rawValue of [data.semester, data.kelas]) {
    const value = String(rawValue ?? "").trim();
    if (!/^\d+$/.test(value)) continue;

    const semester = Number(value);
    if (
      Number.isSafeInteger(semester) &&
      semester >= 1 &&
      semester <= MAX_SEMESTER
    ) {
      return semester;
    }
  }

  return null;
}

/**
 * Reconciles the numeric semester for active university Santri records.
 *
 * Existing values are marked on their first reconciliation so the rollout
 * does not unexpectedly increment every record. Later reconciliations use the
 * stored period marker to catch up one step per missed academic period.
 */
export async function syncSantriSemesters(
  kodeAsrama: string
): Promise<SantriSemesterSyncResult> {
  const currentPeriod = getAcademicSemesterPeriod();
  const santriQuery = query(
    collection(db, "SantriCollection"),
    where("kodeAsrama", "==", kodeAsrama),
    where("statusAktif", "==", "Aktif")
  );
  const snapshot = await getDocs(santriQuery);

  const outcomes = await Promise.all(
    snapshot.docs.map(async (studentDoc): Promise<SyncOutcome> => {
      const queriedData = studentDoc.data() as SantriData;
      const queriedSemester = getSemesterNumber(queriedData);
      const queriedPeriodIndex = getAcademicSemesterIndex(
        queriedData.semesterAutoUpdatedPeriod
      );

      // Avoid opening a transaction for records that are already current.
      // The transaction below still re-reads records that need work so a
      // second browser tab cannot apply the same increment twice.
      if (
        queriedData.kodeAsrama !== kodeAsrama ||
        queriedData.statusAktif !== "Aktif" ||
        !isHigherEducationSantri(queriedData) ||
        queriedSemester === null ||
        (queriedPeriodIndex !== null &&
          queriedPeriodIndex >= currentPeriod.index)
      ) {
        return "skipped";
      }

      try {
        return await runTransaction(db, async (transaction) => {
          const freshSnapshot = await transaction.get(studentDoc.ref);
          if (!freshSnapshot.exists()) return "skipped";

          const data = freshSnapshot.data() as SantriData;
          if (
            data.kodeAsrama !== kodeAsrama ||
            data.statusAktif !== "Aktif" ||
            !isHigherEducationSantri(data)
          ) {
            return "skipped";
          }

          const currentSemester = getSemesterNumber(data);
          if (currentSemester === null) return "skipped";

          const previousPeriodIndex = getAcademicSemesterIndex(
            data.semesterAutoUpdatedPeriod
          );

          if (previousPeriodIndex === null) {
            transaction.update(studentDoc.ref, {
              semester: String(currentSemester),
              kelas: String(currentSemester),
              semesterAutoUpdatedPeriod: currentPeriod.key,
            });
            return "baselined";
          }

          const periodsElapsed = Math.max(
            0,
            currentPeriod.index - previousPeriodIndex
          );
          if (periodsElapsed === 0) return "unchanged";

          const nextSemester = Math.min(
            MAX_SEMESTER,
            currentSemester + periodsElapsed
          );

          transaction.update(studentDoc.ref, {
            semester: String(nextSemester),
            kelas: String(nextSemester),
            semesterAutoUpdatedPeriod: currentPeriod.key,
          });

          return nextSemester > currentSemester ? "updated" : "unchanged";
        });
      } catch (error) {
        console.error(
          `Error synchronizing semester for Santri ${studentDoc.id}:`,
          error
        );
        return "error";
      }
    })
  );

  return {
    currentPeriod,
    updatedCount: outcomes.filter((outcome) => outcome === "updated").length,
    baselinedCount: outcomes.filter((outcome) => outcome === "baselined")
      .length,
    skippedCount: outcomes.filter(
      (outcome) => outcome === "skipped" || outcome === "unchanged"
    ).length,
    errorCount: outcomes.filter((outcome) => outcome === "error").length,
  };
}
