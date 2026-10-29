const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

async function load(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = await fs.readFile(filename, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(require, exports) { ${js}\n})`, { process, Buffer, AbortSignal, fetch, console, URL, setTimeout })(name => name in mocks ? mocks[name] : require(name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name), exports);
  return exports;
}
test('credentials round-trip privately, preserve unrelated env, blank password keeps existing secret', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pchilka-engineering-'));
  const original = process.env.ENGINEERING_ENV_FILE;
  process.env.ENGINEERING_ENV_FILE = path.join(directory, '.env');
  try {
    await fs.writeFile(process.env.ENGINEERING_ENV_FILE, 'OTHER_SETTING=keep\n');
    const settings = await load('lib/engineering-settings.ts');
    const password = 'spaces # quotes " backslash \\ unicode ї newline\n=still-secret';
    await settings.saveEngineeringSettings({ mailPassword: password, mailUser: 'engineer@legion2015.com', mailPort: 993 });
    assert.equal((await settings.readEngineeringSettings()).mailPassword, password);
    await settings.saveEngineeringSettings({ mailPassword: '', mailHost: 'mail.example.org' });
    const saved = await settings.readEngineeringSettings();
    assert.equal(saved.mailPassword, password);
    assert.ok(saved.runSecret.length >= 32);
    const visible = settings.publicEngineeringSettings(saved);
    for (const key of ['mailPassword', 'botToken', 'webhookSecret', 'runSecret']) assert.equal(key in visible, false);
    assert.ok((await fs.readFile(process.env.ENGINEERING_ENV_FILE, 'utf8')).startsWith('OTHER_SETTING=keep\n'));
    await assert.rejects(settings.saveEngineeringSettings({ publicBaseUrl: 'http://unsafe.example.org' }));
    await assert.rejects(settings.saveEngineeringSettings({ enabled: true }));
  } finally {
    if (original === undefined) delete process.env.ENGINEERING_ENV_FILE; else process.env.ENGINEERING_ENV_FILE = original;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test('MIME subject and quoted-printable body decode; tracking number is extracted', async () => {
  const { simpleParser } = require('mailparser');
  const mail = await simpleParser(Buffer.from('From: Help Desk <legion_admin@legion2015.com>\r\nSubject: =?UTF-8?B?0KLQtdC80LA=?= [ABC-123-XYZ]\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nTracking ID: ABC-123-XYZ\r\n=D0=97=D0=B0=D0=BF=D0=B8=D1=82'));
  assert.equal(mail.subject, 'Тема [ABC-123-XYZ]');
  assert.ok(mail.text.includes('Запит'));
  const module = await load('lib/engineering-mail.ts', { '@/lib/db': {}, '@/lib/engineering-repository': {}, '@/lib/engineering-telegram': {}, '@/lib/engineering-settings': {} });
  assert.equal(module.extractEngineeringTrackingId(mail.subject, mail.text), 'ABC-123-XYZ');
  assert.equal(module.extractEngineeringTrackingId('Без номера', 'Ідентифікатор відстеження: TST-567'), 'TST-567');
  assert.equal(module.extractEngineeringTrackingId('Звичайний лист', 'Немає номера'), '');
});
test('claim locks task; second claim and foreign completion roll back; assigned user can finish', async () => {
  const task = { id: 1, status: 'new', assignee_id: null };
  const log = [];
  let rollbacks = 0;
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() { rollbacks++; }, release() {},
    async query(sql, args) {
      log.push(sql);
      if (sql.startsWith('SELECT * FROM engineering_users')) return [[{ telegram_id: args[0], name: 'Працівник' }]];
      if (sql.startsWith('SELECT * FROM engineering_tasks')) return [[{ ...task }]];
      if (sql.includes("SET status = 'in_progress'")) { task.status = 'in_progress'; task.assignee_id = args[0]; }
      if (sql.includes("SET status = 'done'")) task.status = 'done';
      return [{}];
    }
  };
  const repository = await load('lib/engineering-repository.ts', { '@/lib/db': { getDbPool: () => ({ getConnection: async () => connection }) } });
  await repository.changeEngineeringTask(1, '101', 'claim');
  assert.equal(task.assignee_id, '101');
  assert.ok(log.some(sql => sql.includes('engineering_tasks') && sql.includes('FOR UPDATE')));
  await assert.rejects(repository.changeEngineeringTask(1, '202', 'claim'));
  await assert.rejects(repository.changeEngineeringTask(1, '202', 'done'));
  assert.equal(rollbacks, 2);
  await repository.changeEngineeringTask(1, '101', 'done');
  assert.equal(task.status, 'done');
  assert.equal(log.filter(sql => sql.startsWith('INSERT INTO engineering_events')).length, 2);
});
test('removed user cannot read task list or claim through Telegram', async () => {
  const calls = [];
  let taskRead = false;
  const originalFetch = global.fetch;
  global.fetch = async (url, request) => { calls.push({ url, body: JSON.parse(request.body) }); return { ok: true, json: async () => ({ ok: true, result: {} }) }; };
  try {
    const bot = await load('lib/engineering-telegram.ts', {
      '@/lib/engineering-invitations': {},
      '@/lib/db': {},
      '@/lib/engineering-settings': { readEngineeringSettings: async () => ({ enabled: true, botToken: 'mock-token' }) },
      '@/lib/engineering-repository': { engineeringUsers: async () => [{ telegram_id: '101', active: 0 }], engineeringTasks: async () => { taskRead = true; return []; } }
    });
    await bot.processEngineeringUpdate({ callback_query: { id: 'callback', from: { id: 101 }, data: 'eng:claim:1', message: { chat: { id: 101, type: 'private' } } } });
    assert.equal(taskRead, false);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith('/answerCallbackQuery'));
    assert.match(calls[0].body.text, /Доступ відсутній/);
  } finally { global.fetch = originalFetch; }
});
test('durable outbox retries failed recipient, continues others, and sends even while IMAP is down', async () => {
  const pending = [
    { mail_id: 1, task_id: 1, chat_id: '101', part: 0, subject: 'Запит', body: 'Текст', message_id: null },
    { mail_id: 1, task_id: 1, chat_id: '202', part: 0, subject: 'Запит', body: 'Текст', message_id: null }
  ];
  const sends = [];
  let failFirst = true;
  const connection = {
    release() {}, async query(sql, args) {
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('ROW_NUMBER()')) return [pending.filter(row => row.message_id === null)];
      if (sql.startsWith('UPDATE engineering_deliveries')) pending.find(row => row.chat_id === args[2]).message_id = args[0];
      return [{}];
    }
  };
  class UnavailableImap { on() {} async connect() { throw new Error('offline'); } async logout() {} }
  const mail = await load('lib/engineering-mail.ts', {
    imapflow: { ImapFlow: UnavailableImap },
    '@/lib/db': { getDbPool: () => ({ getConnection: async () => connection }) },
    '@/lib/engineering-settings': { readEngineeringSettings: async () => ({ enabled: true, botToken: 'mock' }) },
    '@/lib/engineering-repository': {
      ensureEngineeringSchema: async () => {},
      engineeringUsers: async () => ['101', '202'].map(telegram_id => ({ telegram_id, active: 1, started: 1 })),
      engineeringTask: async () => ({ id: 1, status: 'new', tracking_id: 'TST-1', subject: 'Запит', body: 'Текст' })
    },
    '@/lib/engineering-telegram': {
      engineeringCard: task => task.body, engineeringKeyboard: () => ({}),
      engineeringTelegram: async (_token, _method, body) => {
        sends.push(body.chat_id);
        if (body.chat_id === '101' && failFirst) throw new Error('blocked');
        return { message_id: 42 };
      }
    }
  });
  const first = await mail.runEngineeringMail();
  assert.equal(first.mailFailed, true);
  assert.equal(first.failed, 1);
  assert.equal(first.sent, 1);
  assert.equal(pending[0].message_id, null);
  assert.equal(pending[1].message_id, 42);
  failFirst = false;
  const second = await mail.runEngineeringMail();
  assert.equal(second.sent, 1);
  assert.deepEqual(sends, ['101', '202', '101']);
});
test('duplicate email does not create another task or enqueue duplicate deliveries', async () => {
  const statements = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {},
    async query(sql) { statements.push(sql); return [[{ id: 7 }]]; }
  };
  const repository = await load('lib/engineering-repository.ts', { '@/lib/db': {} });
  await repository.storeEngineeringMail(connection, 'same-source-key', 'ABC-123', 'Тема', 'Текст', ['101']);
  assert.equal(statements.length, 1);
  assert.ok(statements[0].startsWith('SELECT id FROM engineering_mail'));
});
test('invitation creation returns a short Telegram link and stores only its hash', async () => {
  const queries = [];
  const invitations = await load('lib/engineering-invitations.ts', {
    '@/lib/engineering-repository': { ensureEngineeringSchema: async () => {} },
    '@/lib/db': { getDbPool: () => ({ query: async (sql, args) => { queries.push({ sql, args }); return [{ insertId: 12 }]; } }) }
  });
  const invitation = await invitations.createEngineeringInvite('Олена Тестова');
  const url = new URL(invitation.url);
  assert.equal(url.hostname, 't.me');
  assert.equal(url.pathname, '/engineering_dep_pchilka_bot');
  assert.match(url.searchParams.get('start'), /^eng_[A-Za-z0-9_-]{43}$/);
  const token = url.searchParams.get('start').slice(4);
  assert.equal(queries[0].args[0], require('node:crypto').createHash('sha256').update(token).digest('hex'));
  assert.equal(JSON.stringify(queries).includes(token), false);
  assert.equal(invitation.id, 12);
});
test('invitation binds to Telegram sender atomically; another account cannot reuse it or rename an active user', async () => {
  const invite = { id: 7, name: 'Олена Тестова', used_by: null, expired: 0, revoked: 0 };
  const users = new Map();
  const statements = [];
  let commits = 0;
  const connection = {
    async beginTransaction() {}, async commit() { commits++; }, async rollback() {}, release() {},
    async query(sql, args) {
      statements.push(sql);
      if (sql.startsWith('SELECT *, expires_at')) return [[{ ...invite }]];
      if (sql.startsWith('SELECT * FROM engineering_users')) return [users.has(args[0]) ? [users.get(args[0])] : []];
      if (sql.startsWith('INSERT INTO engineering_users')) users.set(args[0], { telegram_id: args[0], name: args[1], active: 1, started: 1 });
      if (sql.startsWith('UPDATE engineering_invites SET used_by')) invite.used_by = args[0];
      return [{}];
    }
  };
  const invitations = await load('lib/engineering-invitations.ts', {
    '@/lib/engineering-repository': { ensureEngineeringSchema: async () => {} },
    '@/lib/db': { getDbPool: () => ({ getConnection: async () => connection }) }
  });
  const token = 'a'.repeat(43);
  assert.equal((await invitations.acceptEngineeringInvite(token, '101')).ok, true);
  assert.equal(users.get('101').name, 'Олена Тестова');
  assert.equal(users.get('101').started, 1);
  assert.equal(invite.used_by, '101');
  assert.ok(statements.some(sql => sql.includes('engineering_invites') && sql.includes('FOR UPDATE')));
  assert.equal((await invitations.acceptEngineeringInvite(token, '202')).ok, false);
  assert.equal(users.has('202'), false);
  assert.equal((await invitations.acceptEngineeringInvite(token, '101')).ok, true); // webhook retry
  assert.equal(commits, 2);
  users.get('101').active = 0;
  assert.equal((await invitations.acceptEngineeringInvite(token, '101')).ok, false); // removed user
  invite.used_by = null;
  invite.name = 'Інший працівник';
  users.get('101').active = 1;
  assert.equal((await invitations.acceptEngineeringInvite(token, '101')).ok, false);
  assert.equal(invite.used_by, null);
  assert.equal(users.get('101').name, 'Олена Тестова');
});
test('invalid, expired and revoked invitations never grant access', async () => {
  const invite = { id: 1, name: 'Працівник', used_by: null, expired: 1, revoked: 0 };
  let writes = 0;
  const invitations = await load('lib/engineering-invitations.ts', {
    '@/lib/engineering-repository': { ensureEngineeringSchema: async () => {} },
    '@/lib/db': { getDbPool: () => ({ getConnection: async () => ({
      async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
      async query(sql) {
        if (sql.startsWith('SELECT *, expires_at')) return [[{ ...invite }]];
        if (sql.startsWith('SELECT * FROM engineering_users')) return [[]];
        writes++; return [{}];
      }
    }) }) }
  });
  assert.equal((await invitations.acceptEngineeringInvite('bad', '101')).ok, false);
  assert.equal((await invitations.acceptEngineeringInvite('a'.repeat(43), '101')).ok, false);
  invite.expired = 0; invite.revoked = 1;
  assert.equal((await invitations.acceptEngineeringInvite('a'.repeat(43), '101')).ok, false);
  assert.equal(writes, 0);
});
test('personal start link activates access and opens task list; group cannot redeem an invitation', async () => {
  const messages = [];
  let accepted = 0, active = false;
  const originalFetch = global.fetch;
  global.fetch = async (_url, request) => { messages.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ ok: true, result: {} }) }; };
  try {
    const bot = await load('lib/engineering-telegram.ts', {
      '@/lib/engineering-invitations': { acceptEngineeringInvite: async (_token, id) => { assert.equal(id, '101'); accepted++; active = true; return { ok: true }; } },
      '@/lib/engineering-settings': { readEngineeringSettings: async () => ({ enabled: true, botToken: 'test' }) },
      '@/lib/db': { getDbPool: () => ({ query: async () => [{}] }) },
      '@/lib/engineering-repository': { engineeringUsers: async () => active ? [{ telegram_id: '101', active: 1 }] : [], engineeringTasks: async () => [] }
    });
    const text = '/start eng_' + 'a'.repeat(43);
    await bot.processEngineeringUpdate({ message: { chat: { id: -100, type: 'group' }, from: { id: 101 }, text } });
    assert.equal(accepted, 0);
    await bot.processEngineeringUpdate({ message: { chat: { id: 101, type: 'private' }, from: { id: 101 }, text } });
    assert.equal(accepted, 1);
    assert.ok(messages.some(message => message.text.includes('Доступ активовано')));
    assert.ok(messages.some(message => message.reply_markup?.inline_keyboard));
  } finally { global.fetch = originalFetch; }
});
test('paused mail collection still replies to plain /start and activates invited staff', async () => {
  const messages = [];
  let active = false, accepted = 0;
  const originalFetch = global.fetch;
  global.fetch = async (_url, request) => { messages.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ ok: true, result: {} }) }; };
  try {
    const bot = await load('lib/engineering-telegram.ts', {
      '@/lib/engineering-invitations': { acceptEngineeringInvite: async () => { active = true; accepted++; return { ok: true }; } },
      '@/lib/engineering-settings': { readEngineeringSettings: async () => ({ enabled: false, botToken: 'test' }) },
      '@/lib/db': { getDbPool: () => ({ query: async () => [{}] }) },
      '@/lib/engineering-repository': { engineeringUsers: async () => active ? [{ telegram_id: '101', active: 1 }] : [], engineeringTasks: async () => [] }
    });
    const message = { chat: { id: 101, type: 'private' }, from: { id: 101 }, text: '/start' };
    await bot.processEngineeringUpdate({ message });
    assert.match(messages[0].text, /персональне посилання/);
    await bot.processEngineeringUpdate({ message: { ...message, text: '/start eng_' + 'a'.repeat(43) } });
    assert.equal(accepted, 1);
    assert.ok(messages.some(message => message.text.includes('Доступ активовано') && message.text.includes('вимкнена')));
    const before = messages.length;
    await bot.processEngineeringUpdate({ message });
    assert.equal(messages.length, before + 1);
    assert.ok(messages.at(-1).reply_markup.inline_keyboard);
  } finally { global.fetch = originalFetch; }
});
test('webhook setup validates bot, refreshes secret and reports delivery errors without dropping updates', async () => {
  const calls = [];
  let username = 'another_bot', webhook = '';
  const settings = { botToken: 'private-token', publicBaseUrl: 'https://example.org', webhookSecret: 'secret' };
  const helper = await load('lib/engineering-webhook.ts', {
    '@/lib/engineering-telegram': { engineeringTelegram: async (_token, method, body) => {
      calls.push({ method, body });
      if (method === 'getMe') return { username };
      if (method === 'setWebhook') { webhook = body.url; return {}; }
      return { url: webhook, pending_update_count: 2, last_error_message: 'Wrong response: 401', last_error_date: 1700000000 };
    } }
  });
  await assert.rejects(helper.registerEngineeringWebhook(settings), /іншому боту/);
  assert.equal(calls.some(call => call.method === 'setWebhook'), false);
  username = 'engineering_dep_pchilka_bot';
  const status = await helper.registerEngineeringWebhook(settings);
  assert.equal(status.connected, true);
  assert.equal(status.pendingUpdates, 2);
  assert.match(status.lastError, /401/);
  const registration = calls.find(call => call.method === 'setWebhook');
  assert.equal(registration.body.secret_token, 'secret');
  assert.equal(registration.body.drop_pending_updates, undefined);
  assert.deepEqual(Array.from(registration.body.allowed_updates), ['message', 'callback_query']);
  const missing = await helper.engineeringWebhookStatus({ ...settings, webhookSecret: '' }).catch(error => error);
  assert.match(missing.message, /Збережіть токен/);
});
test('admin does not issue invitation when webhook registration fails', async () => {
  const timeline = [];
  let connected = false;
  class SetupError extends Error {}
  const api = await load('app/api/admin/engineering/route.ts', {
    '@/lib/admin-auth': { isAdminRequestAuthorized: () => true, getAdminSessionFromRequest: () => ({ role: 'admin' }) },
    '@/lib/db': {}, '@/lib/engineering-repository': {}, '@/lib/engineering-telegram': {}, '@/lib/engineering-mail': {},
    '@/lib/engineering-settings': { readEngineeringSettings: async () => ({}) },
    '@/lib/engineering-invitations': { createEngineeringInvite: async () => { timeline.push('invite'); return { url: 'https://t.me/example' }; } },
    '@/lib/engineering-webhook': { EngineeringTelegramSetupError: SetupError, registerEngineeringWebhook: async () => {
      timeline.push('webhook'); if (!connected) throw new SetupError('Спочатку підключіть Telegram.'); return { connected: true };
    } }
  });
  const request = () => new Request('https://example.org/api/admin/engineering', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite', name: 'Працівник' }) });
  assert.equal((await api.POST(request())).status, 400);
  assert.deepEqual(timeline, ['webhook']);
  connected = true;
  assert.equal((await api.POST(request())).status, 200);
  assert.deepEqual(timeline, ['webhook', 'webhook', 'invite']);
});
test('checkbox, IMAP host and public URL survive fresh reads; API masks secrets and works without DB', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pchilka-settings-api-'));
  const original = process.env.ENGINEERING_ENV_FILE;
  process.env.ENGINEERING_ENV_FILE = path.join(directory, '.env');
  try {
    const settingsModule = await load('lib/engineering-settings.ts');
    const api = await load('app/api/admin/engineering/route.ts', {
      '@/lib/admin-auth': { isAdminRequestAuthorized: () => true, getAdminSessionFromRequest: () => ({ role: 'admin' }) },
      '@/lib/db': { getDbPool: () => { throw new Error('Database offline'); } },
      '@/lib/engineering-repository': { engineeringUsers: async () => { throw new Error('Database offline'); } },
      '@/lib/engineering-telegram': {}, '@/lib/engineering-mail': {}, '@/lib/engineering-invitations': {}, '@/lib/engineering-webhook': {},
      '@/lib/engineering-settings': settingsModule
    });
    const password = 'private-mail-password-WXYZ', token = '123456789:' + 'a'.repeat(30) + '1234';
    const body = { enabled: true, mailUser: 'engineer@legion2015.com', mailHost: 'imap.example.org', mailPassword: password, botToken: token, publicBaseUrl: 'https://example.org/' };
    const put = data => api.PUT(new Request('https://example.org/api/admin/engineering', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }));
    const response = await put(body);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.settings.enabled, true);
    assert.equal(result.settings.mailHost, 'imap.example.org');
    assert.equal(result.settings.publicBaseUrl, 'https://example.org');
    assert.equal(result.settings.passwordLast4, 'WXYZ');
    assert.equal(result.settings.tokenLast4, '1234');
    assert.equal(JSON.stringify(result).includes(password), false);
    assert.equal(JSON.stringify(result).includes(token), false);
    assert.equal(result.storage.filePath, process.env.ENGINEERING_ENV_FILE);
    assert.equal(result.storage.exists, true);
    const freshModule = await load('lib/engineering-settings.ts');
    assert.equal((await freshModule.readEngineeringSettings()).enabled, true);
    const reread = await api.GET(new Request('https://example.org/api/admin/engineering?section=settings'));
    assert.equal(reread.status, 200);
    assert.equal((await reread.json()).settings.mailHost, 'imap.example.org');
    const disabled = await put({ enabled: false, mailPassword: '', botToken: '' });
    assert.equal(disabled.status, 200);
    assert.equal((await disabled.json()).settings.enabled, false);
    const final = await freshModule.readEngineeringSettings();
    assert.equal(final.enabled, false);
    assert.equal(final.mailPassword, password);
    assert.equal(final.botToken, token);
    assert.equal(final.mailHost, body.mailHost);
    assert.equal(final.publicBaseUrl, 'https://example.org');
  } finally {
    if (original === undefined) delete process.env.ENGINEERING_ENV_FILE; else process.env.ENGINEERING_ENV_FILE = original;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test('env parser accepts legacy spacing, quotes and enabled flags consistently', () => {
  const { parseEngineeringEnv, isEngineeringEnabled } = require('./engineering-env.cjs');
  const values = parseEngineeringEnv('\uFEFF export ENGINEERING_ENABLED = \'1\' # old format\r\n ENGINEERING_MAIL_HOST = "imap.example.org" # host\r\nENGINEERING_MAIL_PASSWORD="abc # \\\"quoted\\\" WXYZ"\r\nUNRELATED_SECRET=ignore\r\n');
  assert.equal(values.ENABLED, '1');
  assert.equal(values.MAIL_HOST, 'imap.example.org');
  assert.equal(values.MAIL_PASSWORD, 'abc # "quoted" WXYZ');
  assert.equal('UNRELATED_SECRET' in values, false);
  assert.equal(isEngineeringEnabled(values.ENABLED), true);
  assert.equal(isEngineeringEnabled(' TRUE '), true);
  assert.equal(isEngineeringEnabled('false'), false);
  assert.equal(isEngineeringEnabled('0'), false);
});
test('rewriting legacy assignments removes duplicate keys and confirms checkbox persists', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pchilka-settings-legacy-'));
  const original = process.env.ENGINEERING_ENV_FILE;
  process.env.ENGINEERING_ENV_FILE = path.join(directory, '.env');
  try {
    await fs.writeFile(process.env.ENGINEERING_ENV_FILE, 'OTHER=keep\n export ENGINEERING_ENABLED = 1\n ENGINEERING_MAIL_HOST = \'imap.example.org\'\nENGINEERING_MAIL_USER=engineer@legion2015.com\nENGINEERING_MAIL_PASSWORD=old-password\nENGINEERING_BOT_TOKEN=123456789:' + 'a'.repeat(30) + '\nENGINEERING_PUBLIC_BASE_URL=https://example.org\n');
    const settings = await load('lib/engineering-settings.ts');
    assert.equal((await settings.readEngineeringSettings()).enabled, true);
    await settings.saveEngineeringSettings({ enabled: false });
    const file = await fs.readFile(process.env.ENGINEERING_ENV_FILE, 'utf8');
    assert.equal((file.match(/ENGINEERING_ENABLED\s*=/g) || []).length, 1);
    assert.equal((await settings.readEngineeringSettings()).enabled, false);
    await settings.saveEngineeringSettings({ enabled: true });
    assert.equal((await settings.readEngineeringSettings()).enabled, true);
    assert.ok(file.startsWith('OTHER=keep\n'));
  } finally {
    if (original === undefined) delete process.env.ENGINEERING_ENV_FILE; else process.env.ENGINEERING_ENV_FILE = original;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test('Unauthorized identifies rejected bot token and never attempts webhook registration', async () => {
  const calls = [];
  const helper = await load('lib/engineering-webhook.ts', {
    '@/lib/engineering-telegram': { engineeringTelegram: async (_token, method) => {
      calls.push(method); throw { telegramErrorCode: 401, message: 'Telegram: Unauthorized' };
    } }
  });
  const settings = { botToken: 'test-token', publicBaseUrl: 'https://example.org', webhookSecret: 'secret' };
  const error = await helper.registerEngineeringWebhook(settings).catch(error => error);
  assert.equal(error.code, 'telegram_token_unauthorized');
  assert.equal(error.status, 400);
  assert.equal(error.stage, 'getMe');
  assert.match(error.message, /BotFather/);
  assert.equal(error.message.includes(settings.botToken), false);
  assert.deepEqual(calls, ['getMe']);
  const network = await load('lib/engineering-webhook.ts', { '@/lib/engineering-telegram': { engineeringTelegram: async () => { throw new Error('network failure'); } } });
  const unavailable = await network.registerEngineeringWebhook(settings).catch(error => error);
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.code, 'telegram_api_error');
});
test('Telegram API retains upstream error code without exposing token', async () => {
  const originalFetch = global.fetch;
  const token = '123456:test-private-token';
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized ' + token }) });
  try {
    const bot = await load('lib/engineering-telegram.ts', { '@/lib/db': {}, '@/lib/engineering-settings': {}, '@/lib/engineering-repository': {}, '@/lib/engineering-invitations': {} });
    const error = await bot.engineeringTelegram(token, 'getMe', {}).catch(error => error);
    assert.equal(error.telegramErrorCode, 401);
    assert.equal(error.method, 'getMe');
    assert.equal(error.message.includes(token), false);
    assert.equal(error.description.includes(token), false);
  } finally { global.fetch = originalFetch; }
});
test('pasted token whitespace is removed while password whitespace is preserved', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pchilka-token-'));
  const original = process.env.ENGINEERING_ENV_FILE;
  process.env.ENGINEERING_ENV_FILE = path.join(directory, '.env');
  try {
    const settings = await load('lib/engineering-settings.ts');
    const token = '123456789:' + 'a'.repeat(30);
    const password = ' password with spaces ';
    await settings.saveEngineeringSettings({ botToken: '\n ' + token + ' \r\n', mailPassword: password });
    const saved = await settings.readEngineeringSettings();
    assert.equal(saved.botToken, token);
    assert.equal(saved.mailPassword, password);
  } finally {
    if (original === undefined) delete process.env.ENGINEERING_ENV_FILE; else process.env.ENGINEERING_ENV_FILE = original;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
