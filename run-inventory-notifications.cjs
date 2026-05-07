const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

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

async function main() {
  const secret = String(process.env.INVENTORY_NOTIFY_SECRET || process.env.INVENTORY_WEBHOOK_SECRET || '').trim();
  const baseUrl = resolveNotifyBaseUrl();

  if (!secret) {
    console.error('[inventory-notify] INVENTORY_NOTIFY_SECRET is empty');
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/api/inventory/notifications/run`, {
    method: 'POST',
    headers: {
      'x-inventory-notify-secret': secret
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    console.error('[inventory-notify] failed:', payload?.error || `HTTP ${response.status}`);
    process.exit(1);
  }

  console.log(
    `[inventory-notify] candidates=${payload.result?.candidates ?? 0}, batches=${payload.result?.batchesProcessed ?? 0}, messages=${payload.result?.notificationsSent ?? 0}`
  );
}

main().catch((error) => {
  console.error('[inventory-notify] unexpected error:', error);
  process.exit(1);
});
