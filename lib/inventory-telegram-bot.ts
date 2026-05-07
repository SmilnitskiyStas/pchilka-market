import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

type TelegramChat = {
  id: number | string;
};

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: TelegramChat;
  from?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

async function callTelegramApi(botToken: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description =
      payload && typeof payload === 'object' && typeof (payload as { description?: unknown }).description === 'string'
        ? (payload as { description: string }).description
        : '';
    throw new Error(`Telegram API ${method} failed with ${response.status}${description ? `: ${description}` : '.'}`);
  }

  return payload;
}

function isLikelyTelegramSafeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'tg:'].includes(url.protocol)) return false;

    const host = url.hostname.trim().toLowerCase();
    if (!host && url.protocol !== 'tg:') return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;

    return true;
  } catch {
    return false;
  }
}

export async function sendInventoryTelegramMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  const safeButtonUrl = input.buttonUrl?.trim() && isLikelyTelegramSafeUrl(input.buttonUrl) ? input.buttonUrl.trim() : '';
  const replyMarkup =
    input.buttonText && safeButtonUrl
      ? {
          inline_keyboard: [[{ text: input.buttonText, url: safeButtonUrl }]]
        }
      : undefined;

  try {
    return await callTelegramApi(input.botToken, 'sendMessage', {
      chat_id: input.chatId,
      text: input.text,
      reply_markup: replyMarkup
    });
  } catch (error) {
    if (!replyMarkup) {
      throw error;
    }

    const fallbackText = safeButtonUrl ? `${input.text}\n\n${safeButtonUrl}` : input.text;
    return callTelegramApi(input.botToken, 'sendMessage', {
      chat_id: input.chatId,
      text: fallbackText
    });
  }
}

function buildRegistrationUrl(baseUrl: string, token: string): string {
  const url = new URL('/inventory/register', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildInventoryIntakeUrl(baseUrl: string, token: string): string {
  const url = new URL('/inventory/intake', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function processInventoryTelegramUpdate(update: TelegramUpdate) {
  const settings = await getInventoryTelegramSettingsFromDb();
  if (!settings.enabled || !settings.botToken || !settings.publicBaseUrl || !settings.webhookSecret) {
    return { handled: false, reason: 'integration_not_configured' as const };
  }

  const message = update.message;
  const chatId = String(message?.chat?.id ?? '');
  const text = String(message?.text ?? '').trim();
  if (!chatId || !text.startsWith('/start')) {
    return { handled: false, reason: 'unsupported_update' as const };
  }

  const token = createInventoryRegistrationToken(
    {
      chatId,
      firstName: String(message?.from?.first_name ?? ''),
      lastName: String(message?.from?.last_name ?? ''),
      username: String(message?.from?.username ?? '')
    },
    settings.webhookSecret
  );

  const existingUser = await findInventoryUserByChatId(chatId);
  if (existingUser) {
    const intakeUrl = buildInventoryIntakeUrl(settings.publicBaseUrl, token);
    await sendInventoryTelegramMessage({
      botToken: settings.botToken,
      chatId,
      text:
        `Ви вже зареєстровані в системі як ${existingUser.surname} ${existingUser.name}.\n` +
        'Натисніть кнопку нижче, щоб перейти до внесення нової партії товару.',
      buttonText: 'Додати товар',
      buttonUrl: intakeUrl
    });

    return { handled: true, reason: 'intake_link_sent' as const, intakeUrl };
  }

  const registrationUrl = buildRegistrationUrl(settings.publicBaseUrl, token);

  await sendInventoryTelegramMessage({
    botToken: settings.botToken,
    chatId,
    text: 'Ви ще не зареєстровані в системі. Натисніть кнопку нижче, щоб відкрити форму реєстрації.',
    buttonText: 'Зареєструватися',
    buttonUrl: registrationUrl
  });

  return { handled: true, reason: 'registration_link_sent' as const, registrationUrl };
}
