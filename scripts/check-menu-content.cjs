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
  const storyPage = require('../app/about/why-pchilka-not-bdzhilka/page.tsx');
  const { renderToStaticMarkup } = require('react-dom/server');
  const story = { ...article, id:'story', pagePath:'/about/why-pchilka-not-bdzhilka', title:'Історія бренду', body:'## Наша історія\n**Опублікований текст**', status:'published' };
  stored.entries = [story, { ...story, id:'secret', slug:'secret', title:'Прихована чернетка', status:'draft' }];
  const originalRead = fs.promises.readFile;
  fs.promises.readFile = async (filename, ...args) => String(filename).endsWith('chomu-pchilka-ne-bdzhilka.txt') ? 'Стара історія\nСтарий текст' : originalRead(filename, ...args);
  try {
    const html = renderToStaticMarkup(await storyPage.default());
    assert.ok(html.includes('Історія бренду'));
    assert.ok(html.includes('<strong class="font-semibold text-slate-900">Опублікований текст</strong>'));
    assert.ok(!html.includes('Стара історія') && !html.includes('Прихована чернетка') && !html.includes('public/info'));
    assert.equal((html.match(/id="article-program"/g) || []).length, 1);
    stored.entries = [{ ...story, status:'draft' }];
    const fallbackHtml = renderToStaticMarkup(await storyPage.default());
    assert.ok(fallbackHtml.includes('Стара історія') && !fallbackHtml.includes('Історія бренду'));
    fs.promises.readFile = async (filename, ...args) => {
      if (String(filename).endsWith('chomu-pchilka-ne-bdzhilka.txt')) throw new Error('Missing legacy file');
      return originalRead(filename, ...args);
    };
    const emptyHtml = renderToStaticMarkup(await storyPage.default());
    assert.ok(emptyHtml.includes('Чому Пчілка не Бджілка'));
    assert.ok(!emptyHtml.includes('public/info') && !emptyHtml.includes('не знайдено'));
  } finally { fs.promises.readFile = originalRead; }
  // Text-only page content is saved through the real authenticated API and rendered
  // before each real cooperation form, without changing a database or submitting it.
  const { formContentPages } = require('../lib/menu-content.ts');
  const offerProductRepo = require('../lib/offer-product-repository.ts');
  const { defaultOfferProductSettings } = require('../lib/offer-product-settings.ts');
  offerProductRepo.getOfferProductSettings = async () => defaultOfferProductSettings;
  for (const pagePath of formContentPages) {
    const text = { ...article, id:'form-intro', pagePath, placement:'before-form', excerpt:'', coverImage:'', title:'Умови співпраці', body:'**Текст над формою**' };
    const hidden = { ...text, id:'hidden', slug:'hidden', title:'Неопублікований текст', status:'draft' };
    const footer = { ...text, id:'footer', slug:'footer', placement:'after-content', title:'Текст наприкінці' };
    assert.equal((await api.PUT(request('PUT', { entries:[text, hidden, footer], categories:[] }))).status, 200);
    assert.equal(stored.entries[0].placement, 'before-form');
    const html = renderToStaticMarkup(await require(`../app${pagePath}/page.tsx`).default());
    assert.ok(html.indexOf('id="article-program"') >= 0, pagePath);
    assert.ok(html.indexOf('id="article-program"') < html.indexOf('<form'), `Content must precede form: ${pagePath}`);
    assert.ok(html.includes('Текст над формою') && !html.includes('Неопублікований текст') && !html.includes('Текст наприкінці'), pagePath);
    assert.ok(!html.includes('src=""'), 'No empty cover image');
    assert.equal((html.match(/id="article-program"/g) || []).length, 1);
    assert.equal((await publicRepo.listPublishedEntriesByType('blog')).length, 0);
  }
  const text = { ...article, pagePath:'/cooperation/rental', placement:'before-form', coverImage:'', excerpt:'' };
  assert.equal((await api.PUT(request('PUT', { entries:[{...text, pagePath:undefined}], categories:[] }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { entries:[{...text, pagePath:'/loyalty/about'}], categories:[] }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { entries:[{...text, placement:'unknown'}], categories:[] }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { entries:[{...text, body:''}], categories:[] }))).status, 400);
  assert.equal((await api.PUT(request('PUT', { entries:[{...text, pagePath:'/loyalty/about', placement:'before-content'}], categories:[] }))).status, 200);
  assert.equal((await (await publicApi.GET()).json()).entries[0].placement, 'before-content');
  assert.equal(normalizeContentEntry({}).placement, 'after-content', 'Existing entries retain their old placement');
  // Exercise the actual editor event handlers with a small hook-state harness.
  // External persistence still uses the real API above and the in-memory repository.
  const React = require('react');
  const client = require('../lib/blog-content-client.ts');
  const Editor = require('../components/admin/admin-content-manager.tsx').default;
  const originals = Object.fromEntries(['useState','useEffect','useMemo','useRef'].map(key => [key, React[key]]));
  const originalSave = client.saveBlogContentPayload;
  const state = [];
  let cursor = 0;
  React.useState = initial => {
    const index = cursor++;
    // The editor's only initially true state is the initial loading indicator.
    if (!(index in state)) state[index] = initial === true ? false : initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  };
  React.useEffect = () => {};
  React.useMemo = callback => callback();
  React.useRef = () => ({ current:null });
  const editor = () => { cursor = 0; return Editor(); };
  const elements = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(elements) : [node, ...elements(node.props?.children)];
  const field = id => elements(editor()).find(node => node.props?.id === id);
  const change = (id, value) => field(id).props.onChange({target:{value}});
  try {
    assert.ok(field('content-destination') && !field('content-type'));
    change('content-destination', 'page:/cooperation/rental');
    assert.equal(field('content-placement').props.value, 'before-form');
    change('content-title', 'Умови оренди');
    change('content-body', 'Текст, введений адміністратором');
    change('content-status', 'published');
    client.saveBlogContentPayload = async () => { throw new Error('Test save failure'); };
    await elements(editor()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(field('content-body').props.value, 'Текст, введений адміністратором');
    assert.equal(field('content-destination').props.value, 'page:/cooperation/rental');
    client.saveBlogContentPayload = async payload => {
      const response = await api.PUT(request('PUT', payload));
      assert.equal(response.status, 200);
      return response.json();
    };
    await elements(editor()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(stored.entries[0].pagePath, '/cooperation/rental');
    assert.equal(stored.entries[0].placement, 'before-form');
    assert.equal(stored.entries[0].coverImage, '');
    assert.equal(field('content-body').props.value, '');
    assert.equal(field('content-destination').props.value, 'article:blog');
    change('content-destination', 'article:news');
    assert.equal(field('content-destination').props.value, 'article:news');
    assert.ok(!field('content-placement'));
  } finally {
    Object.assign(React, originals);
    client.saveBlogContentPayload = originalSave;
  }
  console.log('PASS: editor uses one destination, defaults rental text above the form, preserves input after save failure, saves text-only page content through the API and resets only after success.');
  console.log('PASS: text-only content saves and renders before all five cooperation forms; drafts, other placements and other pages are excluded; invalid placements and incomplete blog articles are rejected; legacy placement is preserved.');
  console.log('PASS: story page renders published Admin articles in main content, preserves Markdown, excludes drafts and legacy notices, and retains legacy file fallback.');
  console.log('PASS: assignment round trip; drafts and deleted articles hide informational pages; publication shows them; functional pages remain; empty groups disappear; public API excludes drafts; legacy blog/news isolation; assignment and duplicate validation.');
}
main().catch(error => { console.error(error); process.exitCode=1; });
