import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const origin = 'https://estoq.test';
const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker() {
  const listeners = new Map(), stores = new Map(), fetched = [];
  let offline = false, status = 200;
  const key = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
  const fetch = async request => {
    fetched.push(key(request));
    if (offline) throw new TypeError('Sem conexão');
    return new Response(key(request).endsWith('/offline.html') ? 'Página pública de reconexão' : 'Resposta atual da rede', { status });
  };
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        add: async request => store.set(key(request), await fetch(request)),
        match: async request => store.get(key(request))?.clone(),
      };
    },
  };
  const self = {
    location: { origin },
    addEventListener: (name, listener) => listeners.set(name, listener),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  class WorkerRequest extends Request {
    constructor(input, init) { super(new URL(input, origin), init); }
  }
  runInNewContext(source, { self, caches, fetch, URL, Request: WorkerRequest, Response });
  return {
    stores, fetched, caches,
    disconnect: () => { offline = true; },
    status: value => { status = value; },
    lifecycle: name => {
      let pending;
      listeners.get(name)({ waitUntil: value => { pending = value; } });
      return pending;
    },
    request: (path, { method = 'GET', mode = 'navigate' } = {}) => {
      let response;
      listeners.get('fetch')({
        request: { url: new URL(path, origin).href, method, mode },
        respondWith: value => { response = value; },
      });
      return response;
    },
  };
}

test('a instalação guarda apenas a página pública de reconexão', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.deepEqual([...sw.stores.values()].flatMap(store => [...store.keys()]), [origin + '/offline.html']);
  await sw.request('/');
  await sw.request('/painel.html');
  assert.deepEqual([...sw.stores.values()].flatMap(store => [...store.keys()]), [origin + '/offline.html']);
});

test('login, sessões, API, gravações e recursos não são interceptados pelo cache', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  for (const path of ['/api', '/api/state', '/api/auth/me', '/api/auth/login', '/api/auth/logout']) {
    assert.equal(sw.request(path), undefined, path);
    assert.equal(sw.request(path, { method: 'POST' }), undefined, path);
  }
  assert.equal(sw.request('/painel.html', { method: 'POST' }), undefined);
  assert.equal(sw.request('/app.js', { mode: 'cors' }), undefined);
  assert.equal(sw.request('https://outro.test/'), undefined);
  assert.deepEqual(sw.fetched, [origin + '/offline.html']);
});

test('as navegações usam a rede e a reconexão só aparece quando ela falha', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.equal(await (await sw.request('/painel.html#visits')).text(), 'Resposta atual da rede');
  sw.status(503);
  const unavailable = await sw.request('/painel.html');
  assert.equal(unavailable.status, 503);
  assert.equal(await unavailable.text(), 'Resposta atual da rede');
  sw.disconnect();
  const offline = await sw.request('/painel.html#visits');
  assert.equal(offline.status, 200);
  assert.equal(await offline.text(), 'Página pública de reconexão');
});

test('ativar uma versão nova remove somente os caches antigos de reconexão', async () => {
  const sw = worker();
  await sw.caches.open('estoq-offline-old');
  await sw.caches.open('outro-aplicativo');
  await sw.lifecycle('install');
  const current = [...sw.stores.keys()].find(name => !['estoq-offline-old', 'outro-aplicativo'].includes(name));
  await sw.lifecycle('activate');
  assert.equal(sw.stores.has('estoq-offline-old'), false);
  assert.equal(sw.stores.has('outro-aplicativo'), true);
  assert.equal(sw.stores.has(current), true);
});
