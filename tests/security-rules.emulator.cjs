// Security rules tests against the local emulators only; never touches a real project.
// Transition rules (firebase-rules/*.rules):
//   firebase emulators:exec --only firestore,storage,auth --project demo-esantren-rules \
//     'node --test tests/security-rules.emulator.cjs'
// Cutover rules (firebase-rules/cutover/*.rules):
//   RULES_SET=cutover firebase emulators:exec --only firestore,storage,auth --project demo-esantren-rules \
//     --config firebase.cutover.json 'node --test tests/security-rules.emulator.cjs'
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const path = require('node:path');

const PROJECT = 'demo-esantren-rules';
const CUTOVER = process.env.RULES_SET === 'cutover';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  const host = process.env[key];
  if (!host || !/^(127\.0\.0\.1|localhost|\[?::1\]?):/.test(host)) throw new Error(`${key} must point at a local emulator.`);
}

const root = path.resolve(__dirname, '..');
const { initializeApp, deleteApp } = require(path.join(root, 'node_modules/firebase/app'));
const fs = require(path.join(root, 'node_modules/firebase/firestore'));
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require(path.join(root, 'node_modules/firebase/auth'));
const st = require(path.join(root, 'node_modules/firebase/storage'));
const admin = require(path.join(root, 'functions/node_modules/firebase-admin'));

admin.initializeApp({ projectId: PROJECT });
const adminDb = admin.firestore();
const apps = [];
const [fsHost, fsPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const [stHost, stPort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');

// One client per actor, optionally signed in as an Auth emulator user.
async function client(name, account) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key', storageBucket: `${PROJECT}.appspot.com` }, name);
  apps.push(app);
  const db = fs.getFirestore(app);
  fs.connectFirestoreEmulator(db, fsHost, Number(fsPort));
  const storage = st.getStorage(app);
  st.connectStorageEmulator(storage, stHost, Number(stPort));
  if (account) {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    await admin.auth().createUser({ uid: account.uid, email: account.email, password: 'password123', emailVerified: true })
      .catch((error) => { if (error.code !== 'auth/uid-already-exists') throw error; });
    if (account.claims) await admin.auth().setCustomUserClaims(account.uid, account.claims);
    await signInWithEmailAndPassword(auth, account.email, 'password123');
  }
  return { db, storage };
}

const allowed = (promise) => assert.doesNotReject(promise);
const denied = (promise) => assert.rejects(promise, (error) => /permission|unauthorized|403/i.test(`${error.code} ${error.message}`));
const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, Timestamp, deleteField, serverTimestamp } = fs;

let anon, pengurus, superAdmin, newStaff, linkedSantri, strangerSantri;

before(async () => {
  const seed = {
    'SantriCollection/S1': { nama: 'Siti Aisyah', nomorTelpon: '+628111', statusKehadiran: 'Ada', kamar: '203 B' },
    'SantriCollection/S2': { nama: 'Nur Bendahara', statusKehadiran: 'Ada', isBendahara: true },
    'PengurusCollection/uid-pengurus': { role: 'pengurus', email: 'pengurus@test.id', uid: 'uid-pengurus' },
    'PengurusCollection/uid-super': { role: 'superAdmin', email: 'super@test.id', uid: 'uid-super' },
    'PengurusCollection/uid-bendahara-link': { role: 'bendahara', email: 'nur@test.id', santriId: 'S2', createdBy: 'gone-admin' },
    'PengurusCollection/invite-1': { role: 'pengurus', email: 'baru@test.id', name: 'Staf Baru', createdBy: 'gone-admin' },
    'SakitDanPulangCollection/IZ-DONE': { santriId: 'S1', izinType: 'Sakit', status: 'Sudah Sembuh' },
    'FacilityReports/FAC-RESOLVED': { id: 'FAC-RESOLVED', santriId: 'S1', status: 'resolved', place: 'Musholla', description: 'x', photos: [], resolutionPhotos: [] },
    'Invoices/INV1': { nama: 'Syahriah' },
    'PaymentStatuses/PS1': { santriId: 'S1', invoiceId: 'INV1' },
    'vouchers/V1': { santriId: 'S1', userId: 'S1' },
    'voucherGroup/G1': { name: 'Group' },
    'AttendanceTypes/T1': { name: 'Subuh' },
    'KegiatanCollection/2026-09-27': { date: '2026-09-27' },
    'Counters/santri': { count: 1 },
    'AktivitasCollection/DU11/PembayaranLogs/LOG1': { paymentName: 'Legacy', invoiceId: 'INV1' },
    'AktivitasCollection/DU11/PembayaranLogs/LOG1/PaymentStatusEachSantri/S1': { santriId: 'S1' },
  };
  for (const [docPath, data] of Object.entries(seed)) await adminDb.doc(docPath).set(data);

  anon = await client('anon');
  pengurus = await client('pengurus', { uid: 'uid-pengurus', email: 'pengurus@test.id' });
  superAdmin = await client('super', { uid: 'uid-super', email: 'super@test.id' });
  newStaff = await client('new-staff', { uid: 'uid-new-staff', email: 'baru@test.id' });
  linkedSantri = await client('santri', { uid: 'uid-santri-s1', email: 'siti@test.id', claims: { santriId: 'S1' } });
  strangerSantri = await client('stranger', { uid: 'uid-stranger', email: 'stranger@test.id', claims: { santriId: 'S9' } });
});

after(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
  await Promise.all(admin.apps.map((app) => app.delete()));
});

// Payloads below mirror what the client code sends.
const izinPulang = (santriId) => ({
  santriId, timestamp: Timestamp.now(), workflowVersion: 2,
  reportedBy: { uid: 'wali_' + santriId, name: 'Siti', role: 'waliSantri', timestamp: Timestamp.now() },
  alasan: 'Acara Keluarga', tglPulang: Timestamp.now(), rencanaTanggalKembali: Timestamp.now(),
  sudahKembali: false, kembaliSesuaiRencana: null, izinType: 'Pulang', status: 'Proses Pulang', jumlahTunggakan: 0,
});
const facilityReport = (id, santriId) => ({
  id, santriId, santriName: 'Siti', kamar: '203 B', reportedByUid: 'wali_' + santriId, place: 'Kamar Mandi',
  description: 'Keran bocor', photos: [], resolutionPhotos: [], status: 'pending', reportedDate: '2026-09-27',
  reportedAt: serverTimestamp(), updatedAt: serverTimestamp(),
});
const cashflowTxn = () => ({
  date: '2026-09-27', month: '2026-09', type: 'expense', description: 'Beli sabun', amount: 25000,
  account: 'cash', createdAt: Timestamp.now(), createdBy: { uid: 'wali_S2', name: 'Nur', role: 'bendahara' },
});
const staffInviteClaim = (extra = {}) => ({
  role: 'pengurus', email: 'baru@test.id', name: 'Staf Baru', createdBy: 'gone-admin', uid: 'uid-new-staff', lastLogin: new Date(), ...extra,
});

// ---------------------------------------------------------------------------
// Santri data and flows
// ---------------------------------------------------------------------------

test('santri records: santri flows vs. staff edits', async () => {
  const s1 = (ctx) => doc(ctx.db, 'SantriCollection', 'S1');
  if (CUTOVER) {
    await denied(getDoc(s1(anon)));
    await denied(getDocs(query(collection(anon.db, 'SantriCollection'), where('nama', '==', 'Siti Aisyah'))));
    await allowed(getDoc(s1(linkedSantri)));
    await denied(getDoc(s1(strangerSantri)));
    await allowed(updateDoc(s1(linkedSantri), { statusKehadiran: 'Pulang', statusKepulangan: { izinId: 'IZ1' } }));
    await denied(updateDoc(s1(strangerSantri), { statusKehadiran: 'Pulang' }));
    await denied(updateDoc(s1(anon), { statusKehadiran: 'Sakit' }));
  } else {
    // The phone login reads santri before any session exists.
    await allowed(getDoc(s1(anon)));
    await allowed(getDocs(query(collection(anon.db, 'SantriCollection'), where('nama', '==', 'Siti Aisyah'))));
    await allowed(updateDoc(s1(anon), { statusKehadiran: 'Pulang', statusKepulangan: { izinId: 'IZ1' } }));
    await allowed(updateDoc(s1(anon), { statusKepulangan: deleteField(), statusKehadiran: 'Ada' }));
    await denied(updateDoc(s1(anon), { statusKehadiran: 'Alpa' }));
  }
  // Nobody but staff edits identity, contact, role, or semester fields.
  for (const actor of [anon, linkedSantri]) {
    await denied(updateDoc(s1(actor), { nama: 'Diganti' }));
    await denied(updateDoc(s1(actor), { role: 'bendahara', isBendahara: true }));
    await denied(updateDoc(s1(actor), { semester: '3', kelas: '3', semesterAutoUpdatedPeriod: 'x' }));
    await denied(setDoc(doc(actor.db, 'SantriCollection', 'NEW'), { nama: 'Palsu' }));
    await denied(deleteDoc(s1(actor)));
  }
  await allowed(updateDoc(s1(pengurus), { nama: 'Siti Aisyah', semester: '3' }));
  await allowed(setDoc(doc(pengurus.db, 'SantriCollection', 'S-NEW'), { nama: 'Baru' }));
  await allowed(deleteDoc(doc(pengurus.db, 'SantriCollection', 'S-NEW')));
});

test('izin: santri report and complete their own; staff manage all', async () => {
  const owner = CUTOVER ? linkedSantri : anon;
  const ref = (ctx, id) => doc(ctx.db, 'SakitDanPulangCollection', id);
  await allowed(setDoc(ref(owner, 'IZ-NEW'), izinPulang('S1')));
  await denied(setDoc(ref(owner, 'IZ-FORGED'), { ...izinPulang('S1'), status: 'Disetujui' }));
  await allowed(getDoc(ref(owner, 'IZ-NEW')));
  await allowed(updateDoc(ref(owner, 'IZ-NEW'), {
    status: 'Sudah Kembali', sudahKembali: true, tanggalKembali: Timestamp.now(), kembaliSesuaiRencana: true,
    returnReportedBy: { uid: 'x', role: 'waliSantri', timestamp: Timestamp.now() },
  }));
  await denied(updateDoc(ref(owner, 'IZ-NEW'), { santriId: 'S2' }));
  await denied(deleteDoc(ref(owner, 'IZ-NEW')));
  if (CUTOVER) {
    await denied(setDoc(ref(strangerSantri, 'IZ-OTHER'), izinPulang('S1')));
    await denied(getDoc(ref(strangerSantri, 'IZ-NEW')));
    await denied(setDoc(ref(anon, 'IZ-ANON'), izinPulang('S1')));
  }
  await allowed(updateDoc(ref(pengurus, 'IZ-NEW'), { catatan: 'staff note' }));
  await allowed(deleteDoc(ref(pengurus, 'IZ-NEW')));
});

test('facility reports: santri submit and withdraw pending; super admin reviews', async () => {
  const owner = CUTOVER ? linkedSantri : anon;
  const ref = (ctx, id) => doc(ctx.db, 'FacilityReports', id);
  await allowed(setDoc(ref(owner, 'FAC-1'), facilityReport('FAC-1', 'S1')));
  await denied(setDoc(ref(owner, 'FAC-2'), { ...facilityReport('FAC-2', 'S1'), status: 'resolved' }));
  await denied(setDoc(ref(owner, 'FAC-3'), { ...facilityReport('FAC-3', 'S1'), description: 'x'.repeat(2001) }));
  await allowed(getDocs(collection(owner.db, 'FacilityReports')));
  await denied(updateDoc(ref(owner, 'FAC-1'), { status: 'resolved' }));
  await denied(updateDoc(ref(pengurus, 'FAC-1'), { status: 'resolved' }));
  await denied(deleteDoc(ref(owner, 'FAC-RESOLVED')));
  if (CUTOVER) {
    await denied(deleteDoc(ref(strangerSantri, 'FAC-1')));
    await denied(setDoc(ref(strangerSantri, 'FAC-9'), facilityReport('FAC-9', 'S1')));
    await denied(setDoc(ref(anon, 'FAC-A'), facilityReport('FAC-A', 'S1')));
    await denied(getDocs(collection(anon.db, 'FacilityReports')));
  }
  await allowed(deleteDoc(ref(owner, 'FAC-1')));
  await allowed(setDoc(ref(owner, 'FAC-4'), facilityReport('FAC-4', 'S1')));
  await allowed(updateDoc(ref(superAdmin, 'FAC-4'), { status: 'resolved', reviewNote: 'Sudah' }));
  await allowed(deleteDoc(ref(superAdmin, 'FAC-RESOLVED')));
});

// ---------------------------------------------------------------------------
// Staff accounts
// ---------------------------------------------------------------------------

test('staff accounts: only staff read, only super admin manage', async () => {
  const pengurusCol = (ctx) => collection(ctx.db, 'PengurusCollection');
  await denied(getDocs(pengurusCol(anon)));
  await denied(getDoc(doc(anon.db, 'PengurusCollection', 'uid-super')));
  await denied(getDocs(pengurusCol(linkedSantri)));
  await allowed(getDocs(pengurusCol(pengurus)));
  // Every signed-in user may look up their own record, even when it doesn't exist.
  await allowed(getDoc(doc(linkedSantri.db, 'PengurusCollection', 'uid-santri-s1')));
  await denied(setDoc(doc(pengurus.db, 'PengurusCollection', 'uid-x'), { role: 'pengurus', email: 'x@test.id' }));
  await denied(updateDoc(doc(pengurus.db, 'PengurusCollection', 'uid-pengurus'), { role: 'superAdmin' }));
  await allowed(setDoc(doc(superAdmin.db, 'PengurusCollection', 'invite-2'), { role: 'pengurus', email: 'dua@test.id', createdBy: 'uid-super' }));
  await allowed(updateDoc(doc(superAdmin.db, 'PengurusCollection', 'invite-2'), { role: 'pengasuh' }));
  await allowed(deleteDoc(doc(superAdmin.db, 'PengurusCollection', 'invite-2')));
});

test('staff invitation claim', async () => {
  const own = doc(newStaff.db, 'PengurusCollection', 'uid-new-staff');
  // First sign-in: find the invitation sent to your own email only.
  await allowed(getDocs(query(collection(newStaff.db, 'PengurusCollection'), where('email', '==', 'baru@test.id'))));
  await denied(getDocs(query(collection(newStaff.db, 'PengurusCollection'), where('email', '==', 'super@test.id'))));
  // Claims must be for yourself, with your own email, matching the invitation.
  await denied(setDoc(doc(newStaff.db, 'PengurusCollection', 'uid-someone'), staffInviteClaim({ inviteId: 'invite-1' })));
  await denied(setDoc(own, staffInviteClaim({ inviteId: 'invite-1', email: 'super@test.id' })));
  await denied(setDoc(own, staffInviteClaim({ inviteId: 'invite-1', role: 'superAdmin' })));
  await denied(setDoc(own, staffInviteClaim({ inviteId: 'uid-super' })));
  // An account without an invitation can't make itself staff by naming no invitation...
  const legacyClaim = setDoc(own, staffInviteClaim());
  if (CUTOVER) await denied(legacyClaim);
  // ...except under the transition rules, where the live client doesn't send inviteId yet.
  else { await allowed(legacyClaim); await adminDb.doc('PengurusCollection/uid-new-staff').delete(); }
  await allowed(setDoc(own, staffInviteClaim({ inviteId: 'invite-1' })));
});

test('bendahara lookup by a linked santri is limited to their own record', async () => {
  const bendaharaQuery = (ctx, santriId) => getDocs(query(collection(ctx.db, 'PengurusCollection'),
    where('santriId', '==', santriId), where('role', '==', 'bendahara')));
  const nur = await client('nur', { uid: 'uid-nur', email: 'nur.santri@test.id', claims: { santriId: 'S2' } });
  await allowed(bendaharaQuery(nur, 'S2'));
  await denied(bendaharaQuery(nur, 'S1'));
  await denied(bendaharaQuery(anon, 'S2'));
});

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

test('invoices and payments: santri read theirs; only staff write', async () => {
  const reader = CUTOVER ? linkedSantri : anon;
  await allowed(getDoc(doc(reader.db, 'Invoices', 'INV1')));
  await denied(getDocs(collection(anon.db, 'Invoices')));
  await allowed(getDocs(collection(pengurus.db, 'Invoices')));
  await allowed(getDocs(query(collection(reader.db, 'PaymentStatuses'), where('santriId', '==', 'S1'))));
  if (CUTOVER) {
    await denied(getDocs(query(collection(strangerSantri.db, 'PaymentStatuses'), where('santriId', '==', 'S1'))));
    await denied(getDocs(collection(linkedSantri.db, 'PaymentStatuses')));
  }
  for (const actor of [anon, linkedSantri]) {
    await denied(updateDoc(doc(actor.db, 'Invoices', 'INV1'), { nama: 'x' }));
    await denied(updateDoc(doc(actor.db, 'PaymentStatuses', 'PS1'), { status: 'Lunas' }));
    await denied(deleteDoc(doc(actor.db, 'PaymentStatuses', 'PS1')));
  }
  await allowed(updateDoc(doc(pengurus.db, 'PaymentStatuses', 'PS1'), { status: 'Lunas' }));
});

test('cashflow: bendahara and staff keep the books', async () => {
  const bendahara = CUTOVER ? await client('bendahara', { uid: 'uid-bendahara-santri', email: 'nur2@test.id', claims: { santriId: 'S2' } }) : anon;
  const txns = (ctx) => collection(ctx.db, 'CashflowTransactions');
  const created = await addDoc(txns(bendahara), cashflowTxn());
  await denied(addDoc(txns(bendahara), { ...cashflowTxn(), amount: -5 }));
  await denied(addDoc(txns(bendahara), { ...cashflowTxn(), type: 'transfer' }));
  await allowed(updateDoc(doc(bendahara.db, 'CashflowTransactions', created.id), { amount: 30000, description: 'Beli sabun cuci' }));
  await allowed(getDocs(txns(bendahara)));
  await allowed(setDoc(doc(bendahara.db, 'CashflowSettings', '2026-09'), { openingCash: 0, openingEmoney: 0 }, { merge: true }));
  await allowed(deleteDoc(doc(bendahara.db, 'CashflowTransactions', created.id)));
  await allowed(addDoc(txns(pengurus), cashflowTxn()));
  if (CUTOVER) {
    await denied(getDocs(txns(anon)));
    await denied(addDoc(txns(anon), cashflowTxn()));
    await denied(addDoc(txns(linkedSantri), cashflowTxn()));
  }
});

test('vouchers: santri read, super admin manage', async () => {
  // My Vouchers queries by userId (the santri id).
  await allowed(getDocs(query(collection((CUTOVER ? linkedSantri : anon).db, 'vouchers'), where('userId', '==', 'S1'))));
  if (CUTOVER) await denied(getDocs(query(collection(strangerSantri.db, 'vouchers'), where('userId', '==', 'S1'))));
  await denied(updateDoc(doc(anon.db, 'vouchers', 'V1'), { used: true }));
  await denied(updateDoc(doc(pengurus.db, 'vouchers', 'V1'), { used: true }));
  await allowed(updateDoc(doc(superAdmin.db, 'vouchers', 'V1'), { used: true }));
  await denied(getDocs(collection(anon.db, 'voucherGroup')));
  await denied(getDocs(collection(pengurus.db, 'voucherGroup')));
  await allowed(getDocs(collection(superAdmin.db, 'voucherGroup')));
});

// ---------------------------------------------------------------------------
// Staff-only and unlisted collections
// ---------------------------------------------------------------------------

test('attendance and kegiatan are staff-only; unlisted collections are closed', async () => {
  for (const name of ['AttendanceTypes', 'AttendanceRecords', 'KegiatanCollection']) {
    await denied(getDocs(collection(anon.db, name)));
    await denied(getDocs(collection(linkedSantri.db, name)));
    await allowed(getDocs(collection(pengurus.db, name)));
    await allowed(setDoc(doc(pengurus.db, name, 'staff-write'), { ok: true }));
    await denied(setDoc(doc(anon.db, name, 'anon-write'), { ok: true }));
  }
  for (const actor of [anon, linkedSantri, pengurus, superAdmin]) {
    await denied(getDoc(doc(actor.db, 'Counters', 'santri')));
    await denied(setDoc(doc(actor.db, 'SomethingNew', 'x'), { a: 1 }));
  }
});

test('legacy payment logs (AktivitasCollection) are readable by staff only, and never written by clients', async () => {
  const logs = (ctx) => collection(ctx.db, 'AktivitasCollection', 'DU11', 'PembayaranLogs');
  const logDoc = (ctx) => doc(ctx.db, 'AktivitasCollection', 'DU11', 'PembayaranLogs', 'LOG1');
  const perSantri = (ctx) => collection(ctx.db, 'AktivitasCollection', 'DU11', 'PembayaranLogs', 'LOG1', 'PaymentStatusEachSantri');
  for (const staff of [pengurus, superAdmin]) {
    await allowed(getDocs(logs(staff)));
    await allowed(getDoc(logDoc(staff)));
    await allowed(getDocs(perSantri(staff)));
  }
  for (const other of [anon, linkedSantri, strangerSantri]) {
    await denied(getDocs(logs(other)));
    await denied(getDoc(logDoc(other)));
    await denied(getDocs(perSantri(other)));
  }
  for (const actor of [anon, linkedSantri, pengurus, superAdmin]) {
    await denied(setDoc(doc(actor.db, 'AktivitasCollection', 'DU11', 'PembayaranLogs', 'NEW'), { x: 1 }));
    await denied(deleteDoc(logDoc(actor)));
  }
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const bytes = (size = 64) => new Uint8Array(size);
const upload = (ctx, filePath, contentType, size) => st.uploadBytes(st.ref(ctx.storage, filePath), bytes(size), { contentType });

test('storage uploads follow the audited paths', async () => {
  const santriUploader = CUTOVER ? linkedSantri : anon;
  await allowed(upload(anon, 'public-uploads/registration-proofs/1-bukti.jpg', 'image/jpeg'));
  await allowed(st.getDownloadURL(st.ref(anon.storage, 'public-uploads/registration-proofs/1-bukti.jpg')));
  await denied(upload(anon, 'public-uploads/registration-proofs/2-script.html', 'text/html'));

  await allowed(upload(santriUploader, 'payment_proofs/siti_aisyah/syahriah_1.pdf', 'application/pdf'));
  await allowed(st.getDownloadURL(st.ref(santriUploader.storage, 'payment_proofs/siti_aisyah/syahriah_1.pdf')));
  await denied(upload(santriUploader, 'payment_proofs/siti_aisyah/huge.jpg', 'image/jpeg', 26 * 1024 * 1024));

  await allowed(upload(santriUploader, 'public-uploads/facility-reports/S1/1_a.jpg', 'image/jpeg'));
  await denied(upload(santriUploader, 'public-uploads/facility-reports/S1/1_b.png', 'image/png'));
  if (CUTOVER) {
    await denied(upload(anon, 'payment_proofs/siti_aisyah/anon.jpg', 'image/jpeg'));
    await denied(upload(anon, 'public-uploads/facility-reports/S1/anon.jpg', 'image/jpeg'));
    await denied(upload(strangerSantri, 'public-uploads/facility-reports/S1/1_c.jpg', 'image/jpeg'));
  }

  await denied(upload(anon, 'public-uploads/facility-report-proofs/uid-super/1.jpg', 'image/jpeg'));
  await denied(upload(pengurus, 'public-uploads/facility-report-proofs/uid-super/1.jpg', 'image/jpeg'));
  await allowed(upload(superAdmin, 'public-uploads/facility-report-proofs/uid-super/1.jpg', 'image/jpeg'));

  await denied(upload(anon, 'reports/Kegiatan-Dalam-a-to-b.pdf', 'application/pdf'));
  await allowed(upload(pengurus, 'reports/Kegiatan-Dalam-a-to-b.pdf', 'application/pdf'));
  await allowed(upload(pengurus, 'reports/Kegiatan-Dalam-a-to-b.pdf', 'application/pdf'));
  await allowed(st.getDownloadURL(st.ref(pengurus.storage, 'reports/Kegiatan-Dalam-a-to-b.pdf')));

  await denied(upload(anon, 'anything/else.jpg', 'image/jpeg'));
  await denied(upload(superAdmin, 'anything/else.jpg', 'image/jpeg'));
  await denied(st.listAll(st.ref(anon.storage, 'payment_proofs')));
  await denied(st.deleteObject(st.ref(anon.storage, 'public-uploads/registration-proofs/1-bukti.jpg')));
});
