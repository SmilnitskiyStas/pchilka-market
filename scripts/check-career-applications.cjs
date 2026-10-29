/* Real routes/repositories and bot logic, with isolated in-memory DB and Telegram mocks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...args);
};
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
}).outputText;
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (m, file) => m._compile(compile(file), file);

let storedSettings = { enabled: true, botToken: '123456:abcdefghijklmnopqrstuvwxyz', vacancies: ['Касир'], cities: ['Київ'] };
const records = [], revalidated = [], telegram = [];
let session = { chatId: '12345678', step: 'vacancy', fullName: 'Кандидат Telegram', phone: '', city: 'Київ', storeLabel: 'Магазин', telegramUserId: '12345678', telegramUsername: 'candidate' };
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'next/cache') return { revalidatePath: (value) => revalidated.push(value) };
  if (name === '@/lib/career-telegram-sessions-repository') return {
    getCareerTelegramSession: async () => session,
    saveCareerTelegramSession: async (value) => { session = value; },
    deleteCareerTelegramSession: async () => { session = null; }
  };
  if (name === '@/lib/career-telegram-messages-repository') return {
    addCareerTelegramMessage: async () => {}, findLatestCareerTelegramRequestId: async () => null
  };
  return originalLoad.call(this, name, ...args);
};
global.fetch = async (url, options) => {
  assert(String(url).startsWith('https://api.telegram.org/'), 'Unexpected external request');
  telegram.push(JSON.parse(options.body));
  return { ok: true, json: async () => ({ ok: true }) };
};
global.__mysqlPool = { async query(sql, values = []) {
  if (sql.includes('site_settings')) {
    assert.equal(values[0], 'career_telegram_settings_v1');
    if (sql.includes('INSERT')) { storedSettings = JSON.parse(values[1]); return [{ affectedRows: 1 }]; }
    return [[{ setting_value: JSON.stringify(storedSettings) }]];
  }
  if (sql.includes('INSERT INTO incoming_requests')) {
    const names = ['request_type', 'full_name', 'company_name', 'contact_person', 'phone', 'email', 'city', 'vacancy', 'subject', 'target_store', 'message', 'metadata_json', 'source_page'];
    const record = { id: records.length + 1, status: 'new', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    names.forEach((name, i) => { record[name] = values[i]; }); records.push(record);
    return [{ insertId: record.id }];
  }
  if (sql.includes('FROM incoming_requests')) {
    if (sql.includes('COUNT(*)')) return [[{ total: records.length }]];
    return [sql.includes('WHERE id = ?') ? records.filter((row) => row.id === values[0]) : records];
  }
  throw new Error('Unexpected DB query; no live DB access allowed');
} };

function harness(file, props, fetcher, overrides = {}) {
  const slots = []; let cursor = 0, effects = [];
  const slot = () => slots[cursor++] ?? (slots[cursor - 1] = {});
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const hooks = {
    useState(initial) { const s = slot(); if (!('value' in s)) s.value = typeof initial === 'function' ? initial() : initial; return [s.value, (v) => { s.value = typeof v === 'function' ? v(s.value) : v; }]; },
    useRef(value) { const s = slot(); return s.ref ?? (s.ref = { current: value }); },
    useMemo(fn, deps) { const s = slot(); if (!same(s.deps, deps)) { s.value = fn(); s.deps = deps; } return s.value; },
    useEffect(fn, deps) { const s = slot(); if (!same(s.deps, deps)) { s.deps = deps; effects.push(fn); } }
  };
  const out = {};
  vm.runInNewContext(compile(path.join(root, file)), {
    exports: out, require: (name) => name === 'react' ? hooks : overrides[name] ?? require(name), fetch: fetcher,
    window: { location: { pathname: '/career' }, setInterval() {}, clearInterval() {} },
    document: { visibilityState: 'visible' }, Date, Set, Error, console, URLSearchParams
  });
  return () => { cursor = 0; effects = []; const tree = out.default(props); effects.forEach((fn) => fn()); return tree; };
}
function nodes(n, predicate) {
  if (Array.isArray(n)) return n.flatMap((child) => nodes(child, predicate));
  if (!n || typeof n !== 'object') return [];
  return [...(predicate(n) ? [n] : []), ...nodes(n.props?.children, predicate)];
}
function text(n) { if (n == null || typeof n === 'boolean') return ''; if (typeof n !== 'object') return String(n); if (Array.isArray(n)) return n.map(text).join(''); return text(n.props?.children); }
const flush = () => new Promise(setImmediate);

async function main() {
  const auth = require('../lib/admin-auth.ts');
  const { NextResponse } = require('next/server');
  function cookie(role, permissions) { const response = NextResponse.json({}); auth.applyAdminSessionCookie(response, { username: 'test', sub: 'test:career', role, permissions }); return response.headers.get('set-cookie').split(';')[0]; }
  const admin = cookie('admin', []), editor = cookie('editor', ['telegram:write']);
  const req = (method, body, session = admin) => new Request('http://localhost/api/admin/career-telegram', { method, headers: { 'Content-Type': 'application/json', cookie: session }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const settingsApi = require('../app/api/admin/career-telegram/route.ts');
  const requestsApi = require('../app/api/requests/route.ts');
  const messagesApi = require('../app/api/admin/messages/route.ts');
  const careerPage = require('../app/career/page.tsx');
  const { incomingRequestSourceLabel } = require('../lib/incoming-requests.ts');
  assert.equal((await settingsApi.PATCH(req('PATCH', { vacancies: ['Продавець', 'Касир', 'Касир'] }, editor))).status, 200);
  assert.deepEqual(storedSettings.vacancies, ['Продавець', 'Касир']);
  const limited = await (await settingsApi.GET(req('GET', null, editor))).json();
  assert(!JSON.stringify(limited).includes(storedSettings.botToken));
  assert.equal((await settingsApi.PATCH(req('PATCH', {}, editor))).status, 400);
  assert.equal((await settingsApi.PATCH(req('PATCH', { vacancies: [] }, cookie('editor', ['telegram:read'])))).status, 401);
  assert.equal((await settingsApi.PUT(req('PUT', { settings: { ...storedSettings, enabled: false, vacancies: ['STALE'] } }))).status, 200);
  assert.deepEqual(storedSettings.vacancies, ['Продавець', 'Касир']);
  let tree = await careerPage.default();
  assert.deepEqual(nodes(tree, (n) => n.props?.vacancies)[0].props.vacancies, storedSettings.vacancies);
  assert(!JSON.stringify(tree).includes(storedSettings.botToken));
  const application = { requestType: 'career_application', fullName: 'Кандидат із сайту', city: 'Київ', phone: '+380501112233', email: 'candidate@example.com', vacancy: 'Продавець', message: 'Хочу працювати у вашій команді', sourcePage: 'telegram://career-bot', metadata: { channel: 'telegram', telegramChatId: '999999', age: 25, resumeLink: 'https://example.com/resume', attachment: { fileName: 'resume.pdf', url: '/media/forms/resume.pdf' } } };
  const created = await requestsApi.POST(req('POST', application, ''));
  assert.equal(created.status, 200);
  const website = (await created.json()).request;
  assert.equal(website.sourcePage, '/career'); assert.equal(website.metadata.channel, 'website');
  assert.equal(website.metadata.telegramChatId, undefined); assert.equal(website.metadata.age, 25);
  assert.equal(website.metadata.attachment.url, application.metadata.attachment.url);
  assert.equal(incomingRequestSourceLabel(website), 'Сайт');
  assert.equal((await requestsApi.POST(req('POST', { ...application, vacancy: 'Закрита вакансія' }, ''))).status, 409);
  assert.equal((await requestsApi.POST(req('POST', { ...application, phone: '' }, ''))).status, 400);
  assert.equal((await requestsApi.POST(req('POST', { ...application, metadata: { age: 10 } }, ''))).status, 400);
  storedSettings.enabled = true;
  const bot = require('../lib/career-telegram-bot.ts');
  assert.equal((await bot.processCareerTelegramUpdate({ message: { chat: { id: 12345678 }, text: 'Закрита вакансія' } })).handled, 'vacancy-invalid');
  const keyboard = telegram.at(-1).reply_markup.keyboard.flat().map((button) => button.text);
  assert(keyboard.includes('Продавець') && keyboard.includes('Касир'));
  assert.equal((await bot.processCareerTelegramUpdate({ message: { chat: { id: 12345678 }, text: 'Касир' } })).handled, 'completed');
  const inbox = await (await messagesApi.GET(new Request('http://localhost/api/admin/messages', { headers: { cookie: admin } }))).json();
  assert.equal(inbox.requests.length, 2);
  assert.deepEqual(inbox.requests.map(incomingRequestSourceLabel), ['Сайт', 'Telegram']);
  const listing = harness('components/admin/admin-messages-manager.tsx', {}, async () => ({ ok: true, json: async () => inbox }));
  listing(); await flush(); tree = listing();
  assert(text(tree).includes('Сайт') && text(tree).includes('Telegram'));
  const detail = harness('components/admin/candidate-request-page.tsx', { requestId: website.id }, async () => ({ ok: true, json: async () => ({ ok: true, request: website }) }));
  detail(); await flush(); tree = detail(); assert(text(tree).includes('Джерело: Сайт'));
  await settingsApi.PATCH(req('PATCH', { vacancies: [] }, editor));
  tree = await careerPage.default(); assert(text(tree).includes('Наразі відкритих вакансій немає'));
  assert.equal((await requestsApi.POST(req('POST', application, ''))).status, 409);
  assert(revalidated.includes('/career'));

  let uploadFails = false, release, submits = 0;
  const form = harness('components/career-application-form.tsx', { vacancies: ['Касир'] }, async () => { submits++; await new Promise((resolve) => { release = resolve; }); return { ok: true, json: async () => ({ ok: true }) }; }, {
    '@/lib/analytics-events': { trackAnalyticsEvent() {} },
    '@/lib/request-attachment-client': { uploadRequestAttachment: async () => { if (uploadFails) throw new Error('Upload failed'); return {}; } }
  });
  tree = form();
  for (const [id, value] of Object.entries({ 'career-full-name': 'Кандидат', 'career-city': 'Київ', 'career-age': '25', 'career-phone': '+380501112233', 'career-email': 'candidate@example.com', 'career-vacancy': 'Касир', 'career-message': 'Хочу працювати у вашій команді' })) {
    nodes(tree, (n) => n.props?.id === id)[0].props.onChange({ target: { value } }); tree = form();
  }
  const onSubmit = nodes(tree, (n) => n.type === 'form')[0].props.onSubmit;
  const pending = onSubmit({ preventDefault() {} });
  await onSubmit({ preventDefault() {} }); assert.equal(submits, 1); release(); await pending;
  tree = form(); assert(text(tree).includes('Вашу заявку надіслано'));
  for (const [id, value] of Object.entries({ 'career-full-name': 'Кандидат', 'career-city': 'Київ', 'career-age': '25', 'career-phone': '+380501112233', 'career-email': 'candidate@example.com', 'career-vacancy': 'Касир', 'career-message': 'Хочу працювати у вашій команді' })) {
    nodes(tree, (n) => n.props?.id === id)[0].props.onChange({ target: { value } }); tree = form();
  }
  nodes(tree, (n) => n.props?.id === 'career-file')[0].props.onChange({ target: { files: [{ name: 'resume.pdf', size: 10 }] } });
  uploadFails = true; tree = form(); await nodes(tree, (n) => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  tree = form(); assert(text(tree).includes('Upload failed')); assert.equal(submits, 1);
  assert.equal(nodes(tree, (n) => n.props?.id === 'career-full-name')[0].props.value, 'Кандидат');
  assert.equal(nodes(tree, (n) => n.type === 'button' && n.props.type === 'submit')[0].props.disabled, false);
  console.log('PASS: one shared vacancy list for site and bot, vacancy-only permissions, system saves preserve list, empty/removed vacancies, website and bot applications in admin inbox with correct source, source spoof prevention, resume metadata, double-submit guard and upload-error recovery. No live DB writes or Telegram messages.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
