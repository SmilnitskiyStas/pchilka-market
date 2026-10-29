/* Run after npm run build. Uses an in-memory DB fixture; never connects to MySQL. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHmac, randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');

if (process.env.PCHILKA_PROFILE_CHECK_FIXTURE === 'true') {
  let profile = { contactPhones: ['+38 (050) 111-22-33'], contactsPageLines: ['CONTACTS_BEFORE'] };
  global.__mysqlPool = {
    async query(sql, params = []) {
      if (params[0] !== 'site_profile_v1') return [[], []];
      if (/INSERT INTO site_settings/.test(sql)) {
        profile = JSON.parse(params[1]);
        return [{ affectedRows: 1 }, []];
      }
      return [[{ setting_value: JSON.stringify(profile) }], []];
    }
  };
} else {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

async function checkNetworkEditor() {
  const vm = require('node:vm');
  const ts = require('typescript');
  const settings = ts.transpileModule(fs.readFileSync(path.join(root, 'lib/site-profile-settings.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  });
  const model = {};
  vm.runInNewContext(settings.outputText, { exports: model, URL });
  const slots = [];
  let cursor = 0, effects = [], refreshed = 0, saved;
  const slot = () => slots[cursor++] ?? (slots[cursor - 1] = {});
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const react = {
    useState(initial) { const s = slot(); if (!('value' in s)) s.value = typeof initial === 'function' ? initial() : initial; return [s.value, (v) => { s.value = typeof v === 'function' ? v(s.value) : v; }]; },
    useMemo(fn, deps) { const s = slot(); if (!same(s.deps, deps)) { s.value = fn(); s.deps = deps; } return s.value; },
    useEffect(fn, deps) { const s = slot(); if (!same(s.deps, deps)) { s.deps = deps; effects.push(fn); } }
  };
  const out = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, 'components/admin/admin-network-manager.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(source, {
    exports: out,
    require: (name) => {
      if (name === 'react') return react;
      if (name === 'next/navigation') return { useRouter: () => ({ refresh: () => { refreshed++; } }) };
      if (name === '@/lib/site-profile-settings') return model;
      if (name === '@/lib/store-types') return { normalizeStore: (s) => s };
      return require(name);
    },
    fetch: async (url, options = {}) => {
      if (options.method === 'PUT' && url.includes('site-profile')) saved = JSON.parse(options.body).settings;
      return { ok: true, json: async () => ({ ok: true, settings: saved ?? model.defaultSiteProfileSettings, stores: [] }) };
    }, console, Date, Set, FormData, File
  });
  function render() { cursor = 0; effects = []; const tree = out.default(); effects.forEach((fn) => fn()); return tree; }
  function nodes(n, predicate) {
    if (Array.isArray(n)) return n.flatMap((child) => nodes(child, predicate));
    if (!n || typeof n !== 'object') return [];
    return [...(predicate(n) ? [n] : []), ...nodes(n.props?.children, predicate)];
  }
  render();
  await new Promise(setImmediate);
  let tree = render();
  const phones = nodes(tree, (n) => n.type === 'textarea' && n.props.value.includes('+38 (067)'))[0];
  const lines = nodes(tree, (n) => n.type === 'textarea' && n.props.value.includes('Центральний офіс'))[0];
  assert(phones && lines);
  phones.props.onChange({ target: { value: '+38 (050) 111-22-33\n' } });
  lines.props.onChange({ target: { value: 'Новий текст \n' } });
  tree = render();
  assert(nodes(tree, (n) => n.type === 'textarea' && n.props.value === '+38 (050) 111-22-33\n').length);
  assert(nodes(tree, (n) => n.type === 'textarea' && n.props.value === 'Новий текст \n').length);
  await nodes(tree, (n) => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(Array.from(saved.contactPhones), ['+38 (050) 111-22-33']);
  assert.deepEqual(Array.from(saved.contactsPageLines), ['Новий текст']);
  assert.equal(refreshed, 1);
}

async function main() {
  await checkNetworkEditor();
  const secret = randomUUID();
  const payload = Buffer.from(JSON.stringify({ sub: 'legacy:profile-check', username: 'profile-check', role: 'admin', permissions: [], expiresAt: Date.now() + 300000 })).toString('base64url');
  const token = payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
  const headers = { cookie: `pchilka_admin_session=${token}`, 'Content-Type': 'application/json' };
  const base = 'http://127.0.0.1:3198';
  const server = spawn(process.execPath, ['--require', __filename, 'node_modules/next/dist/bin/next', 'start', '-p', '3198', '-H', '127.0.0.1'], {
    cwd: root, windowsHide: true,
    env: { ...process.env, ADMIN_SESSION_SECRET: secret, PCHILKA_PROFILE_CHECK_FIXTURE: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  server.stdout.on('data', (data) => { logs += data; });
  server.stderr.on('data', (data) => { logs += data; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const response = await fetch(`${base}/api/admin/site-profile`);
        ready = response.ok && (await response.json()).settings?.contactPhones[0] === '+38 (050) 111-22-33';
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, 'Fixture server did not start');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.next/prerender-manifest.json'), 'utf8'));
    assert(!manifest.routes['/about/contacts'], 'Contacts are still statically cached');
    async function checkPage(phone, line) {
      const response = await fetch(`${base}/about/contacts`);
      assert.equal(response.status, 200);
      const html = await response.text();
      const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
      assert(header?.includes(phone), 'Saved phone must be in initial header HTML');
      assert(!header.includes('341-84-98'), 'Header must not flash default phones');
      assert(html.includes(line));
      assert(!html.includes('MVP вебзастосунку'));
    }
    await checkPage('+38 (050) 111-22-33', 'CONTACTS_BEFORE');
    const settings = {
      contactPhones: ['+38 (050) 999-88-77', '+38 (050) 222-33-44'],
      contactsPageTitle: 'Контакти мережі',
      contactsPageLines: ['CONTACTS_AFTER_LINE_1', 'CONTACTS_AFTER_LINE_2', 'Email: check@example.com'],
      contactsMapAddress: 'Київ, Хрещатик, 1'
    };
    const response = await fetch(`${base}/api/admin/site-profile`, { method: 'PUT', headers, body: JSON.stringify({ settings }) });
    assert.equal(response.status, 200);
    const saved = (await response.json()).settings;
    assert.deepEqual(saved.contactsPageLines, settings.contactsPageLines);
    assert.deepEqual(saved.contactPhones, settings.contactPhones);
    await checkPage(settings.contactPhones[0], settings.contactsPageLines[0]);
    const html = await (await fetch(`${base}/about/contacts`)).text();
    assert(html.includes('CONTACTS_AFTER_LINE_2') && html.includes('mailto:check@example.com'));
    assert(!html.includes('CONTACTS_BEFORE'));
    assert(html.includes('Контакти мережі'));
    const home = await (await fetch(base)).text();
    assert(home.match(/<header\b[\s\S]*?<\/header>/)?.[0].includes(settings.contactPhones[0]));
    assert(!home.includes('MVP вебзастосунку'));
    assert.equal((await fetch(`${base}/api/admin/site-profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"settings":{}}' })).status, 401);
    console.log('PASS: multiline editing preserves newlines/spaces until save; save refreshes layout; production contacts update without rebuild; saved phone is in initial header HTML on contacts and home; no MVP description; unauthorized save rejected. No live DB writes.');
  } catch (error) {
    console.error(logs.slice(-2000));
    throw error;
  } finally {
    server.kill();
  }
}
