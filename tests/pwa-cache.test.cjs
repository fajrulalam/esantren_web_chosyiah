const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const origin = 'https://esantren-chosyiah.example';
const oldCache = 'esantren-chosyiah-cache-v1';
const currentCache = 'esantren-chosyiah-cache-v2';

function worker({ network = async () => new Response('current deployment'), putFails = false } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const fetches = [];
  const deleted = [];
  const precached = [];
  const calls = [];
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => { deleted.push(name); return stores.delete(name); },
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        addAll: async urls => { precached.push(...urls); for (const url of urls) store.set(url, new Response('offline shell')); },
        match: async request => store.get(key(request))?.clone(),
        put: async (request, response) => {
          if (putFails) throw new Error('storage quota');
          store.set(key(request), response);
        },
      };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8'), {
    self: {
      location: { origin },
      addEventListener: (name, callback) => listeners.set(name, callback),
      skipWaiting: async () => calls.push('skipWaiting'),
      clients: { claim: async () => calls.push('claim') },
    },
    caches, URL, Response,
    fetch: async (...args) => { fetches.push(args); return network(...args); },
  });
  return {
    stores, fetches, deleted, precached, calls,
    lifecycle: async name => {
      let pending;
      listeners.get(name)({ waitUntil: value => { pending = value; } });
      await pending;
    },
    request: async (pathname, options = {}) => {
      let response;
      const request = {
        url: new URL(pathname, origin).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options,
      };
      listeners.get('fetch')({ request, respondWith: value => { response = value; } });
      return await response;
    },
  };
}

test('page navigations fetch current HTML even when an old page is cached', async () => {
  const sw = worker();
  sw.stores.set(oldCache, new Map([[origin + '/izin-admin/', new Response('old approval UI')]]));
  sw.stores.set(currentCache, new Map([[origin + '/izin-admin/', new Response('old approval UI')]]));
  assert.equal(await (await sw.request('/izin-admin/', { mode: 'navigate' })).text(), 'current deployment');
  assert.equal(sw.fetches.length, 1);
  assert.equal(sw.fetches[0][1].cache, 'no-store');
});

test('activation removes only this app’s obsolete caches and claims clients', async () => {
  const sw = worker();
  for (const name of [oldCache, currentCache, 'another-app']) sw.stores.set(name, new Map());
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, [oldCache]);
  assert.ok(sw.stores.has('another-app'));
  assert.ok(sw.stores.has(currentCache));
  assert.deepEqual(sw.calls, ['claim']);
});

test('installation caches offline assets, never the home or Izin page', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.ok(sw.precached.includes('/offline.html'));
  assert.equal(sw.precached.includes('/'), false);
  assert.equal(sw.precached.some(url => url.startsWith('/izin-')), false);
  assert.deepEqual(sw.calls, ['skipWaiting']);
});

test('API, Firebase, auth, RSC and non-GET requests bypass worker caching', async () => {
  const sw = worker();
  for (const [url, options] of [
    ['/api/report', {}], ['/api', {}], ['/__/auth/handler', {}],
    ['https://firestore.googleapis.com/v1/data', {}],
    ['/izin-admin/?_rsc=abc', {}], ['/izin-admin/', { headers: new Headers({ RSC: '1' }) }],
    ['/_next/static/chunks/page.js', { headers: new Headers({ RSC: '1' }) }],
    ['/izin-admin/', { method: 'POST' }],
  ]) assert.equal(await sw.request(url, options), undefined);
  assert.equal(sw.fetches.length, 0);
  assert.equal(sw.stores.size, 0);
});

test('immutable assets are cached and new deployment hashes fetch separately', async () => {
  const sw = worker();
  await sw.request('/_next/static/chunks/old-hash.js');
  await sw.request('/_next/static/chunks/old-hash.js');
  assert.equal(sw.fetches.length, 1);
  await sw.request('/_next/static/chunks/new-hash.js');
  assert.equal(sw.fetches.length, 2);
});

test('offline navigation shows the offline shell instead of stale authenticated HTML', async () => {
  const sw = worker({ network: async () => { throw new Error('offline'); } });
  await sw.lifecycle('install');
  sw.stores.set(oldCache, new Map([[origin + '/izin-admin/', new Response('old private page')]]));
  assert.equal(await (await sw.request('/izin-admin/', { mode: 'navigate' })).text(), 'offline shell');
  const empty = worker({ network: async () => { throw new Error('offline'); } });
  assert.equal((await empty.request('/izin-admin/', { mode: 'navigate' })).status, 503);
});

test('cache storage failure and redirect responses do not break asset loading', async () => {
  const sw = worker({ putFails: true });
  assert.equal(await (await sw.request('/_next/static/chunks/page.js')).text(), 'current deployment');
  const redirected = new Response('redirect target');
  Object.defineProperty(redirected, 'redirected', { value: true });
  const redirects = worker({ network: async () => redirected });
  await redirects.request('/_next/static/chunks/page.js');
  assert.equal(redirects.stores.get(currentCache).size, 0);
});

// Run the React effect with mocked platform APIs, without opening a browser.
function registrationEffect(environment) {
  const tasks = [];
  const events = new Map();
  const deleted = [];
  const removed = [];
  const registrations = [];
  let updates = 0;
  let effect;
  const add = (name, fn) => events.set(name, fn);
  const remove = (name, fn) => { if (events.get(name) === fn) events.delete(name); };
  const own = { active: { scriptURL: origin + '/sw.js' }, unregister: async () => removed.push('own') };
  const other = { active: { scriptURL: origin + '/another-app/worker.js' }, unregister: async () => removed.push('other') };
  const serviceWorker = {
    getRegistrations: async () => [own, other],
    register: async (...args) => {
      registrations.push(args);
      return { update: async () => { updates++; } };
    },
  };
  const caches = { keys: async () => [oldCache, currentCache, 'other-app'], delete: async name => deleted.push(name) };
  const document = { readyState: 'complete', visibilityState: 'visible', addEventListener: add, removeEventListener: remove };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'src/components/PWARegister.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    require: name => { assert.equal(name, 'react'); return { useEffect: callback => { effect = callback; } }; },
    exports: module.exports, module, process: { env: { NODE_ENV: environment } },
    navigator: { serviceWorker }, window: { caches, location: { origin }, addEventListener: add, removeEventListener: remove },
    caches, document, URL, console,
  });
  module.exports.default();
  const cleanup = effect();
  return { events, deleted, removed, registrations, document, cleanup, updates: () => updates,
    settle: async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); await Promise.all(tasks); } };
}

test('development unregisters the old app worker and clears only its caches', async () => {
  const registration = registrationEffect('development');
  await registration.settle();
  assert.deepEqual(registration.removed, ['own']);
  assert.deepEqual(registration.deleted, [oldCache, currentCache]);
  assert.equal(registration.registrations.length, 0);
});

test('production bypasses HTTP cache for updates and removes lifecycle listeners on unmount', async () => {
  const registration = registrationEffect('production');
  await registration.settle();
  assert.equal(registration.registrations[0][0], '/sw.js');
  assert.equal(registration.registrations[0][1].updateViaCache, 'none');
  assert.equal(registration.updates(), 1);
  registration.events.get('online')();
  assert.equal(registration.updates(), 2);
  registration.document.visibilityState = 'hidden';
  registration.events.get('visibilitychange')();
  assert.equal(registration.updates(), 2);
  registration.cleanup();
  assert.equal(registration.events.size, 0);
});
