import { engineeringTelegram } from '@/lib/engineering-telegram';
import { type EngineeringSettings } from '@/lib/engineering-settings';

export class EngineeringTelegramSetupError extends Error {
  constructor(message: string, public readonly code = 'telegram_settings_invalid', public readonly status = 400, public readonly stage?: string) { super(message); }
}
async function callTelegram(settings: EngineeringSettings, method: string, body: Record<string, unknown>) {
  try { return await engineeringTelegram(settings.botToken, method, body); }
  catch (error) {
    const provider = error as { telegramErrorCode?: number; description?: string; message?: string };
    const message = String(provider?.message || '');
    if (provider?.telegramErrorCode === 401 || /Telegram:\s*Unauthorized/i.test(message) || (method === 'getMe' && (provider?.telegramErrorCode === 404 || /Telegram:\s*Not Found/i.test(message)))) {
      throw new EngineeringTelegramSetupError('Telegram не приймає збережений токен бота (Unauthorized). Введіть чинний токен @engineering_dep_pchilka_bot із BotFather у поле «Токен», збережіть і повторіть підключення. Пароль пошти змінювати не потрібно.', 'telegram_token_unauthorized', 400, method);
    }
    throw new EngineeringTelegramSetupError(message.startsWith('Telegram:') ? message : 'Не вдалося з’єднатися з Telegram. Перевірте доступ сервера до api.telegram.org і повторіть спробу.', 'telegram_api_error', 502, method);
  }
}
function webhookUrl(settings: EngineeringSettings) {
  if (!settings.botToken || !settings.publicBaseUrl || !settings.webhookSecret) throw new EngineeringTelegramSetupError('Збережіть токен бота та публічну HTTPS-адресу сайту, потім підключіть Telegram.');
  return `${settings.publicBaseUrl}/api/engineering/webhook`;
}
async function verifyBot(settings: EngineeringSettings) {
  const bot = await callTelegram(settings, 'getMe', {});
  if (String(bot.username).toLowerCase() !== 'engineering_dep_pchilka_bot') throw new EngineeringTelegramSetupError('Токен належить іншому боту. Потрібен токен @engineering_dep_pchilka_bot.', 'telegram_wrong_bot', 400, 'getMe');
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
