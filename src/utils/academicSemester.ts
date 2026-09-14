export type AcademicSemesterName = "Ganjil" | "Genap";

export interface AcademicSemesterPeriod {
  name: AcademicSemesterName;
  key: string;
  academicYear: string;
  index: number;
}

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const getJakartaDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const getPart = (type: "year" | "month") =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: getPart("year"),
    month: getPart("month"),
  };
};

/**
 * Semester Ganjil runs September through February. Semester Genap runs
 * March through August. The calculation intentionally uses Asia/Jakarta so
 * the boundary does not depend on the browser's local timezone.
 */
export function getAcademicSemesterPeriod(
  date: Date = new Date()
): AcademicSemesterPeriod {
  const { year, month } = getJakartaDateParts(date);
  const isGenap = month >= 3 && month <= 8;
  const name: AcademicSemesterName = isGenap ? "Genap" : "Ganjil";
  const academicYearStart = isGenap || month <= 2 ? year - 1 : year;
  const academicYearEnd = academicYearStart + 1;

  return {
    name,
    key: `${academicYearStart}-${academicYearEnd}-${name.toLowerCase()}`,
    academicYear: `${academicYearStart}/${academicYearEnd}`,
    index: academicYearStart * 2 + (isGenap ? 1 : 0),
  };
}

export function getAcademicSemesterIndex(key: unknown): number | null {
  if (typeof key !== "string") return null;

  const match = /^(\d{4})-(\d{4})-(ganjil|genap)$/.exec(key);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) return null;

  return startYear * 2 + (match[3] === "genap" ? 1 : 0);
}
