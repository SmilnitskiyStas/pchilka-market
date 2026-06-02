import { buildInventoryWebhookUrl } from '@/lib/inventory-telegram-settings';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';

type TelegramWebhookInfoResult = {
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
};

async function callTelegram(botToken: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: TelegramWebhookInfoResult; description?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API ${method} failed.`);
  }

  return payload.result ?? null;
}

export async function registerInventoryTelegramWebhook() {
  const settings = await getInventoryTelegramSettingsFromDb();
  const webhookUrl = buildInventoryWebhookUrl(settings);

  if (!settings.enabled) throw new Error('Telegram integration is disabled.');
  if (!settings.botToken) throw new Error('Bot token is empty.');
  if (!settings.webhookSecret) throw new Error('Webhook secret is empty.');
  if (!webhookUrl) throw new Error('Webhook URL is empty.');

  await callTelegram(settings.botToken, 'setWebhook', {
    url: webhookUrl,
    secret_token: settings.webhookSecret,
    allowed_updates: ['message', 'callback_query']
  });

  const info = await callTelegram(settings.botToken, 'getWebhookInfo');
  return { webhookUrl, info };
}

export async function getInventoryTelegramWebhookInfo() {
  const settings = await getInventoryTelegramSettingsFromDb();
  const webhookUrl = buildInventoryWebhookUrl(settings);

  if (!settings.botToken) {
    return { configured: false, webhookUrl, info: null };
  }

  const info = await callTelegram(settings.botToken, 'getWebhookInfo');
  return { configured: Boolean(info?.url), webhookUrl, info };
}
