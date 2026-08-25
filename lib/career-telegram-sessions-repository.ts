import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export type CareerTelegramStep = 'phone' | 'full_name' | 'city' | 'district';
export type CareerTelegramSession = { chatId: string; step: CareerTelegramStep; phone: string; fullName: string; city: string; telegramUserId: string; telegramUsername: string };
type Row = RowDataPacket & { chat_id: string; step: CareerTelegramStep; phone: string | null; full_name: string | null; city: string | null; telegram_user_id: string | null; telegram_username: string | null };

function map(row: Row): CareerTelegramSession { return { chatId: row.chat_id, step: row.step, phone: row.phone ?? '', fullName: row.full_name ?? '', city: row.city ?? '', telegramUserId: row.telegram_user_id ?? '', telegramUsername: row.telegram_username ?? '' }; }

export async function getCareerTelegramSession(chatId: string) {
  const [rows] = await getDbPool().query<Row[]>('SELECT chat_id, step, phone, full_name, city, telegram_user_id, telegram_username FROM career_telegram_sessions WHERE chat_id = ? LIMIT 1', [chatId]);
  return rows[0] ? map(rows[0]) : null;
}

export async function saveCareerTelegramSession(session: CareerTelegramSession) {
  await getDbPool().query(
    `INSERT INTO career_telegram_sessions (chat_id, step, phone, full_name, city, telegram_user_id, telegram_username)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE step = VALUES(step), phone = VALUES(phone), full_name = VALUES(full_name), city = VALUES(city), telegram_user_id = VALUES(telegram_user_id), telegram_username = VALUES(telegram_username), updated_at = CURRENT_TIMESTAMP`,
    [session.chatId, session.step, session.phone || null, session.fullName || null, session.city || null, session.telegramUserId || null, session.telegramUsername || null]
  );
}

export async function deleteCareerTelegramSession(chatId: string) { await getDbPool().query('DELETE FROM career_telegram_sessions WHERE chat_id = ?', [chatId]); }
