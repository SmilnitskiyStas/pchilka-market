const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, require: name => mocks[name] ?? require(name), console, Date });
  return exports;
}
function nodes(n, type) {
  if (Array.isArray(n)) return n.flatMap(x => nodes(x, type));
  if (!n || typeof n !== 'object') return [];
  return [...(n.type === type ? [n] : []), ...nodes(n.props?.children, type)];
}
async function main() {
  for (const [file, key] of [['blog','blogPosts'],['news','newsPosts'],['charity','charityPosts']]) assert.equal(load(`content/${file}.ts`)[key].length, 0);
  const make = (id, type, status, pagePath = '') => ({ id, title: id, slug: id, contentType: type, status, pagePath, updatedAt: '2026-10-28T12:00:00Z', excerpt: 'Text', categoryIds: [] });
  let payload = { entries: [make('real-news','news','published'), make('draft','news','draft'), make('other','blog','published'), make('page','news','published','/news')], categories: [] };
  let fail = false;
  const List = load('components/published-posts-list.tsx', {
    '@/lib/blog-content-repository': { getBlogContentFromDb: async () => { if (fail) throw Error('offline'); return payload; } },
    '@/lib/blog-categories': { categorySupportsContentType: () => true },
    'next/link': { default: 'a' }
  }).default;
  let tree = await List({ contentType: 'news', hrefPrefix: '/news' });
  assert.equal(nodes(tree, 'article').length, 1);
  assert.equal(nodes(tree, 'h2')[0].props.children, 'real-news');
  assert.equal(nodes(tree, 'a')[0].props.href, '/news/real-news');
  assert.ok(!JSON.stringify(tree).includes('З адмінки'));
  payload.entries = [];
  tree = await List({ contentType: 'news', hrefPrefix: '/news' });
  assert.equal(tree.props.children, 'Публікацій поки немає.');
  fail = true;
  tree = await List({ contentType: 'news', hrefPrefix: '/news' });
  assert.equal(tree.props.role, 'status');
  console.log('PASS: no demo publications; published entries appear in the main grid; drafts, page text and other types excluded; empty and unavailable states.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
