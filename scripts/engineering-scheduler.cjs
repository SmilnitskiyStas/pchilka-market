const { readEngineeringEnv, isEngineeringEnabled } = require('./engineering-env.cjs');

// Read settings again on every tick: credentials entered in the admin panel work without a restart.
function startEngineeringScheduler() {
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const { values } = await readEngineeringEnv();
      const enabled = isEngineeringEnabled(values.ENABLED ?? process.env.ENGINEERING_ENABLED);
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
