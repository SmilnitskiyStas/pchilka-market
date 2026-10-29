// Exercise real rendering and save validation with in-memory content; no database writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) { return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args); };
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);

async function main() {
  const { renderToStaticMarkup } = require('react-dom/server');
  const repo = require('../lib/blog-content-repository.ts');
  const auth = require('../lib/admin-auth.ts');
  const { normalizeContentEntry } = require('../lib/content-entries.ts');
  const entry = normalizeContentEntry({ id: 'rules', contentType: 'blog', pagePath: '/loyalty/rules', placement: 'before-content', title: 'Службова назва', slug: 'rules', body: '## Умови участі\nОпубліковані правила.', status: 'published' });
  let stored = { entries: [entry, { ...entry, id: 'draft', status: 'draft', body: 'Прихована чернетка' }], categories: [] };
  repo.getBlogContentFromDb = async () => stored;
  repo.saveBlogContentToDb = async payload => { stored = { entries: payload.entries.map(normalizeContentEntry), categories: payload.categories }; return stored; };
  auth.isAdminRequestAuthorized = () => true;
  const Page = require('../app/loyalty/rules/page.tsx').default;
  const originalRead = fs.promises.readFile;
  let legacyReads = 0, missing = false;
  fs.promises.readFile = async (filename, ...args) => {
    if (!String(filename).endsWith('program_rules.txt')) return originalRead(filename, ...args);
    legacyReads++;
    if (missing) throw Object.assign(new Error('Missing legacy rules'), { code: 'ENOENT' });
    return 'Старі правила\n1. Пункт із резервного файлу.';
  };
  try {
    const html = renderToStaticMarkup(await Page());
    assert.equal((html.match(/Опубліковані правила/g) || []).length, 1);
    assert.ok(html.includes('Умови участі'));
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    for (const text of ['Службова назва', 'Прихована чернетка', 'Старі правила', 'Файл правил', 'public/img']) assert.ok(!html.includes(text), text);
    assert.equal(legacyReads, 0);
    console.log('PASS: published rules render once; legacy source and draft are excluded.');
    for (const placement of ['before-content', 'after-content']) {
      stored.entries = [{ ...entry, placement }];
      const combined = renderToStaticMarkup(await Page());
      assert.ok(combined.indexOf('Опубліковані правила') > combined.indexOf('</h1>'));
      assert.ok(combined.indexOf('Опубліковані правила') < combined.lastIndexOf('</section>'));
      const articleClass = combined.match(/<article[^>]*class="([^"]*)"/)[1];
      assert.ok(!articleClass.includes('border') && !articleClass.includes('shadow'));
      assert.equal((combined.match(/Опубліковані правила/g) || []).length, 1);
    }
    console.log('PASS: both saved placements put rules under the heading inside one card.');
    const api = require('../app/api/admin/blog/content/route.ts');
    const response = await api.PUT(new Request('http://localhost/api/admin/blog/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: [entry], categories: [] }) }));
    assert.equal(response.status, 200);
    assert.equal(stored.entries[0].placement, 'before-content');
    console.log('PASS: saved before-content placement remains compatible.');
    stored.entries = [{ ...entry, status: 'draft' }];
    const fallback = renderToStaticMarkup(await Page());
    assert.ok(fallback.includes('Пункт із резервного файлу.'));
    assert.ok(!fallback.includes('Опубліковані правила'));
    console.log('PASS: legacy rules remain available when no published rules exist.');
    missing = true;
    const empty = renderToStaticMarkup(await Page());
    assert.ok(empty.includes('Правила програми лояльності поки що не опубліковані.'));
    assert.ok(!empty.includes('public/img') && !empty.includes('program_rules.txt'));
    console.log('PASS: missing content has a visitor-facing message without a file path.');
  } finally { fs.promises.readFile = originalRead; }
}
main().catch(error => { console.error(error); process.exit(1); });
