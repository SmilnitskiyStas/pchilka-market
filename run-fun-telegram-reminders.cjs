const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

async function main() {
  const secret = String(process.env.FUN_TELEGRAM_REMINDERS_SECRET || '').trim();
  const baseUrl = String(process.env.FUN_TELEGRAM_REMINDERS_BASE_URL || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (!secret || !baseUrl) throw new Error('FUN_TELEGRAM_REMINDERS_SECRET and FUN_TELEGRAM_REMINDERS_BASE_URL are required.');
  const response = await fetch(`${baseUrl}/api/fun-telegram/reminders/run`, { method: 'POST', headers: { 'x-fun-telegram-reminders-secret': secret } });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  console.log(`[fun-telegram-reminders] processed=${payload.result.processed}, sent=${payload.result.sent}, skipped=${payload.result.skipped}`);
}
main().catch((error) => { console.error('[fun-telegram-reminders]', error.message); process.exit(1); });
