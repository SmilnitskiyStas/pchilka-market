// Runs post-render effects, including the empty-catalog case that SSR alone misses.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sourcePath = path.join(__dirname, '..', 'components', 'promotion-catalog-viewer.tsx');
const slots = [];
let cursor = 0;
let previousCount;
let effects = [];
function hook(type) {
  const index = cursor++;
  if (!slots[index]) slots[index] = { type };
  assert.equal(slots[index].type, type, 'Hook order changed');
  return slots[index];
}
const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
const react = {
  useState(initial) {
    const slot = hook('state');
    if (!('value' in slot)) slot.value = typeof initial === 'function' ? initial() : initial;
    return [slot.value, value => { slot.value = typeof value === 'function' ? value(slot.value) : value; }];
  },
  useRef(value) { const slot = hook('ref'); return slot.value ??= { current: value }; },
  useMemo(factory, deps) { const slot = hook('memo'); if (!same(slot.deps, deps)) { slot.value = factory(); slot.deps = deps; } return slot.value; },
  useEffect(callback, deps) {
    const slot = hook('effect');
    if (!same(slot.deps, deps)) { slot.deps = deps; effects.push(() => { slot.cleanup?.(); slot.cleanup = callback(); }); }
  }
};
const output = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exportsObject = {};
const BookComponent = () => null;
vm.runInNewContext(output, { exports: exportsObject, require: name => name === 'react' ? react : name === '@/components/catalog-flipbook' ? { default: BookComponent } : require(name), console, setTimeout, clearTimeout });
function render(catalogs) {
  cursor = 0; effects = [];
  const element = exportsObject.default({ catalogs, showArchive: true });
  if (previousCount !== undefined) assert.equal(cursor, previousCount, 'Hook count changed between empty and populated catalogs');
  previousCount = cursor;
  for (const effect of effects) effect();
  return element;
}
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.props?.children);
}
function findBook(node) {
  if (node?.type === BookComponent) return node;
  if (Array.isArray(node)) return node.map(findBook).find(Boolean);
  return node?.props ? findBook(node.props.children) : undefined;
}
function findTag(node, tag) {
  if (node?.type === tag) return node;
  if (Array.isArray(node)) return node.map(child => findTag(child, tag)).find(Boolean);
  return node?.props ? findTag(node.props.children, tag) : undefined;
}
assert.ok(textOf(render([])).includes('Актуальних PDF-каталогів ще немає.'));
const large = { id: 'catalog', name: 'Large PDF', url: '/large.pdf', updatedAt: '2026-10-27T12:00:00Z', pageCount: 20, pageImages: Array.from({length: 20}, (_, index) => `/large-page-${index + 1}.jpg`) };
render([large]);
assert.deepEqual(findBook(render([large])).props.images, large.pageImages);
assert.equal(findTag(render([large]), 'iframe'), undefined);
render([]);
const small = { ...large, name: 'Prepared PDF', pageCount: 2, pageImages: ['/page-1.webp', '/page-2.webp'] };
render([small]);
assert.deepEqual(findBook(render([small])).props.images, small.pageImages);
render([large]);
assert.deepEqual(findBook(render([large])).props.images, large.pageImages);
render([]);
for (const slot of slots) if (slot.type === 'effect') slot.cleanup?.();
console.log('PASS: empty catalog effects; stable hooks through empty/populated transitions; small and large catalogs use book mode only; switching catalogs with the same ID.');

const spreadModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'lib', 'catalog-spread.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: spreadModule });
const spread = (index, total, portrait) => JSON.parse(JSON.stringify(spreadModule.getCatalogSpread(index, total, portrait)));
assert.deepEqual(spread(0, 9, false), { first: 1, last: 1 });
assert.deepEqual(spread(1, 9, false), { first: 2, last: 3 });
assert.deepEqual(spread(7, 9, false), { first: 8, last: 9 });
assert.deepEqual(spread(8, 9, false), { first: 8, last: 9 });
assert.deepEqual(spread(9, 10, false), { first: 10, last: 10 });
assert.deepEqual(spread(1, 9, true), { first: 2, last: 2 });
assert.deepEqual(spread(8, 9, true), { first: 9, last: 9 });
console.log('PASS: separate cover, paired spreads, odd/even final pages and single-page mobile navigation.');
const sourcePages = Array.from({ length: 9 }, (_, index) => ({ src: `page-${index + 1}.jpg`, width: index === 0 || index === 8 ? 1199 : 2398, height: 1772 }));
const model = spreadModule.buildCatalogLeaves(sourcePages);
assert.equal(model.leaves.length, 16);
assert.equal(model.leaves[0].part, 'full');
assert.equal(model.leaves[1].part, 'left');
assert.equal(model.leaves[2].part, 'right');
assert.equal(model.leaves[1].pdfPage, 2);
assert.equal(model.leaves[2].pdfPage, 2);
assert.equal(model.leaves[15].pdfPage, 9);
assert.equal(model.leaves[15].part, 'full');
assert.equal(spreadModule.buildCatalogLeaves(sourcePages.map(page => ({ ...page, width: 1199 }))).leaves.length, 9);
console.log('PASS: already paired PDF spreads become separate book leaves, preserve covers and map back to their source PDF page.');
