const { spawn } = require('node:child_process');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

function isAutoRunEnabled() {
  const value = String(process.env.INVENTORY_NOTIFICATIONS_AUTO_RUN || '1').trim().toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'off' && value !== 'no';
}

function isUtilityMeterRemindersAutoRunEnabled() {
  const value = String(process.env.UTILITY_METER_REMINDERS_AUTO_RUN || '1').trim().toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'off' && value !== 'no';
}

function getKyivDateParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kiev',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0)
  };
}

function resolveNotifyBaseUrl() {
  const explicitBaseUrl = String(process.env.INVENTORY_NOTIFY_BASE_URL || '').trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  const siteUrl = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (siteUrl) {
    return siteUrl.replace(/\/+$/, '');
  }

  const port = Number(process.env.PORT || 3000);
  return `http://127.0.0.1:${port}`;
}

function resolveUtilityMeterRemindersBaseUrl() {
  const explicitBaseUrl = String(process.env.UTILITY_METER_REMINDERS_BASE_URL || '').trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  return resolveNotifyBaseUrl();
}

function utilityMeterRemindersHour() {
  const value = Number(process.env.UTILITY_METER_REMINDERS_HOUR || 9);
  return Number.isInteger(value) && value >= 0 && value <= 23 ? value : 9;
}

function startInventoryNotificationsScheduler() {
  if (!isAutoRunEnabled()) {
    console.log('[inventory-notify] auto-run disabled by INVENTORY_NOTIFICATIONS_AUTO_RUN');
    return () => {};
  }

  const secret = String(process.env.INVENTORY_NOTIFY_SECRET || process.env.INVENTORY_WEBHOOK_SECRET || '').trim();
  const baseUrl = resolveNotifyBaseUrl();
  if (!secret) {
    console.warn('[inventory-notify] auto-run skipped: INVENTORY_NOTIFY_SECRET is empty');
    return () => {};
  }

  let lastRunDateKey = '';
  let isRunning = false;

  async function tick() {
    const { dateKey, hour, minute } = getKyivDateParts();
    if (hour !== 7 || minute !== 0) return;
    if (lastRunDateKey === dateKey || isRunning) return;

    isRunning = true;
    try {
      const response = await fetch(`${baseUrl}/api/inventory/notifications/run`, {
        method: 'POST',
        headers: {
          'x-inventory-notify-secret': secret
        }
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        console.error('[inventory-notify] auto-run failed:', payload?.error || `HTTP ${response.status}`);
        return;
      }

      lastRunDateKey = dateKey;
      console.log(
        `[inventory-notify] auto-run ok: candidates=${payload.result?.candidates ?? 0}, batches=${payload.result?.batchesProcessed ?? 0}, messages=${payload.result?.notificationsSent ?? 0}`
      );
    } catch (error) {
      console.error('[inventory-notify] auto-run unexpected error:', error);
    } finally {
      isRunning = false;
    }
  }

  const timer = setInterval(() => {
    void tick();
  }, 30 * 1000);

  console.log(`[inventory-notify] auto-run enabled for 07:00 Europe/Kiev via ${baseUrl}/api/inventory/notifications/run`);

  return () => {
    clearInterval(timer);
  };
}

function startUtilityMeterRemindersScheduler() {
  if (!isUtilityMeterRemindersAutoRunEnabled()) {
    console.log('[utility-meter-reminders] auto-run disabled by UTILITY_METER_REMINDERS_AUTO_RUN');
    return () => {};
  }

  // The inventory secret is a backwards-compatible fallback for existing deployments.
  // New installations should configure the dedicated utility-meter secret instead.
  const secret = String(
    process.env.UTILITY_METER_REMINDERS_SECRET || process.env.INVENTORY_NOTIFY_SECRET || process.env.INVENTORY_WEBHOOK_SECRET || ''
  ).trim();
  const baseUrl = resolveUtilityMeterRemindersBaseUrl();
  const hour = utilityMeterRemindersHour();
  if (!secret) {
    console.warn('[utility-meter-reminders] auto-run skipped: UTILITY_METER_REMINDERS_SECRET is empty');
    return () => {};
  }

  let lastRunDateKey = '';
  let isRunning = false;

  async function tick() {
    const { dateKey, hour: currentHour, minute } = getKyivDateParts();
    // Allow a short recovery window if the app restarts during the scheduled minute.
    if (currentHour !== hour || minute > 5) return;
    if (lastRunDateKey === dateKey || isRunning) return;

    isRunning = true;
    try {
      const response = await fetch(`${baseUrl}/api/utility-meters/reminders/run`, {
        method: 'POST',
        headers: {
          'x-utility-meter-reminders-secret': secret
        }
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        console.error('[utility-meter-reminders] auto-run failed:', payload?.error || `HTTP ${response.status}`);
        return;
      }

      lastRunDateKey = dateKey;
      console.log(
        `[utility-meter-reminders] auto-run ok: candidates=${payload.result?.candidates ?? 0}, messages=${payload.result?.notificationsSent ?? 0}, failed=${payload.result?.failed ?? 0}`
      );
    } catch (error) {
      console.error('[utility-meter-reminders] auto-run unexpected error:', error);
    } finally {
      isRunning = false;
    }
  }

  const timer = setInterval(() => {
    void tick();
  }, 30 * 1000);
  void tick();

  console.log(`[utility-meter-reminders] auto-run enabled for ${String(hour).padStart(2, '0')}:00 Europe/Kiev via ${baseUrl}/api/utility-meters/reminders/run`);

  return () => {
    clearInterval(timer);
  };
}

const raw = process.argv.slice(2);
const nextArgs = ['start'];

for (let index = 0; index < raw.length; index += 1) {
  const current = raw[index];

  if (current === '--host' && raw[index + 1]) {
    nextArgs.push('--hostname', raw[index + 1]);
    index += 1;
    continue;
  }

  if (current.startsWith('--host=')) {
    nextArgs.push('--hostname', current.split('=')[1]);
    continue;
  }

  nextArgs.push(current);
}

const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: 'inherit',
  env: process.env
});
const stopInventoryScheduler = startInventoryNotificationsScheduler();
const stopUtilityMeterRemindersScheduler = startUtilityMeterRemindersScheduler();

child.on('exit', (code, signal) => {
  stopInventoryScheduler();
  stopUtilityMeterRemindersScheduler();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  stopInventoryScheduler();
  stopUtilityMeterRemindersScheduler();
  console.error('Failed to start Next.js:', error);
  process.exit(1);
});
