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
vm.runInNewContext(output, { exports: exportsObject, require: name => name === 'react' ? react : require(name), console, setTimeout, clearTimeout });
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
assert.ok(textOf(render([])).includes('Актуальних PDF-каталогів ще немає.'));
const large = { id: 'catalog', name: 'Large PDF', url: '/large.pdf', updatedAt: '2026-10-27T12:00:00Z', pageCount: 20 };
render([large]);
assert.ok(textOf(render([large])).includes('Швидкий режим'));
render([]);
const small = { ...large, name: 'Prepared PDF', pageCount: 2, pageImages: ['/page-1.webp', '/page-2.webp'] };
render([small]);
assert.ok(textOf(render([small])).includes('PDF-режим'));
render([large]);
assert.ok(textOf(render([large])).includes('Швидкий режим'));
render([]);
for (const slot of slots) if (slot.type === 'effect') slot.cleanup?.();
console.log('PASS: empty catalog effects; stable hooks through empty/populated transitions; PDF and prepared flipbook modes; switching catalogs with the same ID.');
