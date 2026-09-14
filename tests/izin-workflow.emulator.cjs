// Run against the Firestore emulator only; never writes to a real project.
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 node --test tests/izin-workflow.emulator.cjs
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
const auth = { currentUser: null };
const { doc, setDoc, getDoc, Timestamp, getDocs, collection, terminate } = firestore;
const root = path.resolve(__dirname, '..');
const modules = new Map();
// Transpile the actual application service; replace only its environment config.
function loadSource(relative) {
  let filename = path.resolve(root, relative);
  if (!fs.existsSync(filename) && filename.endsWith('.ts')) filename = filename.slice(0, -3) + '/index.ts';
  if (modules.has(filename)) return modules.get(filename).exports;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  modules.set(filename, module);
  const localRequire = specifier => {
    if (specifier === './config') return { db, auth };
    if (specifier.startsWith('@/')) return loadSource('src/' + specifier.slice(2) + '.ts');
    if (specifier.startsWith('.')) return loadSource(path.relative(root, path.resolve(path.dirname(filename), specifier)) + '.ts');
    return require(specifier);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const service = loadSource('src/firebase/izinSakitPulang.ts');
const workflow = loadSource('src/utils/izinWorkflow.ts');
const attendance = loadSource('src/firebase/attendance.ts');
let counter = 0;
const date = offset => Timestamp.fromMillis(Date.now() + offset);
const input = () => ({ izinType: 'Pulang', alasan: 'Acara Keluarga', tglPulang: date(-86400000), rencanaTanggalKembali: date(86400000) });
const sick = { izinType: 'Sakit', keluhan: 'Demam' };
async function fixture() {
  const id = 'santri-' + ++counter;
  const user = { uid: 'wali_' + id, role: 'waliSantri', santriId: id, name: 'Test Santri', email: null };
  await setDoc(doc(db, 'SantriCollection', id), { nama: 'Test Santri', statusKehadiran: 'Ada', jumlahTunggakan: 125000 });
  return { id, user };
}
const record = async id => ({ ...(await getDoc(doc(db, 'SakitDanPulangCollection', id))).data(), id });
const santri = async id => (await getDoc(doc(db, 'SantriCollection', id))).data();
after(async () => { await terminate(db); await deleteApp(app); });

test('direct report updates leave and attendance and keeps the authoritative balance', async () => {
  const { id, user } = await fixture();
  const izinId = await service.createIzinApplication(input(), user);
  const izin = await record(izinId);
  assert.equal(izin.status, 'Proses Pulang');
  assert.equal(izin.workflowVersion, 2);
  assert.equal(izin.jumlahTunggakan, 125000);
  assert.equal(izin.reportedBy.uid, user.uid);
  assert.equal('sudahDapatIzinUstadzah' in izin, false);
  assert.equal('sudahDapatIzinNdalem' in izin, false);
  const student = await santri(id);
  assert.equal(student.statusKehadiran, 'Pulang');
  assert.equal(student.statusKepulangan.izinId, izinId);
});

test('santri self-return records time and actor; repeated completion is idempotent', async () => {
  const { id, user } = await fixture();
  const izinId = await service.createIzinApplication(input(), user);
  const returned = new Date(Date.now() - 1000);
  await service.reportSantriReturn(izinId, user, returned);
  const first = await record(izinId);
  assert.equal(first.status, 'Sudah Kembali');
  assert.equal(first.tanggalKembali.toMillis(), returned.getTime());
  assert.equal(first.returnReportedBy.role, 'waliSantri');
  assert.equal(first.kembaliSesuaiRencana, true);
  assert.equal((await santri(id)).statusKehadiran, 'Ada');
  assert.equal((await santri(id)).statusKepulangan, undefined);
  await service.reportSantriReturn(izinId, user);
  assert.deepEqual(await record(izinId), first);
});

test('pengurus records late return; other santri, pengasuh and superAdmin cannot complete', async () => {
  const { user } = await fixture();
  const izinId = await service.createIzinApplication({ ...input(), rencanaTanggalKembali: date(-3600000) }, user);
  for (const unauthorized of [
    { ...user, santriId: 'another-santri' },
    { uid: 'pengasuh', role: 'pengasuh' }, { uid: 'admin', role: 'superAdmin' },
  ]) await assert.rejects(service.reportSantriReturn(izinId, unauthorized), /Hanya santri/);
  const pengurus = { uid: 'pengurus', role: 'pengurus', name: 'Pengurus Test' };
  await setDoc(doc(db, 'PengurusCollection', pengurus.uid), { role: 'pengurus', name: 'Pengurus Test' });
  await assert.rejects(service.reportSantriReturn(izinId, pengurus), /Sesi/);
  auth.currentUser = { uid: pengurus.uid };
  await service.reportSantriReturn(izinId, pengurus);
  auth.currentUser = null;
  const izin = await record(izinId);
  assert.equal(izin.kembaliSesuaiRencana, false);
  assert.equal(izin.returnReportedBy.uid, 'pengurus');
});

test('invalid dates, empty reason, missing santri and wrong reporter cause no writes', async () => {
  const { id, user } = await fixture();
  const before = (await getDocs(collection(db, 'SakitDanPulangCollection'))).size;
  await assert.rejects(service.createIzinApplication({ ...input(), alasan: '   ' }, user));
  await assert.rejects(service.createIzinApplication({ ...input(), tglPulang: date(10000) }, user), /masa depan/);
  await assert.rejects(service.createIzinApplication({ ...input(), rencanaTanggalKembali: date(-172800000) }, user));
  await assert.rejects(service.createIzinApplication(input(), { ...user, role: 'pengurus' }));
  await assert.rejects(service.createIzinApplication(input(), { ...user, santriId: 'missing' }));
  assert.equal((await getDocs(collection(db, 'SakitDanPulangCollection'))).size, before);
  assert.equal((await santri(id)).statusKehadiran, 'Ada');
  const izinId = await service.createIzinApplication(input(), user);
  await assert.rejects(service.reportSantriReturn(izinId, user, new Date(Date.now() + 10000)), /masa depan/);
  await assert.rejects(service.reportSantriReturn(izinId, user, new Date(Date.now() - 172800000)), /sebelum/);
  assert.equal((await record(izinId)).status, 'Proses Pulang');
  assert.equal((await santri(id)).statusKehadiran, 'Pulang');
});

test('concurrent reports of the same type commit only once', async () => {
  const { id, user } = await fixture();
  const attempts = await Promise.allSettled([
    service.createIzinApplication(input(), user), service.createIzinApplication(input(), user),
  ]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  const fulfilled = attempts.find(result => result.status === 'fulfilled');
  assert.equal((await santri(id)).statusKepulangan.izinId, fulfilled.value);
});

test('retrying a submission ID does not create or reopen a report', async () => {
  const { user } = await fixture();
  const submissionId = 'submission-' + counter;
  await service.createIzinApplication(input(), user, submissionId);
  await service.reportSantriReturn(submissionId, user);
  const completed = await record(submissionId);
  assert.equal(await service.createIzinApplication(input(), user, submissionId), submissionId);
  assert.deepEqual(await record(submissionId), completed);
});

test('sickness can be self-reported and recovered with attendance restored', async () => {
  const { id, user } = await fixture();
  const izinId = await service.createIzinApplication(sick, user);
  assert.equal((await record(izinId)).status, 'Dalam Masa Sakit');
  assert.equal((await santri(id)).statusKehadiran, 'Sakit');
  await service.reportSantriRecovered(izinId, user);
  const result = await record(izinId);
  assert.equal(result.status, 'Sudah Sembuh');
  assert.ok(result.tanggalSembuh instanceof Timestamp);
  assert.equal(result.recoveryReportedBy.uid, user.uid);
  assert.equal((await santri(id)).statusKehadiran, 'Ada');
  assert.equal((await santri(id)).statusSakit, undefined);
});

test('overlapping sickness and leave restore the remaining active status in either order', async () => {
  for (const finishLeaveFirst of [true, false]) {
    const { id, user } = await fixture();
    const pulangId = await service.createIzinApplication(input(), user);
    const sakitId = await service.createIzinApplication(sick, user);
    assert.equal((await santri(id)).statusKehadiran, 'Pulang');
    if (finishLeaveFirst) {
      await service.reportSantriReturn(pulangId, user);
      assert.equal((await santri(id)).statusKehadiran, 'Sakit');
      await service.reportSantriRecovered(sakitId, user);
    } else {
      await service.reportSantriRecovered(sakitId, user);
      assert.equal((await santri(id)).statusKehadiran, 'Pulang');
      await service.reportSantriReturn(pulangId, user);
    }
    assert.equal((await santri(id)).statusKehadiran, 'Ada');
  }
});

test('legacy pending reports can close without approval and cannot overwrite newer attendance', async () => {
  const { id, user } = await fixture();
  const currentId = await service.createIzinApplication(input(), user);
  for (const status of ['Menunggu Persetujuan Ustadzah', 'Menunggu Persetujuan Ndalem']) {
    const legacyId = 'legacy-' + counter + '-' + status.replaceAll(' ', '-');
    await setDoc(doc(db, 'SakitDanPulangCollection', legacyId), {
      ...input(), timestamp: date(-172800000), santriId: id, status,
      sudahDapatIzinUstadzah: false, sudahDapatIzinNdalem: false, sudahKembali: null,
    });
    assert.equal(workflow.canReportIzinCompletion(await record(legacyId), user), true);
    const ongoing = await service.getOngoingIzinApplications();
    assert.ok(ongoing.some(item => item.id === legacyId));
    await service.reportSantriReturn(legacyId, user);
    assert.equal((await record(legacyId)).status, 'Sudah Kembali');
    assert.equal((await santri(id)).statusKehadiran, 'Pulang');
    assert.equal((await santri(id)).statusKepulangan.izinId, currentId);
  }
});

test('rejected history stays closed and boundary return counts as on time', async () => {
  const { id, user } = await fixture();
  const rejectedId = 'rejected-' + counter;
  await setDoc(doc(db, 'SakitDanPulangCollection', rejectedId), {
    ...input(), timestamp: date(-1000), santriId: id, status: 'Ditolak',
  });
  await assert.rejects(service.reportSantriReturn(rejectedId, user), /tidak aktif/);
  const planned = date(-1000);
  const activeId = await service.createIzinApplication({ ...input(), rencanaTanggalKembali: planned }, user);
  await service.reportSantriReturn(activeId, user, planned.toDate());
  assert.equal((await record(activeId)).kembaliSesuaiRencana, true);
  const history = await service.getIzinHistory();
  assert.equal(history.length, 8);
  assert.ok(history.every(item => !workflow.isIzinOngoing(item)));
});

test('attendance return shortcut verifies pengurus and uses the same completion write', async () => {
  const { id, user } = await fixture();
  const izinId = await service.createIzinApplication(input(), user);
  const map = (await santri(id)).statusKepulangan;
  const pengurusId = 'attendance-pengurus';
  await setDoc(doc(db, 'PengurusCollection', pengurusId), { role: 'pengurus', name: 'Pengurus Test' });
  await assert.rejects(attendance.overrideReturnStatus(id, true, pengurusId, map), /Sesi/);
  auth.currentUser = { uid: pengurusId };
  await assert.rejects(attendance.overrideReturnStatus('another-santri', true, pengurusId, map), /tidak sesuai/);
  await attendance.overrideReturnStatus(id, true, pengurusId, map);
  assert.equal((await record(izinId)).returnReportedBy.uid, pengurusId);
  assert.equal((await santri(id)).statusKehadiran, 'Ada');
  auth.currentUser = null;
});

test('denied attendance writes roll back both report creation and completion', async () => {
  const createId = 'atomic-create';
  const user = { uid: 'wali_' + createId, role: 'waliSantri', santriId: createId };
  await setDoc(doc(db, 'SantriCollection', createId), { nama: 'Atomic Test', statusKehadiran: 'Ada' });
  await assert.rejects(service.createIzinApplication(input(), user, 'atomic-new-report'), error => error.code === 'permission-denied');
  assert.equal((await getDoc(doc(db, 'SakitDanPulangCollection', 'atomic-new-report'))).exists(), false);
  assert.equal((await santri(createId)).statusKehadiran, 'Ada');

  const completeId = 'atomic-complete';
  const izinId = 'atomic-return-report';
  await setDoc(doc(db, 'SantriCollection', completeId), {
    nama: 'Atomic Test', statusKehadiran: 'Pulang', statusKepulangan: { izinId },
  });
  await setDoc(doc(db, 'SakitDanPulangCollection', izinId), {
    ...input(), santriId: completeId, timestamp: date(-1000), status: 'Proses Pulang', sudahKembali: false,
  });
  await assert.rejects(service.reportSantriReturn(izinId, { ...user, santriId: completeId }), error => error.code === 'permission-denied');
  assert.equal((await record(izinId)).status, 'Proses Pulang');
  assert.equal((await record(izinId)).sudahKembali, false);
  assert.equal((await santri(completeId)).statusKehadiran, 'Pulang');
});

test('concurrent santri and pengurus returns preserve the first completion audit', async () => {
  const { id, user } = await fixture();
  const izinId = await service.createIzinApplication(input(), user);
  const pengurus = { uid: 'concurrent-pengurus', role: 'pengurus' };
  await setDoc(doc(db, 'PengurusCollection', pengurus.uid), { role: 'pengurus', name: 'Pengurus Test' });
  auth.currentUser = { uid: pengurus.uid };
  const dates = [new Date(Date.now() - 2000), new Date(Date.now() - 1000)];
  await Promise.all([
    service.reportSantriReturn(izinId, user, dates[0]),
    service.reportSantriReturn(izinId, pengurus, dates[1]),
  ]);
  auth.currentUser = null;
  const izin = await record(izinId);
  const index = izin.returnReportedBy.uid === user.uid ? 0 : 1;
  assert.equal(izin.tanggalKembali.toMillis(), dates[index].getTime());
  assert.equal((await santri(id)).statusKehadiran, 'Ada');
});

test('legacy pending sickness can close without approval; pengurus can record recovery', async () => {
  const { id, user } = await fixture();
  const legacyId = 'legacy-sick-' + counter;
  await setDoc(doc(db, 'SakitDanPulangCollection', legacyId), {
    ...sick, santriId: id, timestamp: date(-86400000), status: 'Menunggu Diperiksa Ustadzah', sudahDapatIzinUstadzah: false,
  });
  await service.reportSantriRecovered(legacyId, user);
  assert.equal((await record(legacyId)).status, 'Sudah Sembuh');
  const currentId = await service.createIzinApplication(sick, user);
  const pengurusId = 'recovery-pengurus';
  await setDoc(doc(db, 'PengurusCollection', pengurusId), { role: 'pengurus', name: 'Pengurus Test' });
  auth.currentUser = { uid: pengurusId };
  await attendance.overrideSickStatus(id, false, pengurusId, { izinId: currentId });
  auth.currentUser = null;
  assert.equal((await record(currentId)).recoveryReportedBy.uid, pengurusId);
  assert.equal((await santri(id)).statusKehadiran, 'Ada');
});
