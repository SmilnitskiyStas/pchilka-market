/* Integration checks use isolated temporary uploads and real route/auth handlers. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pchilka-catalog-check-'));
process.env.UPLOADS_DIR = temporary;
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args);
};
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, filename);
}

async function main() {
  const { NextResponse } = require('next/server');
  const auth = require('../lib/admin-auth.ts');
  const pages = require('../lib/promotion-catalog-pages.ts');
  const meta = require('../lib/promotion-catalog-metadata.ts');
  const pageRoutes = require('../app/api/admin/promotion-catalogs/pages/route.ts');
  const catalogRoutes = require('../app/api/admin/promotion-catalogs/route.ts');
  const catalogs = require('../lib/promotion-catalogs.ts');
  const publicPage = require('../app/promotions/catalog/[slug]/page.tsx');
  const landing = require('../app/promotions/catalog/page.tsx');
  const sitemap = require('../app/sitemap.ts');
  const permissions = require('../lib/admin-permissions.ts');
  function cookieFor(role, permissions = []) {
    const response = NextResponse.json({});
    auth.applyAdminSessionCookie(response, { username: 'catalog-test', sub: 'test:catalogs', role, permissions });
    return response.headers.get('set-cookie').split(';')[0];
  }
  const cookie = cookieFor('admin');
  function req(method, body, session = cookie) {
    return new Request('http://localhost/api/admin/promotion-catalogs/pages', { method, headers: { 'Content-Type': 'application/json', ...(session ? { cookie: session } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function invoke(handler, method, body, expected = 200, session = cookie) {
    const response = await handler(req(method, body, session));
    const payload = await response.json();
    assert.equal(response.status, expected, JSON.stringify(payload));
    return payload;
  }
  function textOf(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    return textOf(node.props?.children);
  }

  assert.equal(permissions.resourceForAdminPath('/api/admin/promotion-catalogs/pages'), 'promotions');
  await invoke(pageRoutes.GET, 'GET', null, 401, '');
  await invoke(pageRoutes.POST, 'POST', { title: 'Denied', slug: 'denied' }, 401, cookieFor('editor', ['promotions:read']));
  await meta.savePromotionCatalogSettings({ showArchive: true });
  const defaults = await pages.getPromotionCatalogPages();
  assert.deepEqual(defaults.map(p => p.id), ['f1', 'f3']);
  assert.equal(defaults[0].showArchive, true);
  await invoke(pageRoutes.POST, 'POST', { title: 'Duplicate', slug: 'f1' }, 400);
  await invoke(pageRoutes.POST, 'POST', { title: 'Unsafe', slug: '../other' }, 400);
  const created = await invoke(pageRoutes.POST, 'POST', { title: 'Сезонний каталог', slug: 'seasonal', description: 'Окремий вид пропозицій', showInList: false }, 201);
  const seasonal = created.page;
  await invoke(pageRoutes.PUT, 'PUT', { ...seasonal, title: 'Прихований каталог' });
  assert.equal((await pages.getPromotionCatalogPages()).find(p => p.id === seasonal.id).showInList, false);
  assert.ok(!textOf(await landing.default()).includes('Прихований каталог'));
  const direct = await publicPage.default({ params: Promise.resolve({ slug: 'seasonal' }) });
  assert.ok(textOf(direct).includes('Прихований каталог'));
  assert.equal((await publicPage.generateMetadata({ params: Promise.resolve({ slug: 'seasonal' }) })).robots.index, false);
  assert.ok(!(await sitemap.default()).some(item => item.url.endsWith('/seasonal')));

  await invoke(catalogRoutes.PUT, 'PUT', { settings: { landingTitle: 'Наші пропозиції' } });
  assert.ok(textOf(await landing.default()).includes('Наші пропозиції'));
  assert.equal((await landing.generateMetadata()).title, 'Наші пропозиції | Pchilka Market');
  assert.equal((await meta.getPromotionCatalogSettings()).showArchive, true);
  await meta.savePromotionCatalogSettings({ showArchive: false });
  assert.equal((await meta.getPromotionCatalogSettings()).landingTitle, 'Наші пропозиції');
  await invoke(pageRoutes.PUT, 'PUT', { ...defaults[1], showInList: false });
  await assert.rejects(landing.default(), error => error.digest === 'NEXT_REDIRECT;replace;/promotions/catalog/f1;307;');
  await invoke(pageRoutes.PUT, 'PUT', { ...defaults[0], showInList: false });
  assert.ok(textOf(await landing.default()).includes('Сторінок каталогів поки немає.'));
  await invoke(pageRoutes.PUT, 'PUT', defaults[0]);
  await invoke(pageRoutes.PUT, 'PUT', defaults[1]);
  console.log('PASS: one visible catalog redirects, multiple catalogs show selection, no visible catalogs show empty state; editable landing title persists in heading and metadata.');

  const catalogDir = path.join(temporary, 'promotions', 'catalogs');
  fs.mkdirSync(path.join(catalogDir, '2026', '10'), { recursive: true });
  const legacy = '2026/10/legacy.pdf';
  const f3 = '2026/10/f3.pdf';
  fs.writeFileSync(path.join(catalogDir, legacy), '%PDF-1.4 /Count 1');
  fs.writeFileSync(path.join(catalogDir, f3), '%PDF-1.4 /Count 1');
  await meta.savePromotionCatalogMetadata(f3, { title: 'PDF Ф3', pageId: 'f3', seoTitle: 'SEO Ф3' });
  assert.deepEqual((await catalogs.getPromotionCatalogs('f1')).map(c => c.name), ['legacy']);
  assert.deepEqual((await catalogs.getPromotionCatalogs('f3')).map(c => c.title), ['PDF Ф3']);
  await invoke(pageRoutes.DELETE, 'DELETE', { id: 'f1' }, 409);
  await invoke(pageRoutes.DELETE, 'DELETE', { id: 'f3' }, 409);
  await invoke(catalogRoutes.PUT, 'PUT', { id: legacy, metadata: { pageId: 'f3', title: 'Moved PDF' } });
  assert.equal((await catalogs.getPromotionCatalogs('f1')).length, 0);
  assert.equal((await catalogs.getPromotionCatalogs('f3')).length, 2);
  await invoke(catalogRoutes.PUT, 'PUT', { id: f3, metadata: { pageId: seasonal.id } });
  const preserved = (await meta.getPromotionCatalogMetadata())[f3];
  assert.equal(preserved.title, 'PDF Ф3');
  assert.equal(preserved.seoTitle, 'SEO Ф3');
  await invoke(catalogRoutes.PUT, 'PUT', { id: f3, metadata: { pageId: 'missing' } }, 400);
  await invoke(catalogRoutes.PUT, 'PUT', { pageId: 'f3', settings: { showArchive: true } });
  const changed = await pages.getPromotionCatalogPages();
  assert.equal(changed.find(p => p.id === 'f3').showArchive, true);
  assert.equal(changed.find(p => p.id === seasonal.id).showArchive, false);
  await invoke(pageRoutes.DELETE, 'DELETE', { id: 'f1' });
  const seoRepository = require('../lib/seo-rules-repository.ts');
  seoRepository.getSeoRulesFromDb = async () => ['f1', 'f3', 'seasonal'].map(slug => ({ path: '/promotions/catalog/' + slug, includeInSitemap: true, robots: 'index,follow', priority: 0.7, changeFrequency: 'weekly' }));
  const mapWithSeoRules = await sitemap.default();
  assert.ok(!mapWithSeoRules.some(item => item.url.endsWith('/f1') || item.url.endsWith('/seasonal')));
  assert.ok(mapWithSeoRules.some(item => item.url.endsWith('/f3')));
  await assert.rejects(publicPage.default({ params: Promise.resolve({ slug: 'f1' }) }), error => error.digest === 'NEXT_HTTP_ERROR_FALLBACK;404');
  await invoke(pageRoutes.DELETE, 'DELETE', { id: seasonal.id }, 409);
  await invoke(catalogRoutes.PUT, 'PUT', { id: f3, metadata: { pageId: 'f3' } });
  await invoke(pageRoutes.DELETE, 'DELETE', { id: seasonal.id });
  assert.ok(!fs.readFileSync(path.join(catalogDir, 'catalog-pages.json'), 'utf8').includes('seasonal'));
  const renderer = require('../lib/promotion-catalog-renderer.ts');
  const renderDir = path.join(temporary, 'promotions', 'catalog-renders', '2026', '10', 'legacy');
  fs.mkdirSync(renderDir, { recursive: true });
  fs.writeFileSync(path.join(renderDir, 'page-1.jpg'), 'jpeg fixture');
  fs.writeFileSync(path.join(renderDir, 'page-2.webp'), 'legacy webp fixture');
  fs.writeFileSync(path.join(renderDir, 'ignored.txt'), 'not a page');
  assert.deepEqual((await renderer.getPromotionCatalogPageImages(legacy)).map(url => url.split('/').at(-1)), ['page-1.jpg', 'page-2.webp']);
  console.log('PASS: JPEG render output and existing WebP pages are both supported.');
  console.log('PASS: authorization, legacy F1 migration, page CRUD, unique/safe URLs, PDF isolation and reassignment, per-page archives, deletion protection, hidden direct links, noindex and sitemap exclusion.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  const resolved = path.resolve(temporary);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('pchilka-catalog-check-'));
  fs.rmSync(resolved, { recursive: true, force: true });
});
