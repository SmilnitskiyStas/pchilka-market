/* Real store-selection routes with temporary files and mocked DB; client state checks without live writes. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('node:assert/strict');
const Module = require('module');
const ts = require('typescript');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pchilka-pizza-check-'));
process.env.UPLOADS_DIR = temporary;
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) { return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...args); };
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true };
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions }).outputText, filename);
const readFile = fs.promises.readFile;
fs.promises.readFile = async (file, ...args) => String(file).replace(/\\/g, '/').endsWith('/pizza_and_coffee/pizza_store.txt') ? 'Магазини з піцою\nм. Київ\nвул. Перемоги, 1\nм. Бровари\nвул. Стара, 99\n' : readFile.call(fs.promises, file, ...args);

function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join(' ');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
const button = (tree, label) => nodes(tree, (node) => node.type === 'button' && text(node).trim() === label)[0];
const tick = () => new Promise((done) => setImmediate(done));

function client(filename, fetch) {
  const slots = []; let cursor = 0, effects = [];
  const hook = () => slots[cursor++] ?? (slots[cursor - 1] = {});
  const react = {
    useState(initial) { const slot = hook(); if (!('value' in slot)) slot.value = typeof initial === 'function' ? initial() : initial; return [slot.value, (value) => { slot.value = typeof value === 'function' ? value(slot.value) : value; }]; },
    useEffect(callback, deps) { const slot = hook(); if (!slot.deps || !deps || deps.some((value, i) => !Object.is(value, slot.deps[i]))) { slot.deps = deps; effects.push(callback); } }
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), { compilerOptions }).outputText, {
    exports, fetch, require: (name) => name === 'react' ? react : name.startsWith('@/components/admin/') ? function Child() {} : require(name)
  });
  return () => { cursor = 0; effects = []; const tree = exports.default(); effects.forEach((effect) => effect()); return tree; };
}

async function main() {
  require('next/cache').revalidatePath = () => {};
  const storeRepo = require('../lib/stores-repository.ts');
  let rows = [
    { id: '1', name: 'Перший', city: 'Київ', addressLine: 'Перемоги, 1', storeCode: '01', isActive: true },
    { id: '2', name: 'Другий', city: 'Київ', addressLine: 'Друга, 2', storeCode: '02', isActive: true },
    { id: '3', name: 'Закритий', city: 'Київ', addressLine: 'Закрита, 3', storeCode: '03', isActive: false },
    { id: '4', name: 'Без адреси', city: 'Київ', addressLine: '', storeCode: '04', isActive: true }
  ];
  storeRepo.listStoresFromDb = async () => rows;
  const settings = require('../lib/own-brand-pizza-stores.ts');
  const route = require('../app/api/admin/own-brand/pizza-stores/route.ts');
  const auth = require('../lib/admin-auth.ts');
  const { NextResponse } = require('next/server');
  function cookie(role, permissions = []) { const response = NextResponse.json({}); auth.applyAdminSessionCookie(response, { username: 'pizza-test', sub: 'test:pizza', role, permissions }); return response.headers.get('set-cookie').split(';')[0]; }
  const admin = cookie('admin');
  function req(method, body, session = admin) { return new Request('http://localhost/api/admin/own-brand/pizza-stores', { method, headers: { 'Content-Type': 'application/json', ...(session ? { cookie: session } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); }
  assert.equal(require('../lib/admin-permissions.ts').resourceForAdminPath('/api/admin/own-brand/pizza-stores'), 'own_brand');
  assert.equal((await route.GET(req('GET', undefined, ''))).status, 401);
  let response = await route.GET(req('GET', undefined, cookie('editor', ['own_brand:read'])));
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.deepEqual(payload.stores.map((store) => store.id), ['1', '2']);
  assert.deepEqual(payload.storeIds, ['1']); assert.equal(payload.legacyUnmatchedCount, 1);
  assert.equal(await settings.readPizzaStoreIds(), null);
  assert.equal((await settings.getPublicPizzaStores()).groups.length, 2, 'Legacy display remains until the first explicit save');
  assert.equal((await route.PUT(req('PUT', { storeIds: ['2'] }, cookie('editor', ['own_brand:read'])))).status, 401);
  for (const value of [{}, null, { storeIds: [1] }, { storeIds: ['../escape'] }, { storeIds: ['999'] }, { storeIds: ['3'] }, { storeIds: ['4'] }]) assert.equal((await route.PUT(req('PUT', value))).status, 400);
  assert.equal(await settings.readPizzaStoreIds(), null, 'Invalid submissions cannot change published selection');
  response = await route.PUT(req('PUT', { storeIds: ['2', '1', '2'] }, cookie('editor', ['own_brand:write'])));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).storeIds, ['2', '1']);
  assert.deepEqual((await settings.getPublicPizzaStores()).groups, [{ city: 'Київ', addresses: ['Перемоги, 1', 'Друга, 2'] }]);
  rows[1].isActive = false;
  assert.deepEqual((await settings.getPublicPizzaStores()).groups[0].addresses, ['Перемоги, 1']);
  payload = await (await route.GET(req('GET'))).json(); assert.equal(payload.unavailableSelectedCount, 1); assert.deepEqual(payload.storeIds, ['1']);
  assert.equal((await route.PUT(req('PUT', { storeIds: [] }))).status, 200);
  assert.deepEqual((await settings.getPublicPizzaStores()).groups, [], 'Saving no stores must not restore legacy addresses');
  const file = path.join(temporary, 'own-brand', 'pizza-stores.json');
  fs.writeFileSync(file, '{"storeIds":"invalid"}'); assert.equal((await route.GET(req('GET'))).status, 500);
  rows[1].isActive = true;
  await Promise.all([settings.savePizzaStoreIds(['1']), settings.savePizzaStoreIds(['2'])]);
  assert.deepEqual(await settings.readPizzaStoreIds(), ['2']);
  require('../lib/own-brand-pizzas.ts').listOwnBrandPizzas = async () => [];
  const page = require('../app/own-brand/[slug]/page.tsx');
  const html = require('react-dom/server').renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: 'pizza-coffeehouse' }) }));
  assert.ok(html.includes('Друга, 2') && !html.includes('Перемоги, 1') && !html.includes('Стара, 99'));

  let pizzaWrites = 0;
  const pizzas = [{ id: 'p1', name: 'Маргарита', weight: '400 г', isActive: true }, { id: 'p2', name: 'Сирна', weight: '500 г', isActive: false }];
  const render = client('components/admin/admin-own-brand-manager.tsx', async (url, options) => { if (options?.method === 'PUT') pizzaWrites++; return { ok: true, json: async () => ({ ok: true, pizzas }) }; });
  render(); await tick(); let tree = render();
  assert.equal(nodes(tree, (node) => node.type === 'article').length, 2);
  assert.equal(nodes(tree, (node) => node.type === 'textarea').length, 0, 'Existing pizza cards start closed');
  const toggles = () => nodes(tree, (node) => node.type === 'button' && node.props['aria-expanded'] !== undefined);
  toggles()[0].props.onClick(); tree = render();
  assert.equal(nodes(tree, (node) => node.type === 'textarea').length, 1);
  nodes(tree, (node) => node.type === 'input')[0].props.onChange({ target: { value: 'Змінена піца' } }); tree = render();
  button(tree, 'Згорнути всі піци').props.onClick(); tree = render(); assert.equal(nodes(tree, (node) => node.type === 'textarea').length, 0);
  toggles()[0].props.onClick(); tree = render(); assert.equal(nodes(tree, (node) => node.type === 'input')[0].props.value, 'Змінена піца');
  button(tree, 'Згорнути всі піци').props.onClick(); tree = render();
  button(tree, 'Додати піцу').props.onClick(); tree = render();
  assert.equal(nodes(tree, (node) => node.type === 'article').length, 3);
  assert.equal(nodes(tree, (node) => node.type === 'textarea').length, 1, 'Only the new pizza opens automatically');
  button(tree, 'Зберегти зміни').props.onClick(); await tick(); tree = render(); assert.equal(pizzaWrites, 0, 'Unnamed draft must be opened for correction without overwriting pizzas');

  const submissions = [];
  const renderStores = client('components/admin/own-brand-pizza-stores-manager.tsx', async (url, options) => {
    const storeIds = options?.method === 'PUT' ? JSON.parse(options.body).storeIds : ['1'];
    if (options?.method === 'PUT') submissions.push(storeIds);
    return { ok: true, json: async () => ({ ok: true, stores: rows.slice(0, 2), storeIds }) };
  });
  renderStores(); await tick(); tree = renderStores();
  assert.equal(nodes(tree, (node) => node.type === 'input' && node.props.type === 'checkbox').length, 2);
  nodes(tree, (node) => node.type === 'input' && node.props.type === 'search')[0].props.onChange({ target: { value: 'друга' } }); tree = renderStores();
  const choices = nodes(tree, (node) => node.type === 'input' && node.props.type === 'checkbox'); assert.equal(choices.length, 1);
  choices[0].props.onChange({ target: { checked: true } }); tree = renderStores();
  button(tree, 'Зберегти магазини').props.onClick(); await tick(); tree = renderStores(); assert.deepEqual(submissions[0], ['1', '2'], 'Filtering must not discard already selected stores');
  button(tree, 'Зняти всі позначки').props.onClick(); tree = renderStores(); button(tree, 'Зберегти магазини').props.onClick(); await tick(); assert.deepEqual(submissions[1], []);
  const failed = client('components/admin/own-brand-pizza-stores-manager.tsx', async () => { throw new Error('Offline'); });
  failed(); await tick(); assert.equal(button(failed(), 'Зберегти магазини').props.disabled, true, 'A failed load cannot publish an empty selection');
  console.log('PASS: collapsed cards, retained edits, new draft expansion; store search/selection; own-brand permissions; active-store validation; exact legacy matching; empty selection; atomic settings; selected-only public rendering; inactive stores hidden; no live data writes.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  fs.promises.readFile = readFile;
  const resolved = path.resolve(temporary);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('pchilka-pizza-check-'));
  fs.rmSync(resolved, { recursive: true, force: true });
});
