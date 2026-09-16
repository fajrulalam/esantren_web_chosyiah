import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAvailableInstallmentAmount,
  deriveInstallmentStatus,
  validateInstallmentAmount,
} from "../src/utils/paymentInstallmentMath.ts";

const registrationTotal = 3_960_000;

test("registration amount boundaries", () => {
  assert.equal(validateInstallmentAmount(0, registrationTotal), false);
  assert.equal(validateInstallmentAmount(2_250_000, registrationTotal), true);
  assert.equal(validateInstallmentAmount(3_960_000, registrationTotal), true);
  assert.equal(validateInstallmentAmount(3_960_001, registrationTotal), false);
  assert.equal(validateInstallmentAmount(1.5, registrationTotal), false);
});

test("Rp2.250.000 registration payment leaves Rp1.710.000", () => {
  assert.equal(
    calculateAvailableInstallmentAmount(2_250_000, registrationTotal, 0),
    1_710_000
  );
});

test("multiple pending receipts reserve balance without overpayment", () => {
  const paid = 1_000_000;
  const pending = 750_000 + 500_000;
  const available = calculateAvailableInstallmentAmount(
    paid,
    registrationTotal,
    pending
  );
  assert.equal(available, 1_710_000);
  assert.equal(validateInstallmentAmount(1_710_000, available), true);
  assert.equal(validateInstallmentAmount(1_710_001, available), false);
});

test("aggregate status prioritizes pending and only becomes paid at full verification", () => {
  assert.equal(
    deriveInstallmentStatus(3_000_000, registrationTotal, 960_000),
    "Menunggu Verifikasi"
  );
  assert.equal(
    deriveInstallmentStatus(3_000_000, registrationTotal, 0),
    "Belum Lunas"
  );
  assert.equal(
    deriveInstallmentStatus(registrationTotal, registrationTotal, 0),
    "Lunas"
  );
  assert.equal(
    deriveInstallmentStatus(registrationTotal + 1, registrationTotal, 0),
    "Belum Lunas"
  );
});
