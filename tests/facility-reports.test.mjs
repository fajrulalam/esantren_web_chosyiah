import test from "node:test";
import assert from "node:assert/strict";
import {
  FACILITY_PROOF_PHOTO_PREFIX,
  FACILITY_REPORT_PHOTO_PREFIX,
  FACILITY_REPORT_STATUSES,
  MAX_FACILITY_PHOTOS,
  canReviewFacilityReports,
  canSubmitFacilityReport,
  canTransitionFacilityReport,
  canWithdrawFacilityReport,
  countFacilityReportsByStatus,
  createFacilityReportId,
  facilityPhotoOwnerPrefix,
  facilityPhotoStoragePath,
  formatFacilityReportDate,
  normalizeFacilityPhotos,
  sortFacilityReports,
  todayJakartaISO,
  validateFacilityReportInput,
  validateFacilityReviewNote,
} from "../src/utils/facilityReports.ts";

const santri = { uid: "wali_S1", role: "waliSantri", santriId: "S1" };
const bendahara = { uid: "wali_S2", role: "bendahara", santriId: "S2" };
const superAdmin = { uid: "admin-uid", role: "superAdmin" };
const storageUrl = (path) =>
  `https://firebasestorage.googleapis.com/v0/b/e-santren.appspot.com/o/${encodeURIComponent(path)}?alt=media`;

test("reports expose only pending and terminal statuses", () => {
  assert.deepEqual(FACILITY_REPORT_STATUSES, ["pending", "resolved", "declined"]);
});

test("every santri can report, staff cannot", () => {
  assert.equal(canSubmitFacilityReport(santri), true);
  assert.equal(canSubmitFacilityReport(bendahara), true);
  assert.equal(canSubmitFacilityReport({ role: "waliSantri" }), false, "needs a linked santri");
  for (const role of ["superAdmin", "pengurus", "pengasuh"]) {
    assert.equal(canSubmitFacilityReport({ uid: "x", role }), false, role);
  }
  assert.equal(canSubmitFacilityReport(null), false);
});

test("only the super admin reviews reports", () => {
  assert.equal(canReviewFacilityReports(superAdmin), true);
  for (const user of [santri, bendahara, { role: "pengurus" }, { role: "pengasuh" }, null]) {
    assert.equal(canReviewFacilityReports(user), false);
  }
});

test("a pending report closes once, as resolved or declined", () => {
  assert.equal(canTransitionFacilityReport("pending", "resolved"), true);
  assert.equal(canTransitionFacilityReport("pending", "declined"), true);
  assert.equal(canTransitionFacilityReport("pending", "pending"), false);
  assert.equal(canTransitionFacilityReport("resolved", "declined"), false);
  assert.equal(canTransitionFacilityReport("declined", "resolved"), false);
});

test("reporters withdraw only their own pending report; super admin any", () => {
  assert.equal(canWithdrawFacilityReport(santri, { santriId: "S1", status: "pending" }), true);
  assert.equal(canWithdrawFacilityReport(santri, { santriId: "S1", status: "resolved" }), false);
  assert.equal(canWithdrawFacilityReport(santri, { santriId: "S2", status: "pending" }), false);
  assert.equal(canWithdrawFacilityReport(superAdmin, { santriId: "S1", status: "declined" }), true);
});

test("report input is trimmed and length-checked", () => {
  assert.deepEqual(
    validateFacilityReportInput({ place: "  Kamar Mandi ", description: " Keran bocor " }),
    { place: "Kamar Mandi", description: "Keran bocor" },
  );
  assert.throws(() => validateFacilityReportInput({ place: "   ", description: "x" }), /Lokasi fasilitas wajib/);
  assert.throws(() => validateFacilityReportInput({ place: "Musholla", description: "" }), /Deskripsi/);
  assert.throws(
    () => validateFacilityReportInput({ place: "x".repeat(161), description: "ok" }),
    /maksimal 160/,
  );
});

test("declining needs a reason; resolving does not", () => {
  assert.equal(validateFacilityReviewNote("resolved", ""), "");
  assert.equal(validateFacilityReviewNote("resolved", "  Sudah diganti  "), "Sudah diganti");
  assert.throws(() => validateFacilityReviewNote("declined", "dobel"), /minimal 8/);
  assert.equal(validateFacilityReviewNote("declined", "Sudah dilaporkan"), "Sudah dilaporkan");
  assert.throws(() => validateFacilityReviewNote("resolved", "x".repeat(501)), /maksimal 500/);
});

test("photos must be the uploader's own Storage objects", () => {
  const ownPrefix = facilityPhotoOwnerPrefix(FACILITY_REPORT_PHOTO_PREFIX, "S1");
  const ownPath = `${ownPrefix}1_abc.jpg`;
  const own = { url: storageUrl(ownPath), storagePath: ownPath };
  assert.deepEqual(normalizeFacilityPhotos([own], ownPrefix), [own]);
  assert.deepEqual(normalizeFacilityPhotos(undefined, ownPrefix), []);

  const otherPath = `${facilityPhotoOwnerPrefix(FACILITY_REPORT_PHOTO_PREFIX, "S2")}1_abc.jpg`;
  assert.throws(
    () => normalizeFacilityPhotos([{ url: storageUrl(otherPath), storagePath: otherPath }], ownPrefix),
    /bukan unggahan Anda/,
  );
  assert.throws(
    () => normalizeFacilityPhotos([{ url: "https://example.com/a.jpg", storagePath: ownPath }], ownPrefix),
    /tidak valid/,
  );
  assert.throws(
    () => normalizeFacilityPhotos(Array(MAX_FACILITY_PHOTOS + 1).fill(own), ownPrefix),
    /Maksimal 5 foto/,
  );
  // The URL must point at the declared object, not just carry an allowed storagePath.
  assert.throws(
    () => normalizeFacilityPhotos([{ url: storageUrl(otherPath), storagePath: ownPath }], ownPrefix),
    /tidak valid/,
  );
  const emulatorUrl = `http://127.0.0.1:9199/v0/b/demo/o/${encodeURIComponent(ownPath)}?alt=media&token=t`;
  assert.deepEqual(normalizeFacilityPhotos([{ url: emulatorUrl, storagePath: ownPath }], ownPrefix), [
    { url: emulatorUrl, storagePath: ownPath },
  ]);
});

test("existing proof photos survive an edit by another super admin", () => {
  const previousPath = `${facilityPhotoOwnerPrefix(FACILITY_PROOF_PHOTO_PREFIX, "other-admin")}1_a.jpg`;
  const previous = { url: storageUrl(previousPath), storagePath: previousPath };
  const myPrefix = facilityPhotoOwnerPrefix(FACILITY_PROOF_PHOTO_PREFIX, "admin-uid");
  assert.deepEqual(normalizeFacilityPhotos([previous], myPrefix, [previous]), [previous]);
});

test("storage paths are unique per upload and scoped to the owner", () => {
  const path = facilityPhotoStoragePath(FACILITY_REPORT_PHOTO_PREFIX, "S1", 1700000000000, "1234abcd-ffff");
  assert.equal(path, "public-uploads/facility-reports/S1/1700000000000_1234abcd.jpg");
  assert.equal(
    facilityPhotoOwnerPrefix(FACILITY_PROOF_PHOTO_PREFIX, "a/b"),
    "public-uploads/facility-report-proofs/a_b/",
  );
});

test("report ids and dates use the Jakarta calendar day", () => {
  // 20:00 UTC on 26 Sep is already 27 Sep in Jakarta (UTC+7).
  const lateEvening = new Date("2026-09-26T20:00:00Z");
  assert.equal(todayJakartaISO(lateEvening), "2026-09-27");
  assert.equal(
    createFacilityReportId(lateEvening, "3f9a1c0b-7d2e-4a00-8000-000000000000"),
    "FAC-20260927-3F9A1C0B7D2E",
  );
  assert.equal(formatFacilityReportDate("2026-09-07"), "7 Sep 2026");
  assert.equal(formatFacilityReportDate(""), "—");
});

test("reports sort newest first and count by status", () => {
  const reports = [
    { id: "a", status: "pending", reportedAtMillis: 1, reportedDate: "2026-09-01" },
    { id: "b", status: "resolved", reportedAtMillis: 3, reportedDate: "2026-09-03" },
    { id: "c", status: "pending", reportedAtMillis: null, reportedDate: "2026-09-02" },
  ];
  assert.deepEqual(sortFacilityReports(reports).map((report) => report.id), ["b", "a", "c"]);
  assert.deepEqual(countFacilityReportsByStatus(reports), { all: 3, pending: 2, resolved: 1, declined: 0 });
});
