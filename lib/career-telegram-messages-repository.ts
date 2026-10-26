import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type CareerTelegramMessage = { id: string; requestId: string; chatId: string; direction: 'incoming' | 'outgoing'; text: string; createdAt: string };
type Row = RowDataPacket & { id: number; request_id: number; chat_id: string; direction: 'incoming' | 'outgoing'; message_text: string; created_at: string };
function map(row: Row): CareerTelegramMessage { return { id: String(row.id), requestId: String(row.request_id), chatId: row.chat_id, direction: row.direction, text: row.message_text, createdAt: row.created_at }; }

export async function addCareerTelegramMessage(input: { requestId: string | number; chatId: string; direction: CareerTelegramMessage['direction']; text: string }) {
  await getDbPool().query('INSERT INTO career_telegram_messages (request_id, chat_id, direction, message_text) VALUES (?, ?, ?, ?)', [Number(input.requestId), input.chatId, input.direction, input.text]);
}

export async function listCareerTelegramMessages(requestId: string | number): Promise<CareerTelegramMessage[]> {
  const [rows] = await getDbPool().query<Row[]>('SELECT id, request_id, chat_id, direction, message_text, created_at FROM career_telegram_messages WHERE request_id = ? ORDER BY created_at ASC, id ASC', [Number(requestId)]);
  return rows.map(map);
}

export async function findLatestCareerTelegramRequestId(chatId: string): Promise<string | null> {
  const [rows] = await getDbPool().query<Array<RowDataPacket & { request_id: number }>>('SELECT request_id FROM career_telegram_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1', [chatId]);
  if (rows[0]) return String(rows[0].request_id);
  const [requests] = await getDbPool().query<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM incoming_requests
     WHERE request_type = 'career_application' AND source_page = 'telegram://career-bot'
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.telegramChatId')) = ?
     ORDER BY id DESC LIMIT 1`,
    [chatId]
  );
  return requests[0] ? String(requests[0].id) : null;
}
