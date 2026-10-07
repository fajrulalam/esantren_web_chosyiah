import test from "node:test";
import assert from "node:assert/strict";
import { deriveSantriTanggungan } from "../functions/src/santriTanggunganMath.ts";

const payment = (overrides = {}) => ({
  paid: 750_000,
  total: 750_000,
  status: "Lunas",
  ...overrides,
});

test("a santri with no payment records has no bill", () => {
  assert.deepEqual(deriveSantriTanggungan([]), {
    jumlahTunggakan: 0,
    statusTanggungan: "Belum Ada Tagihan",
  });
});

test("all records fully paid is Lunas with zero arrears", () => {
  // Production case: three paid invoices but a stale counter of 3 used to
  // leave the santri flagged "Belum Lunas".
  assert.deepEqual(
    deriveSantriTanggungan([payment(), payment(), payment()]),
    { jumlahTunggakan: 0, statusTanggungan: "Lunas" }
  );
});

test("a fresh unpaid invoice makes the santri Belum Lunas", () => {
  const result = deriveSantriTanggungan([
    payment(),
    payment({ paid: 0, status: "Belum Lunas" }),
  ]);
  assert.deepEqual(result, {
    jumlahTunggakan: 1,
    statusTanggungan: "Belum Lunas",
  });
});

test("every unpaid record counts once, however many invoices", () => {
  const result = deriveSantriTanggungan([
    payment({ paid: 0, status: "Belum Lunas" }),
    payment({ paid: 0, status: "Belum Lunas" }),
    payment({ paid: 0, status: "Belum Lunas" }),
  ]);
  assert.equal(result.jumlahTunggakan, 3);
});

test("a partial installment is still owed", () => {
  const result = deriveSantriTanggungan([
    payment({ paid: 2_250_000, total: 3_960_000, status: "Belum Lunas" }),
  ]);
  assert.deepEqual(result, {
    jumlahTunggakan: 1,
    statusTanggungan: "Belum Lunas",
  });
});

test("a receipt awaiting verification wins over Belum Lunas", () => {
  const result = deriveSantriTanggungan([
    payment({ paid: 0, status: "Belum Lunas" }),
    payment({ paid: 0, status: "Menunggu Verifikasi", pendingAmount: 750_000 }),
  ]);
  assert.deepEqual(result, {
    jumlahTunggakan: 2,
    statusTanggungan: "Menunggu Verifikasi",
  });
});

test("pendingAmount alone marks a record as awaiting verification", () => {
  const result = deriveSantriTanggungan([
    payment({ paid: 0, status: "Belum Lunas", pendingAmount: 100 }),
  ]);
  assert.equal(result.statusTanggungan, "Menunggu Verifikasi");
});

test("a legacy amount that still needs confirmation is pending", () => {
  const result = deriveSantriTanggungan([
    payment({ paid: 0, status: "Belum Lunas", requiresAmountConfirmation: true }),
  ]);
  assert.equal(result.statusTanggungan, "Menunggu Verifikasi");
});

test("records without paid/total fields are not counted as owed", () => {
  const result = deriveSantriTanggungan([{ status: "Lunas" }]);
  assert.deepEqual(result, { jumlahTunggakan: 0, statusTanggungan: "Lunas" });
});
