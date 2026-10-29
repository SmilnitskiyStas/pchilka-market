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
  vm.runInNewContext(`(function(require, exports) { ${js}\n})`, { process, Buffer, AbortSignal, fetch, console, URL, setTimeout })(name => name in mocks ? mocks[name] : require(name), exports);
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
