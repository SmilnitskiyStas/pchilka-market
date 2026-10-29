import { createHash, randomBytes } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { ensureEngineeringSchema, type EngineeringUser } from '@/lib/engineering-repository';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
type Invite = RowDataPacket & { id: number; name: string; used_by: string | null; revoked: number; expired: number };
export async function createEngineeringInvite(name: string) {
  await ensureEngineeringSchema();
  const token = randomBytes(32).toString('base64url');
  const [result] = await getDbPool().query<ResultSetHeader>('INSERT INTO engineering_invites (token_hash, name, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))', [hash(token), name]);
  return { id: result.insertId, name, url: `https://t.me/engineering_dep_pchilka_bot?start=eng_${token}` };
}
export async function listEngineeringInvites() {
  await ensureEngineeringSchema();
  const [rows] = await getDbPool().query<RowDataPacket[]>('SELECT id, name, used_by, revoked, created_at, expires_at, used_at, expires_at <= UTC_TIMESTAMP() AS expired FROM engineering_invites ORDER BY id DESC LIMIT 50');
  return rows;
}
export async function revokeEngineeringInvite(id: number) {
  await ensureEngineeringSchema();
  await getDbPool().query('UPDATE engineering_invites SET revoked = TRUE WHERE id = ? AND used_by IS NULL', [id]);
}
export async function removeEngineeringUser(telegramId: string) {
  await ensureEngineeringSchema();
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    // Remove outstanding invitations for this employee as well as their existing access.
    await connection.query('UPDATE engineering_invites SET revoked = TRUE WHERE used_by = ? OR (used_by IS NULL AND name IN (SELECT name FROM engineering_users WHERE telegram_id = ?))', [telegramId, telegramId]);
    await connection.query('UPDATE engineering_users SET active = FALSE, started = FALSE WHERE telegram_id = ?', [telegramId]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
class InviteUnavailable extends Error {}
export async function acceptEngineeringInvite(token: string, telegramId: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^\d{1,20}$/.test(telegramId)) return { ok: false, error: 'Посилання запрошення недійсне. Попросіть адміністратора створити нове.' };
  await ensureEngineeringSchema();
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    const [invites] = await connection.query<Invite[]>('SELECT *, expires_at <= UTC_TIMESTAMP() AS expired FROM engineering_invites WHERE token_hash = ? FOR UPDATE', [hash(token)]);
    const invite = invites[0];
    if (!invite || invite.revoked || (invite.used_by && invite.used_by !== telegramId)) throw new InviteUnavailable('Запрошення вже використане або скасоване. Попросіть адміністратора створити нове.');
    const [users] = await connection.query<EngineeringUser[]>('SELECT * FROM engineering_users WHERE telegram_id = ? FOR UPDATE', [telegramId]);
    if (invite.used_by === telegramId) {
      // Retried Telegram updates may reopen the same invitation, but cannot restore removed access.
      if (!users[0]?.active) throw new InviteUnavailable('Ваш доступ видалено. Попросіть адміністратора надіслати нове запрошення.');
      await connection.commit();
      return { ok: true };
    }
    if (invite.expired) throw new InviteUnavailable('Строк дії запрошення минув. Попросіть адміністратора створити нове.');
    if (users[0]?.active) throw new InviteUnavailable('Ви вже маєте доступ. Відкрийте список завдань командою /start без посилання.');
    await connection.query('INSERT INTO engineering_users (telegram_id, name, active, started) VALUES (?, ?, TRUE, TRUE) ON DUPLICATE KEY UPDATE name = VALUES(name), active = TRUE, started = TRUE', [telegramId, invite.name]);
    await connection.query('UPDATE engineering_invites SET used_by = ?, used_at = UTC_TIMESTAMP() WHERE id = ?', [telegramId, invite.id]);
    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    if (error instanceof InviteUnavailable) return { ok: false, error: error.message };
    throw error;
  } finally { connection.release(); }
}
