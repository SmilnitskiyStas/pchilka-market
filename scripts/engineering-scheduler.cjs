const { readFile } = require('node:fs/promises');
const path = require('node:path');

// Read settings again on every tick: credentials entered in the admin panel work without a restart.
function startEngineeringScheduler() {
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const envPath = path.resolve(process.env.ENGINEERING_ENV_FILE || path.join(process.cwd(), '.env'));
      const source = await readFile(envPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
      const values = {};
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^ENGINEERING_([A-Z_]+)=(.*)$/);
        if (match) { try { values[match[1]] = JSON.parse(match[2]); } catch { values[match[1]] = match[2]; } }
      }
      const enabled = String(values.ENABLED ?? process.env.ENGINEERING_ENABLED) === 'true';
      const secret = values.RUN_SECRET || process.env.ENGINEERING_RUN_SECRET;
      if (!enabled || !secret) return;
      const response = await fetch(`http://127.0.0.1:${Number(process.env.PORT || 3000)}/api/engineering/run`, { method: 'POST', headers: { 'x-engineering-secret': secret }, signal: AbortSignal.timeout(240000) });
      if (!response.ok) console.error(`[engineering-mail] check failed: HTTP ${response.status}`);
      else {
        const data = await response.json();
        if (data.result?.mailFailed || data.result?.failed) console.error('[engineering-mail] mail or delivery failed; retrying on the next tick.');
      }
    } catch { console.error('[engineering-mail] check failed; check mail, Telegram and database settings.'); }
    finally { running = false; }
  }
  const timer = setInterval(() => void tick(), 30000);
  return () => clearInterval(timer);
}
module.exports = { startEngineeringScheduler };
