import { getFunTelegramSettings } from '@/lib/fun-telegram-settings-repository';
import { claimDueTelegramReminders, markTelegramReminderSent, releaseTelegramReminder } from '@/lib/fun-telegram-reminders-repository';
import { sendFunTelegramMessage } from '@/lib/fun-telegram-bot';

export async function runFunTelegramReminders() {
  const settings = await getFunTelegramSettings();
  if (!settings.enabled || !settings.botToken) return { processed: 0, sent: 0, skipped: true };
  const reminders = await claimDueTelegramReminders();
  let sent = 0;
  for (const reminder of reminders) {
    try {
      await sendFunTelegramMessage(settings.botToken, reminder.chatId, `⏰ Нагадування для ${reminder.creatorDisplayName}:\n${reminder.reminderText}`);
      await markTelegramReminderSent(reminder.id);
      sent += 1;
    } catch {
      await releaseTelegramReminder(reminder.id);
    }
  }
  return { processed: reminders.length, sent, skipped: false };
}
