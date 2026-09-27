// Run against the Firestore emulator only; never writes to a real project.
// firebase emulators:exec --only firestore --project demo-esantren-izin \
//   --config tests/firebase.izin.json 'node --test tests/facility-reports.emulator.cjs'
const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { initializeApp, deleteApp } = require('firebase/app');
const firestore = require('firebase/firestore');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required.');
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Only a local emulator is allowed.');
const app = initializeApp({ projectId: 'demo-esantren-izin' });
const db = firestore.getFirestore(app);
firestore.connectFirestoreEmulator(db, host, Number(port));
const { doc, setDoc, getDoc, getDocs, collection, terminate } = firestore;
const root = path.resolve(__dirname, '..');
const modules = new Map();
// Transpile the actual application service; replace only its environment config.
function loadSource(relative) {
  const filename = path.resolve(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  modules.set(filename, module);
  const localRequire = specifier => {
    if (specifier === './config') return { db, storage: null };
    if (specifier.startsWith('@/')) return loadSource('src/' + specifier.slice(2) + '.ts');
    return require(specifier);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const service = loadSource('src/firebase/facilityReports.ts');
const rules = loadSource('src/utils/facilityReports.ts');
after(async () => { await terminate(db); await deleteApp(app); });

let counter = 0;
const superAdmin = { uid: 'admin-uid', role: 'superAdmin', name: 'Admin Test', email: 'admin@test' };
const storageUrl = storagePath =>
  `https://firebasestorage.googleapis.com/v0/b/demo/o/${encodeURIComponent(storagePath)}?alt=media`;
const photoFor = (prefix, owner, name = 'a') => {
  const storagePath = `${rules.facilityPhotoOwnerPrefix(prefix, owner)}1_${name}.jpg`;
  return { url: storageUrl(storagePath), storagePath };
};
async function fixture() {
  const id = 'fac-santri-' + ++counter;
  const user = { uid: 'wali_' + id, role: 'waliSantri', santriId: id, name: 'Nama Login', email: null };
  await setDoc(doc(db, 'SantriCollection', id), { nama: 'Siti Test ' + counter, kamar: '203 B' });
  return { id, user };
}
const input = (overrides = {}) => ({ place: 'Kamar Mandi', description: 'Keran bocor', photos: [], ...overrides });
const record = async id => (await getDoc(doc(db, 'FacilityReports', id))).data();
const reportCount = async () => (await getDocs(collection(db, 'FacilityReports'))).size;

test('a santri report records the reporter from SantriCollection and starts pending', async () => {
  const { id, user } = await fixture();
  const photo = photoFor(rules.FACILITY_REPORT_PHOTO_PREFIX, id);
  const reportId = rules.createFacilityReportId();
  await service.createFacilityReport(input({ place: ' Musholla ', photos: [photo] }), user, reportId);
  const saved = await record(reportId);
  assert.equal(saved.status, 'pending');
  assert.equal(saved.santriId, id);
  assert.equal(saved.santriName, `Siti Test ${counter}`);
  assert.equal(saved.kamar, '203 B');
  assert.equal(saved.place, 'Musholla');
  assert.deepEqual(saved.photos, [photo]);
  assert.deepEqual(saved.resolutionPhotos, []);
  assert.equal(saved.reportedDate, rules.todayJakartaISO());

  const listed = (await service.getFacilityReports()).find(report => report.id === reportId);
  assert.equal(typeof listed.reportedAtMillis, 'number', 'server timestamp is exposed as millis');
});

test('a retried submit keeps the original report instead of duplicating it', async () => {
  const { user } = await fixture();
  const reportId = rules.createFacilityReportId();
  await service.createFacilityReport(input(), user, reportId);
  const before = await reportCount();
  await service.createFacilityReport(input({ description: 'Diubah' }), user, reportId);
  assert.equal(await reportCount(), before);
  assert.equal((await record(reportId)).description, 'Keran bocor');
  const other = await fixture();
  await assert.rejects(service.createFacilityReport(input(), other.user, reportId), /tidak sesuai/);
});

test('staff, unknown santri, empty input and foreign photos cause no writes', async () => {
  const { user } = await fixture();
  const other = await fixture();
  const before = await reportCount();
  const attempt = (overrides, actor = user) =>
    service.createFacilityReport(input(overrides), actor, rules.createFacilityReportId());
  await assert.rejects(attempt({}, superAdmin), /Hanya santri/);
  await assert.rejects(attempt({}, { uid: 'p', role: 'pengurus', santriId: user.santriId }), /Hanya santri/);
  await assert.rejects(attempt({}, { ...user, santriId: 'missing-santri' }), /tidak ditemukan/);
  await assert.rejects(attempt({ description: '   ' }), /Deskripsi/);
  await assert.rejects(
    attempt({ photos: [photoFor(rules.FACILITY_REPORT_PHOTO_PREFIX, other.id)] }),
    /bukan unggahan Anda/,
  );
  assert.equal(await reportCount(), before);
});

test('a reporter withdraws only their own pending report; super admin may remove any', async () => {
  const { user } = await fixture();
  const other = await fixture();
  const first = rules.createFacilityReportId();
  await service.createFacilityReport(input(), user, first);
  await assert.rejects(service.withdrawFacilityReport(first, other.user), /bukan milik Anda/);
  await service.withdrawFacilityReport(first, user);
  assert.equal(await record(first), undefined);

  const second = rules.createFacilityReportId();
  await service.createFacilityReport(input(), user, second);
  await service.reviewFacilityReport(second, 'resolved', '', undefined, superAdmin);
  await assert.rejects(service.withdrawFacilityReport(second, user), /sudah diproses/);
  await service.withdrawFacilityReport(second, superAdmin);
  assert.equal(await record(second), undefined);
});

test('only the super admin closes a report, once, and a decline needs a reason', async () => {
  const { user } = await fixture();
  const reportId = rules.createFacilityReportId();
  await service.createFacilityReport(input(), user, reportId);
  await assert.rejects(service.reviewFacilityReport(reportId, 'resolved', '', undefined, user), /kewenangan/);
  await assert.rejects(
    service.reviewFacilityReport(reportId, 'resolved', '', undefined, { uid: 'p', role: 'pengurus' }),
    /kewenangan/,
  );
  await assert.rejects(service.reviewFacilityReport(reportId, 'declined', 'dobel', undefined, superAdmin), /minimal 8/);
  assert.equal((await record(reportId)).status, 'pending');

  await service.reviewFacilityReport(reportId, 'declined', 'Sudah dilaporkan sebelumnya', undefined, superAdmin);
  const declined = await record(reportId);
  assert.equal(declined.status, 'declined');
  assert.equal(declined.reviewNote, 'Sudah dilaporkan sebelumnya');
  assert.equal(declined.reviewedByName, 'Admin Test');
  assert.equal(declined.resolvedByName, undefined);
  await assert.rejects(service.reviewFacilityReport(reportId, 'resolved', '', undefined, superAdmin), /sudah diproses/);
});

test('resolving records the fix with proof photos, which can be managed afterwards', async () => {
  const { user } = await fixture();
  const reportId = rules.createFacilityReportId();
  await service.createFacilityReport(input(), user, reportId);
  await assert.rejects(service.saveFacilityRepairProof(reportId, [], superAdmin), /sudah selesai/);

  const proof = photoFor(rules.FACILITY_PROOF_PHOTO_PREFIX, superAdmin.uid, 'fix');
  await assert.rejects(
    service.reviewFacilityReport(
      reportId, 'resolved', '', [photoFor(rules.FACILITY_PROOF_PHOTO_PREFIX, 'someone-else')], superAdmin,
    ),
    /bukan unggahan Anda/,
  );
  await service.reviewFacilityReport(reportId, 'resolved', 'Keran diganti baru', [proof], superAdmin);
  const resolved = await record(reportId);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolvedByName, 'Admin Test');
  assert.deepEqual(resolved.resolutionPhotos, [proof]);

  // Another super admin can add a photo while keeping the earlier admin's proof.
  const secondAdmin = { ...superAdmin, uid: 'admin-2', name: 'Admin Dua' };
  const extra = photoFor(rules.FACILITY_PROOF_PHOTO_PREFIX, secondAdmin.uid, 'extra');
  await service.saveFacilityRepairProof(reportId, [proof, extra], secondAdmin);
  assert.deepEqual((await record(reportId)).resolutionPhotos, [proof, extra]);
  await assert.rejects(service.saveFacilityRepairProof(reportId, [], user), /Hanya Super Admin/);
  await service.saveFacilityRepairProof(reportId, [extra], secondAdmin);
  assert.deepEqual((await record(reportId)).resolutionPhotos, [extra]);
});
