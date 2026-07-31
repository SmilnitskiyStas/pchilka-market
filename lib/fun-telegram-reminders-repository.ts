import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type TelegramReminder = {
  id: number;
  chatId: string;
  creatorUserId: string;
  creatorDisplayName: string;
  reminderText: string;
  remindAt: Date;
};

type ReminderRow = RowDataPacket & {
  id: number; chat_id: string; creator_user_id: string; creator_display_name: string; reminder_text: string; remind_at: Date;
};

function mapRow(row: ReminderRow): TelegramReminder {
  return { id: row.id, chatId: row.chat_id, creatorUserId: row.creator_user_id, creatorDisplayName: row.creator_display_name, reminderText: row.reminder_text, remindAt: new Date(row.remind_at) };
}

export async function createTelegramReminder(input: Omit<TelegramReminder, 'id'>): Promise<TelegramReminder> {
  const [result] = await getDbPool().execute<ResultSetHeader>(
    `INSERT INTO telegram_reminders (chat_id, creator_user_id, creator_display_name, reminder_text, remind_at)
     VALUES (?, ?, ?, ?, ?)`,
    [input.chatId, input.creatorUserId, input.creatorDisplayName, input.reminderText, input.remindAt]
  );
  return { ...input, id: result.insertId };
}

export async function listPendingTelegramReminders(chatId: string, creatorUserId: string): Promise<TelegramReminder[]> {
  const [rows] = await getDbPool().execute<ReminderRow[]>(
    `SELECT id, chat_id, creator_user_id, creator_display_name, reminder_text, remind_at
     FROM telegram_reminders WHERE chat_id = ? AND creator_user_id = ? AND status = 'pending'
     ORDER BY remind_at ASC LIMIT 20`,
    [chatId, creatorUserId]
  );
  return rows.map(mapRow);
}

export async function changeTelegramReminderStatus(input: { id: number; chatId: string; creatorUserId: string; status: 'completed' | 'cancelled' }): Promise<boolean> {
  const [result] = await getDbPool().execute<ResultSetHeader>(
    `UPDATE telegram_reminders SET status = ? WHERE id = ? AND chat_id = ? AND creator_user_id = ? AND status = 'pending'`,
    [input.status, input.id, input.chatId, input.creatorUserId]
  );
  return result.affectedRows > 0;
}

export async function claimDueTelegramReminders(): Promise<TelegramReminder[]> {
  const pool = getDbPool();
  const [rows] = await pool.execute<ReminderRow[]>(
    `SELECT id, chat_id, creator_user_id, creator_display_name, reminder_text, remind_at
     FROM telegram_reminders
     WHERE (status = 'pending' AND remind_at <= UTC_TIMESTAMP())
        OR (status = 'processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))
     ORDER BY remind_at ASC LIMIT 50`
  );
  const claimed: TelegramReminder[] = [];
  for (const row of rows) {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE telegram_reminders SET status = 'processing'
       WHERE id = ? AND (status = 'pending' OR (status = 'processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)))`,
      [row.id]
    );
    if (result.affectedRows) claimed.push(mapRow(row));
  }
  return claimed;
}

export async function markTelegramReminderSent(id: number): Promise<void> {
  await getDbPool().execute(`UPDATE telegram_reminders SET status = 'sent', sent_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'processing'`, [id]);
}

export async function releaseTelegramReminder(id: number): Promise<void> {
  await getDbPool().execute(`UPDATE telegram_reminders SET status = 'pending' WHERE id = ? AND status = 'processing'`, [id]);
}
