/* Real API/auth handlers with an in-memory content repository; no live database writes. */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
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
  const repo = require('../lib/blog-content-repository.ts');
  const { normalizeContentEntry } = require('../lib/content-entries.ts');
  const { entryPagePath, filterContentMenu } = require('../lib/menu-content.ts');
  const { headerMenu } = require('../content/menu.ts');
  let stored = { entries: [], categories: [] };
  repo.getBlogContentFromDb = async () => stored;
  repo.saveBlogContentToDb = async payload => { stored = { ...payload, entries: payload.entries.map(normalizeContentEntry) }; return stored; };
  const api = require('../app/api/admin/blog/content/route.ts');
  const publicApi = require('../app/api/site/content/route.ts');
  const cookieResponse = NextResponse.json({});
  auth.applyAdminSessionCookie(cookieResponse, { username: 'content-test', sub: 'test:content', role: 'admin', permissions: [] });
  const cookie = cookieResponse.headers.get('set-cookie').split(';')[0];
  const request = (method, body, authorized = true) => new Request('http://localhost/api/admin/blog/content', {
    method, headers: { 'Content-Type': 'application/json', ...(authorized ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {})
  });
  const article = normalizeContentEntry({ id: 'assigned', contentType: 'blog', pagePath: '/loyalty/about', title: 'Програма', slug: 'program', excerpt: 'Опис', body: '## Умови\nОсновний текст', coverImage: '/logo.png', status: 'draft' });
  const flatten = menu => menu.flatMap(item => [item.href, ...flatten(item.children || [])]);
  assert.equal(entryPagePath(normalizeContentEntry({contentType:'news'})), '/news');
  assert.equal((await api.PUT(request('PUT', { entries:[article], categories:[] }, false))).status, 401);
  assert.equal((await api.PUT(request('PUT', { entries:[article], categories:[] }))).status, 200);
  let published = await (await publicApi.GET()).json();
  assert.deepEqual(published.entries, []);
  assert.ok(!flatten(filterContentMenu(headerMenu, new Set(published.populatedPaths))).includes('/loyalty/about'));
  article.status = 'published';
  assert.equal((await api.PUT(request('PUT', { entries:[article], categories:[] }))).status, 200);
  published = await (await publicApi.GET()).json();
  assert.equal(published.entries[0].pagePath, '/loyalty/about');
  let menu = filterContentMenu(headerMenu, new Set(published.populatedPaths));
  assert.ok(flatten(menu).includes('/loyalty/about'));
  assert.ok(flatten(menu).includes('/promotions/catalog'));
  assert.ok(flatten(menu).includes('/about/stores'));
  assert.ok(!flatten(menu).includes('/own-brand/bakery'));
  const parent = menu.find(item => item.label === 'Програма лояльності');
  assert.ok(parent.children.some(item => item.href === '/loyalty/about'));
  const legacy = normalizeContentEntry({ ...article, id:'legacy', pagePath: undefined, slug:'legacy', contentType:'news' });
  const draft = normalizeContentEntry({ ...article, id:'draft', slug:'draft', status:'draft' });
  stored.entries = [article, legacy, draft];
  const publicRead = await (await api.GET(request('GET', null, false))).json();
  assert.equal(publicRead.entries.length, 2);
  const adminRead = await (await api.GET(request('GET'))).json();
  assert.equal(adminRead.entries.length, 3);
  const publicRepo = require('../lib/public-content-repository.ts');
  assert.equal((await publicRepo.listPublishedEntriesByType('blog')).length, 0);
  assert.equal((await publicRepo.listPublishedEntriesByType('news')).length, 1);
  const duplicate = { ...article, id:'duplicate', contentType:'news' };
  assert.equal((await api.PUT(request('PUT', { entries:[article,duplicate], categories:[] }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { entries:[{...article,pagePath:'/admin'}], categories:[] }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { entries:[], categories:[] }))).status, 200);
  published = await (await publicApi.GET()).json();
  assert.ok(!flatten(filterContentMenu(headerMenu,new Set(published.populatedPaths))).includes('/loyalty/about'));
  assert.deepEqual(filterContentMenu([{label:'Empty',href:'#',children:[{label:'Empty child',href:'/loyalty/about'}]}],new Set()),[]);
  console.log('PASS: assignment round trip; drafts and deleted articles hide informational pages; publication shows them; functional pages remain; empty groups disappear; public API excludes drafts; legacy blog/news isolation; assignment and duplicate validation.');
}
main().catch(error => { console.error(error); process.exitCode=1; });
