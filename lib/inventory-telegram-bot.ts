import { createInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import {
  handleInventoryDiscussionCallback,
  handleInventoryDiscussionTextMessage
} from '@/lib/inventory-discussion-telegram';
import { sendInventoryTelegramMessage } from '@/lib/inventory-telegram-api';
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
  callback_query?: {
    id?: string;
    data?: string;
    message?: TelegramMessage;
    from?: {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

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

  const callbackQuery = update.callback_query;
  if (callbackQuery?.id && callbackQuery?.data) {
    return handleInventoryDiscussionCallback({
      callbackQueryId: String(callbackQuery.id),
      data: String(callbackQuery.data),
      telegramUserChatId: String(callbackQuery.from?.id ?? callbackQuery.message?.chat?.id ?? '')
    });
  }

  const message = update.message;
  const chatId = String(message?.chat?.id ?? '');
  const text = String(message?.text ?? '').trim();
  if (!chatId || !text) {
    return { handled: false, reason: 'unsupported_update' as const };
  }

  if (!text.startsWith('/start')) {
    return handleInventoryDiscussionTextMessage({
      telegramUserChatId: chatId,
      text
    });
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
