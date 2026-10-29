import { createHash } from 'crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { ensureEngineeringSchema, engineeringTask, engineeringUsers, storeEngineeringMail } from '@/lib/engineering-repository';
import { engineeringCard, engineeringKeyboard, engineeringTelegram } from '@/lib/engineering-telegram';
import { readEngineeringSettings } from '@/lib/engineering-settings';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function extractEngineeringTrackingId(subject: string, text: string) {
  const labeled = `${subject}\n${text}`.match(/(?:ідентифікатор\s+відстеження|tracking\s*(?:id|number)|ticket\s*(?:id|number)|номер\s+(?:запиту|заявки)|код\s+запиту)\s*[:#№\-]?\s*([\p{L}\d][\p{L}\d_-]{1,99})/iu);
  const bracketed = subject.match(/\[([A-Z\d]{2,}(?:-[A-Z\d]+)+)\]|#(\d{2,})/i);
  return labeled?.[1] || bracketed?.[1] || bracketed?.[2] || '';
}
export async function runEngineeringMail() {
  const settings = await readEngineeringSettings();
  if (!settings.enabled) return { skipped: true, imported: 0, sent: 0 };
  await ensureEngineeringSchema();
  const connection = await getDbPool().getConnection();
  let locked = false;
  let imported = 0, sent = 0, failed = 0, mailFailed = false;
  try {
    const [locks] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('pchilka_engineering_sync', 0) AS acquired");
    locked = Boolean(locks[0].acquired);
    if (!locked) return { skipped: true, imported, sent };
    const users = await engineeringUsers();
    const targets = new Set(users.filter(user => user.active && user.started).map(user => user.telegram_id));
    if (settings.chatId) targets.add(settings.chatId);
    const client = new ImapFlow({ host: settings.mailHost, port: settings.mailPort, secure: true, auth: { user: settings.mailUser, pass: settings.mailPassword }, logger: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 60000 });
    client.on('error', () => {}); // Errors are returned through the awaited IMAP operation; never log credentials.
    try {
      await client.connect();
      const mailboxLock = await client.getMailboxLock(settings.mailFolder, { readOnly: true });
      try {
        if (!client.mailbox) throw new Error('Поштова папка недоступна.');
        const mailboxKey = hash(`${settings.mailHost}|${settings.mailUser}|${settings.mailFolder}|${client.mailbox.uidValidity}`);
        const upperUid = client.mailbox.uidNext - 1;
        const [cursors] = await connection.query<RowDataPacket[]>('SELECT last_uid FROM engineering_cursors WHERE mailbox_key = ?', [mailboxKey]);
        const lastUid = Number(cursors[0]?.last_uid || 0);
        const found = await client.search({ from: 'legion_admin@legion2015.com', ...(lastUid ? { uid: `${lastUid + 1}:*` } : { since: new Date(Date.now() - 7 * 86400000) }) }, { uid: true });
        const candidates = (found || []).filter(uid => uid > lastUid && uid <= upperUid).sort((a, b) => a - b);
        let processed = lastUid;
        // Fetch and parse a bounded batch, without changing Seen flags.
        for (const uid of candidates.slice(0, 50)) {
          const metadata = await client.fetchOne(uid, { size: true }, { uid: true });
          if (metadata && (metadata.size || 0) > 20 * 1024 * 1024) throw new Error(`Лист UID ${uid} перевищує ліміт 20 МБ.`);
          const mail = await client.fetchOne(uid, { source: true }, { uid: true });
          if (!mail || !mail.source) throw new Error('Не вдалося завантажити лист. Повторимо під час наступної перевірки.');
          if (mail.source.length > 20 * 1024 * 1024) throw new Error(`Лист UID ${uid} перевищує ліміт 20 МБ.`);
          const parsed = await simpleParser(mail.source, { skipHtmlToText: false, skipImageLinks: true });
          if (parsed.from?.value.some(sender => sender.address?.toLowerCase() === 'legion_admin@legion2015.com')) {
            const subject = (parsed.subject || '(Без теми)').slice(0, 500);
            const fullText = parsed.text || '(Текст повідомлення відсутній)';
            const body = fullText.length <= 250000 ? fullText : `${fullText.slice(0, 249900)}\n[Текст скорочено до 250 000 символів. Повний лист доступний у пошті.]`;
            const sourceKey = hash(`${settings.mailHost}|${settings.mailUser}|${parsed.messageId || `${mailboxKey}|${uid}`}`);
            const trackingId = extractEngineeringTrackingId(subject, body) || `MAIL-${sourceKey.slice(0, 16)}`;
            await storeEngineeringMail(connection, sourceKey, trackingId, subject, body, [...targets]);
            imported++;
          }
          processed = uid;
          // Commit progress after each stored email; delivery has its own retry state.
          await connection.query('INSERT INTO engineering_cursors (mailbox_key, last_uid) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_uid = VALUES(last_uid)', [mailboxKey, processed]);
        }
        if (candidates.length <= 50) await connection.query('INSERT INTO engineering_cursors (mailbox_key, last_uid) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_uid = VALUES(last_uid)', [mailboxKey, Math.max(processed, upperUid)]);
      } finally { mailboxLock.release(); }
    } catch { mailFailed = true; }
    finally { await client.logout().catch(() => { client.close(); }); }
    // A durable outbox has no age cutoff. Recipients are captured when each email is imported.
    const [pending] = await connection.query<RowDataPacket[]>(`SELECT * FROM (
      SELECT d.*, m.task_id, m.subject, m.body,
        ROW_NUMBER() OVER (PARTITION BY d.chat_id ORDER BY d.mail_id, d.part) AS queue_position
      FROM engineering_deliveries d JOIN engineering_mail m ON m.id = d.mail_id WHERE d.message_id IS NULL
    ) queue ORDER BY queue_position, chat_id LIMIT 200`);
    const blocked = new Set<string>();
    for (const delivery of pending) {
      const target = String(delivery.chat_id);
      if (blocked.has(target)) continue;
      const task = await engineeringTask(delivery.task_id);
      if (!task) continue;
      const stillAllowed = target === settings.chatId || (await engineeringUsers()).some(user => user.telegram_id === target && user.active && user.started);
      if (!stillAllowed) {
        await connection.query('UPDATE engineering_deliveries SET message_id = -1 WHERE mail_id = ? AND chat_id = ? AND part = ?', [delivery.mail_id, target, delivery.part]);
        continue;
      }
      const part = Number(delivery.part);
      const offset = 2600 + (part - 1) * 3800;
      const text = part === 0 ? engineeringCard({ ...task, subject: delivery.subject, body: delivery.body }) : String(delivery.body).slice(offset, offset + 3800);
      try {
        const message = await engineeringTelegram(settings.botToken, 'sendMessage', { chat_id: target, text, ...(part === 0 ? { reply_markup: engineeringKeyboard(task) } : {}) });
        await connection.query('UPDATE engineering_deliveries SET message_id = ? WHERE mail_id = ? AND chat_id = ? AND part = ?', [message.message_id, delivery.mail_id, target, part]);
        sent++;
      } catch {
        failed++;
        blocked.add(target);
      }
    }
    return { imported, sent, failed, mailFailed };
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK('pchilka_engineering_sync')").catch(() => {});
    connection.release();
  }
}
