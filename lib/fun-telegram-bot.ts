import { getFunTelegramSettings } from '@/lib/fun-telegram-settings-repository';

type TelegramUpdate = {
  message?: { chat?: { id?: number | string }; text?: string };
};

const jokes = [
  'Сьогоднішній план: спочатку кава, потім — геніальні рішення. ☕',
  'Нагадування від бота: якщо задача закрита — її можна урочисто закрити ще раз. 🎉',
  'Офіційно: ця група на 97% складається з професіоналів і на 3% — з мемів. 🙂',
  'Мікроперерва схвалена. Потягніться — і повертаємося до великих справ. 💪'
];

async function telegramRequest(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.description || `Telegram ${method} failed.`);
}

export async function processFunTelegramUpdate(update: TelegramUpdate) {
  const settings = await getFunTelegramSettings();
  const message = update.message;
  const chatId = message?.chat?.id?.toString() ?? '';
  const command = (message?.text?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '').replace(/@[^\s]+$/, '');

  if (!settings.enabled || !settings.botToken || !chatId) {
    return { ignored: true };
  }

  // First-run setup: a group administrator can obtain the ID without exposing the bot token.
  // Only explicit commands are answered; all regular group messages remain ignored.
  if (!settings.allowedChatId) {
    if (command === '/start' || command === '/id') {
      await telegramRequest(settings.botToken, 'sendMessage', {
        chat_id: chatId,
        text: `ID цієї тестової групи: ${chatId}\nВнесіть його в адмін-панель, щоб завершити налаштування бота.`
      });
      return { handled: 'setup-chat-id' };
    }
    return { ignored: true };
  }

  if (chatId !== settings.allowedChatId) return { ignored: true };

  if (command === '/start' || command === '/help') {
    await telegramRequest(settings.botToken, 'sendMessage', {
      chat_id: chatId,
      text: 'Привіт! Я тестовий бот для доброзичливих жартів. Команда: /joke'
    });
    return { handled: 'help' };
  }
  if (command === '/joke') {
    await telegramRequest(settings.botToken, 'sendMessage', {
      chat_id: chatId,
      text: jokes[Math.floor(Math.random() * jokes.length)]
    });
    return { handled: 'joke' };
  }
  return { ignored: true };
}

export async function registerFunTelegramWebhook() {
  const settings = await getFunTelegramSettings();
  const url = settings.publicBaseUrl ? `${settings.publicBaseUrl}/api/fun-telegram/webhook` : '';
  if (!settings.botToken || !settings.webhookSecret || !url) throw new Error('Заповніть токен, secret і публічну адресу сайту.');
  await telegramRequest(settings.botToken, 'setWebhook', {
    url, secret_token: settings.webhookSecret, allowed_updates: ['message']
  });
  return { webhookUrl: url };
}
