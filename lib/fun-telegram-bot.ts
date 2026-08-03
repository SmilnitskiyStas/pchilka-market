import { getFunTelegramSettings } from '@/lib/fun-telegram-settings-repository';
import { assignTelegramReminder, changeTelegramReminderStatus, createTelegramReminder, listPendingTelegramReminders } from '@/lib/fun-telegram-reminders-repository';

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { id?: number | string; first_name?: string; username?: string };
    text?: string;
  };
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

export async function sendFunTelegramMessage(token: string, chatId: string, text: string) {
  return telegramRequest(token, 'sendMessage', { chat_id: chatId, text });
}

function formatKyiv(value: Date): string {
  return new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' }).format(value);
}

function kyivDateToUtc(date: string, time: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !timeMatch) return null;
  const [year, month, day, hours, minutes] = [...match.slice(1), ...timeMatch.slice(1)].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) return null;
  const desiredUtc = Date.UTC(year, month - 1, day, hours, minutes);
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(instant);
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
    return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute) - instant.getTime();
  };
  let result = new Date(desiredUtc - offsetAt(new Date(desiredUtc)));
  result = new Date(desiredUtc - offsetAt(result));
  return Number.isNaN(result.getTime()) ? null : result;
}

function reminderHelp() {
  return 'Нагадування:\n/remind РРРР-ММ-ДД ГГ:ХХ @username текст\n/assign ID @username\n/tasks\n/done ID\n/delete ID\n\n@username необовʼязковий. Час указуйте за Києвом.';
}

export async function processFunTelegramUpdate(update: TelegramUpdate) {
  const settings = await getFunTelegramSettings();
  const message = update.message;
  const chatId = message?.chat?.id?.toString() ?? '';
  const command = (message?.text?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '').replace(/@[^\s]+$/, '');
  const senderId = message?.from?.id?.toString() ?? '';
  const senderName = message?.from?.first_name?.trim() || message?.from?.username?.trim() || 'Учасник';
  const senderUsername = (message?.from?.username?.trim() ?? '').replace(/^@/, '').toLowerCase();

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
    await sendFunTelegramMessage(settings.botToken, chatId, `Привіт! Я тестовий бот для доброзичливих жартів.\n/joke\n${reminderHelp()}`);
    return { handled: 'help' };
  }
  if (command === '/joke') {
    await sendFunTelegramMessage(settings.botToken, chatId, jokes[Math.floor(Math.random() * jokes.length)]);
    return { handled: 'joke' };
  }
  if (!senderId) return { ignored: true };
  if (command === '/remind') {
    const match = /^\/remind(?:@[^\s]+)?\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+@([A-Za-z0-9_]{5,32}))?\s+(.+)$/i.exec(message?.text?.trim() ?? '');
    const remindAt = match ? kyivDateToUtc(match[1], match[2]) : null;
    const assigneeUsername = match?.[3]?.toLowerCase() ?? '';
    const reminderText = match?.[4]?.trim() ?? '';
    if (!remindAt || !reminderText || reminderText.length > 1000 || remindAt.getTime() <= Date.now()) {
      await sendFunTelegramMessage(settings.botToken, chatId, `Не вдалося створити нагадування.\n${reminderHelp()}`);
      return { handled: 'reminder-invalid' };
    }
    const reminder = await createTelegramReminder({ chatId, creatorUserId: senderId, creatorDisplayName: senderName, assigneeUsername, reminderText, remindAt });
    const recipient = assigneeUsername ? ` для @${assigneeUsername}` : '';
    await sendFunTelegramMessage(settings.botToken, chatId, `✅ Нагадування #${reminder.id}${recipient} збережено на ${formatKyiv(remindAt)}.`);
    return { handled: 'reminder-created', id: reminder.id };
  }
  if (command === '/tasks') {
    const reminders = await listPendingTelegramReminders(chatId, senderId, senderUsername);
    const text = reminders.length ? reminders.map((reminder) => `${reminder.assigneeUsername ? `@${reminder.assigneeUsername} · ` : ''}#${reminder.id} — ${formatKyiv(reminder.remindAt)}\n${reminder.reminderText}`).join('\n\n') : 'Активних нагадувань немає.';
    await sendFunTelegramMessage(settings.botToken, chatId, text);
    return { handled: 'reminders-list', count: reminders.length };
  }
  if (command === '/assign') {
    const match = /^\/assign(?:@[^\s]+)?\s+(\d+)\s+@([A-Za-z0-9_]{5,32})$/i.exec(message?.text?.trim() ?? '');
    if (!match) {
      await sendFunTelegramMessage(settings.botToken, chatId, 'Формат: /assign ID @username');
      return { handled: 'reminder-assignee-invalid' };
    }
    const changed = await assignTelegramReminder({ id: Number(match[1]), chatId, creatorUserId: senderId, assigneeUsername: match[2].toLowerCase() });
    await sendFunTelegramMessage(settings.botToken, chatId, changed ? `✅ Нагадування #${match[1]} призначено для @${match[2]}.` : 'Не знайдено вашого активного нагадування з таким ID.');
    return { handled: 'reminder-assigned', changed };
  }
  if (command === '/done' || command === '/delete') {
    const id = Number(message?.text?.trim().split(/\s+/, 2)[1]);
    if (!Number.isSafeInteger(id) || id < 1) {
      await sendFunTelegramMessage(settings.botToken, chatId, 'Вкажіть ID: /done 12 або /delete 12');
      return { handled: 'reminder-id-invalid' };
    }
    const changed = await changeTelegramReminderStatus({ id, chatId, creatorUserId: senderId, status: command === '/done' ? 'completed' : 'cancelled' });
    await sendFunTelegramMessage(settings.botToken, chatId, changed ? `✅ Нагадування #${id} ${command === '/done' ? 'виконано' : 'видалено'}.` : 'Не знайдено активного нагадування з таким ID.');
    return { handled: 'reminder-status', changed };
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
  await telegramRequest(settings.botToken, 'setMyCommands', {
    scope: { type: 'all_group_chats' },
    commands: [
      { command: 'joke', description: 'Випадковий доброзичливий жарт' },
      { command: 'remind', description: 'Створити нагадування' },
      { command: 'assign', description: 'Призначити нагадування іншому' },
      { command: 'tasks', description: 'Мої активні нагадування' },
      { command: 'done', description: 'Позначити нагадування виконаним' },
      { command: 'delete', description: 'Скасувати нагадування' },
      { command: 'help', description: 'Показати довідку' }
    ]
  });
  return { webhookUrl: url };
}
