import { engineeringTelegram } from '@/lib/engineering-telegram';
import { type EngineeringSettings } from '@/lib/engineering-settings';

export class EngineeringTelegramSetupError extends Error {}
async function callTelegram(settings: EngineeringSettings, method: string, body: Record<string, unknown>) {
  try { return await engineeringTelegram(settings.botToken, method, body); }
  catch (error) {
    throw new EngineeringTelegramSetupError(error instanceof Error && error.message.startsWith('Telegram:') ? error.message : 'Не вдалося з’єднатися з Telegram. Перевірте токен і доступ сервера до api.telegram.org.');
  }
}
function webhookUrl(settings: EngineeringSettings) {
  if (!settings.botToken || !settings.publicBaseUrl || !settings.webhookSecret) throw new EngineeringTelegramSetupError('Збережіть токен бота та публічну HTTPS-адресу сайту, потім підключіть Telegram.');
  return `${settings.publicBaseUrl}/api/engineering/webhook`;
}
async function verifyBot(settings: EngineeringSettings) {
  const bot = await callTelegram(settings, 'getMe', {});
  if (String(bot.username).toLowerCase() !== 'engineering_dep_pchilka_bot') throw new EngineeringTelegramSetupError('Токен належить іншому боту. Потрібен токен @engineering_dep_pchilka_bot.');
}
export async function engineeringWebhookStatus(settings: EngineeringSettings) {
  const expectedUrl = webhookUrl(settings);
  await verifyBot(settings);
  const info = await callTelegram(settings, 'getWebhookInfo', {}) as { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number };
  return {
    connected: info.url === expectedUrl,
    expectedUrl,
    pendingUpdates: Number(info.pending_update_count || 0),
    lastError: (info.last_error_message || '').replaceAll(settings.botToken, '[token]'),
    lastErrorAt: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
  };
}
export async function registerEngineeringWebhook(settings: EngineeringSettings) {
  const url = webhookUrl(settings);
  await verifyBot(settings);
  // Register again even for the same URL: the secret may have changed since the last setup.
  await callTelegram(settings, 'setWebhook', { url, secret_token: settings.webhookSecret, allowed_updates: ['message', 'callback_query'] });
  return engineeringWebhookStatus(settings);
}
