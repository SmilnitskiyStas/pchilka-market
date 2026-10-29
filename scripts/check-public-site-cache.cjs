const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadCache(fetch, now = () => Date.now()) {
  const filename = path.join(__dirname, '..', 'lib', 'public-site-data-client.ts');
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(exports) { ${js}\n})`, { fetch, Date: { now } })(exports);
  return exports;
}
test('rapid navigation reuses all three public datasets, with refresh after 30 seconds', async () => {
  let clock = 100, requests = 0;
  const cache = loadCache(async () => ({ ok: true, json: async () => ({ version: ++requests }) }), () => clock);
  const urls = ['/api/site/content', '/api/site/menu', '/api/admin/seo/rules'];
  const first = await Promise.all(urls.map(url => cache.fetchPublicSiteData(url)));
  const second = await Promise.all(urls.map(url => cache.fetchPublicSiteData(url)));
  assert.equal(requests, 3);
  assert.deepEqual(second, first);
  clock += 30001;
  await Promise.all(urls.map(url => cache.fetchPublicSiteData(url)));
  assert.equal(requests, 6);
});
test('in-flight requests survive route cleanup and are shared by the next page', async () => {
  let requests = 0, release;
  const response = new Promise(resolve => { release = resolve; });
  const cache = loadCache(async () => { requests++; return response; });
  const first = cache.fetchPublicSiteData('/api/site/menu');
  const nextPage = cache.fetchPublicSiteData('/api/site/menu');
  release({ ok: true, json: async () => ({ menu: ['updated'] }) });
  assert.deepEqual(await first, await nextPage);
  assert.equal(requests, 1);
});
test('window focus can refresh fresh data; simultaneous focus refreshes are deduplicated', async () => {
  let requests = 0;
  const cache = loadCache(async () => ({ ok: true, json: async () => ({ version: ++requests }) }));
  await cache.fetchPublicSiteData('/api/site/content');
  const result = await Promise.all([cache.fetchPublicSiteData('/api/site/content', true), cache.fetchPublicSiteData('/api/site/content', true)]);
  assert.equal(requests, 2);
  assert.equal(result[0].version, 2);
  assert.equal(result[1].version, 2);
});
test('failed responses are not cached and can be retried', async () => {
  let requests = 0;
  const cache = loadCache(async () => ++requests === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ ready: true }) });
  await assert.rejects(cache.fetchPublicSiteData('/api/site/content'), /503/);
  assert.equal((await cache.fetchPublicSiteData('/api/site/content')).ready, true);
  assert.equal(requests, 2);
});
test('returning from admin invalidates old data even if an old request resolves later', async () => {
  let requests = 0, release;
  const oldResponse = new Promise(resolve => { release = resolve; });
  const cache = loadCache(async () => ++requests === 1 ? oldResponse : { ok: true, json: async () => ({ version: 2 }) });
  const old = cache.fetchPublicSiteData('/api/site/menu');
  cache.clearPublicSiteData();
  const current = await cache.fetchPublicSiteData('/api/site/menu');
  release({ ok: true, json: async () => ({ version: 1 }) });
  await old;
  assert.equal(current.version, 2);
  assert.equal((await cache.fetchPublicSiteData('/api/site/menu')).version, 2);
  assert.equal(requests, 2);
});
