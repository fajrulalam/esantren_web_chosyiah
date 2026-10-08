// Smoke test of the invoice / tanggungan Cloud Functions against the local
// emulators only; never touches a real project. Put the Node.js version the
// functions will run on first on PATH, since the functions emulator uses it:
//   (cd functions && npm run build)
//   PATH=/opt/homebrew/opt/node@22/bin:$PATH firebase emulators:exec \
//     --only functions,firestore,auth --project demo-esantren-functions \
//     'node --test tests/functions-runtime.emulator.cjs'
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const path = require('node:path');

const root = path.join(__dirname, '..');
const admin = require(path.join(root, 'functions/node_modules/firebase-admin'));

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-esantren-functions';
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9291';
const KODE = 'TEST_ASRAMA';
const INVOICE = 'smoke_invoice';
const NOMINAL = 750_000;

const app = admin.initializeApp({ projectId: PROJECT }, 'functions-runtime-test');
const db = app.firestore();
let staffToken;

const santri = (nama) => ({
  nama,
  kodeAsrama: KODE,
  statusAktif: 'Aktif',
  kamar: '101 A',
  semester: '1',
  jenjangPendidikan: 'Perguruan Tinggi',
  statusTanggungan: 'Belum Ada Tagihan',
  jumlahTunggakan: 0,
});

async function waitFor(check, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

const tanggungan = async (id) => {
  const data = (await db.collection('SantriCollection').doc(id).get()).data();
  return { statusTanggungan: data.statusTanggungan, jumlahTunggakan: data.jumlahTunggakan };
};

const paymentRecord = (santriId) =>
  db.collection('PaymentStatuses').doc(`${INVOICE}_${santriId}`).get();

async function post(name, data, token) {
  const response = await fetch(`http://${FUNCTIONS_HOST}/${PROJECT}/us-central1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  // A signed-in staff account, as the updated client sends.
  const signUp = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@example.com', password: 'secret123', returnSecureToken: true }),
    }
  ).then((response) => response.json());
  staffToken = signUp.idToken;
  await db.collection('PengurusCollection').doc(signUp.localId).set({ role: 'superAdmin' });

  await Promise.all(
    ['santriA', 'santriB', 'santriC'].map((id) =>
      db.collection('SantriCollection').doc(id).set(santri(id))
    )
  );
});

after(async () => {
  await app.delete();
});

test('invoice creation trigger writes payment records and tanggungan', async () => {
  await db.collection('Invoices').doc(INVOICE).set({
    paymentName: 'Smoke test',
    nominal: NOMINAL,
    kodeAsrama: KODE,
    selectedSantriIds: ['santriA', 'santriB'],
    numberOfSantriInvoiced: 2,
    numberOfPaid: 0,
    numberOfWaitingVerification: 0,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  for (const id of ['santriA', 'santriB']) {
    await waitFor(
      async () => (await tanggungan(id)).statusTanggungan === 'Belum Lunas',
      `${id} flagged Belum Lunas`
    );
    assert.deepEqual(await tanggungan(id), { statusTanggungan: 'Belum Lunas', jumlahTunggakan: 1 });
    const record = (await paymentRecord(id)).data();
    assert.equal(record.paid, 0);
    assert.equal(record.total, NOMINAL);
  }
});

test('adding a santri already on the invoice keeps their payment', async () => {
  await db.collection('PaymentStatuses').doc(`${INVOICE}_santriA`).update({ paid: 300_000 });

  const first = await post(
    'addSantrisToInvoiceHttp',
    { invoiceId: INVOICE, santriIds: ['santriA', 'santriC'] },
    staffToken
  );
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.success, true);
  assert.equal(first.body.addedCount, 1);
  assert.equal((await paymentRecord('santriA')).data().paid, 300_000);
  assert.equal((await paymentRecord('santriC')).exists, true);
  assert.deepEqual(await tanggungan('santriC'), { statusTanggungan: 'Belum Lunas', jumlahTunggakan: 1 });

  const again = await post('addSantrisToInvoiceHttp', { invoiceId: INVOICE, santriIds: ['santriA'] }, staffToken);
  assert.equal(again.body.success, true);
  assert.equal(again.body.addedCount, 0);
});

test('removing a santri recomputes from their remaining records', async () => {
  const result = await post(
    'removeSantrisFromInvoiceHttp',
    { invoiceId: INVOICE, santriIds: ['santriC'] },
    staffToken
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.removedCount, 1);
  assert.equal((await paymentRecord('santriC')).exists, false);
  assert.deepEqual(await tanggungan('santriC'), { statusTanggungan: 'Belum Ada Tagihan', jumlahTunggakan: 0 });
});

test('the delete callable requires staff auth and clears a stale counter', async () => {
  const anonymous = await post('deleteInvoiceFunction', { invoiceId: INVOICE });
  assert.equal(anonymous.body.error?.status, 'UNAUTHENTICATED');

  // santriB paid in full but carries the inflated counter the old flow left behind.
  await db.collection('PaymentStatuses').doc(`${INVOICE}_santriB`).update({ paid: NOMINAL, status: 'Lunas' });
  await db.collection('SantriCollection').doc('santriB').update({ jumlahTunggakan: 3 });

  const result = await post('deleteInvoiceFunction', { invoiceId: INVOICE }, staffToken);
  assert.equal(result.body.result?.success, true, JSON.stringify(result.body));

  const remaining = await db.collection('PaymentStatuses').where('invoiceId', '==', INVOICE).get();
  assert.equal(remaining.size, 0);
  for (const id of ['santriA', 'santriB']) {
    assert.deepEqual(await tanggungan(id), { statusTanggungan: 'Belum Ada Tagihan', jumlahTunggakan: 0 });
  }
});
