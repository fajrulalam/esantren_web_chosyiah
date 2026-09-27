import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, pickSantriForEmail } from "../functions/src/santriEmailMatch.ts";

test("emails compare trimmed and case-insensitively", () => {
  assert.equal(normalizeEmail("  Siti.Aisyah@Gmail.COM "), "siti.aisyah@gmail.com");
  assert.equal(normalizeEmail(undefined), "");
  assert.equal(normalizeEmail(42), "");
});

test("the one santri with the email is linked, whatever its stored casing", () => {
  const candidates = [
    { id: "a", email: "other@gmail.com" },
    { id: "b", email: " Siti.Aisyah@Gmail.com" },
    { id: "c" },
  ];
  assert.deepEqual(pickSantriForEmail("siti.aisyah@gmail.com", candidates), { santriId: "b" });
});

test("an unknown or empty email is not linked", () => {
  assert.deepEqual(pickSantriForEmail("x@gmail.com", [{ id: "a", email: "y@gmail.com" }]), { error: "not-found" });
  assert.deepEqual(pickSantriForEmail("", [{ id: "a", email: "" }]), { error: "not-found" });
});

test("a shared email links to the single active record, else is ambiguous", () => {
  const duplicates = [
    { id: "old", email: "siti@gmail.com", statusAktif: "Boyong" },
    { id: "new", email: "SITI@gmail.com", statusAktif: "Aktif" },
  ];
  assert.deepEqual(pickSantriForEmail("siti@gmail.com", duplicates), { santriId: "new" });
  assert.deepEqual(
    pickSantriForEmail("siti@gmail.com", duplicates.map((santri) => ({ ...santri, statusAktif: "Aktif" }))),
    { error: "ambiguous" },
  );
  assert.deepEqual(
    pickSantriForEmail("siti@gmail.com", duplicates.map((santri) => ({ ...santri, statusAktif: "Lulus" }))),
    { error: "ambiguous" },
  );
});
