import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export const engineeringSchema = [
  `CREATE TABLE IF NOT EXISTS engineering_users (
    telegram_id VARCHAR(20) PRIMARY KEY, name VARCHAR(160) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
    started BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS engineering_tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, tracking_id VARCHAR(190) NOT NULL UNIQUE,
    subject VARCHAR(500) NOT NULL, body MEDIUMTEXT NOT NULL, status ENUM('new','in_progress','done') NOT NULL DEFAULT 'new',
    assignee_id VARCHAR(20) NULL, assignee_name VARCHAR(160) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS engineering_mail (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, source_key CHAR(64) NOT NULL UNIQUE, task_id INT UNSIGNED NOT NULL,
    subject VARCHAR(500) NOT NULL, body MEDIUMTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY(task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS engineering_deliveries (
    mail_id INT UNSIGNED NOT NULL, chat_id VARCHAR(40) NOT NULL, part INT UNSIGNED NOT NULL,
    message_id BIGINT NULL, PRIMARY KEY(mail_id, chat_id, part)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS engineering_events (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, task_id INT UNSIGNED NOT NULL, actor_id VARCHAR(20) NOT NULL,
    actor_name VARCHAR(160) NOT NULL, action VARCHAR(30) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, KEY(task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS engineering_cursors (
    mailbox_key CHAR(64) PRIMARY KEY, last_uid BIGINT UNSIGNED NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
let ready: Promise<void> | undefined;
export async function ensureEngineeringSchema() {
  ready ??= (async () => { for (const sql of engineeringSchema) await getDbPool().query(sql); })().catch(error => { ready = undefined; throw error; });
  return ready;
}
export type EngineeringTask = RowDataPacket & { id: number; tracking_id: string; subject: string; body: string; status: 'new' | 'in_progress' | 'done'; assignee_id: string | null; assignee_name: string | null };
export type EngineeringUser = RowDataPacket & { telegram_id: string; name: string; active: number; started: number };
export async function engineeringUsers() {
  await ensureEngineeringSchema();
  const [rows] = await getDbPool().query<EngineeringUser[]>('SELECT * FROM engineering_users ORDER BY name');
  return rows;
}
export async function engineeringTasks(filter = 'all', userId = '', page = 0) {
  await ensureEngineeringSchema();
  const where = filter === 'mine' ? 'WHERE assignee_id = ? AND status = \'in_progress\'' : filter === 'new' ? "WHERE status = 'new'" : '';
  const [rows] = await getDbPool().query<EngineeringTask[]>(`SELECT * FROM engineering_tasks ${where} ORDER BY id DESC LIMIT 20 OFFSET ?`, filter === 'mine' ? [userId, page * 20] : [page * 20]);
  return rows;
}
export async function engineeringTask(id: number) {
  const [rows] = await getDbPool().query<EngineeringTask[]>('SELECT * FROM engineering_tasks WHERE id = ?', [id]);
  return rows[0];
}
export async function resetEngineeringTask(id: number, administrator: string) {
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>("UPDATE engineering_tasks SET status = 'new', assignee_id = NULL, assignee_name = NULL WHERE id = ? AND status = 'in_progress'", [id]);
    if (result.affectedRows) await connection.query("INSERT INTO engineering_events (task_id, actor_id, actor_name, action) VALUES (?, 'admin', ?, 'release')", [id, `Адміністратор: ${administrator}`.slice(0, 160)]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function changeEngineeringTask(id: number, actor: string, action: string) {
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.query<EngineeringUser[]>('SELECT * FROM engineering_users WHERE telegram_id = ? AND active = TRUE FOR UPDATE', [actor]);
    if (!users[0]) throw new Error('Доступ відсутній. Зверніться до адміністратора.');
    const [tasks] = await connection.query<EngineeringTask[]>('SELECT * FROM engineering_tasks WHERE id = ? FOR UPDATE', [id]);
    const task = tasks[0];
    if (!task) throw new Error('Завдання не знайдено.');
    if (action === 'claim') {
      if (task.status !== 'new') throw new Error('Це завдання вже взяли в роботу або завершили.');
      await connection.query("UPDATE engineering_tasks SET status = 'in_progress', assignee_id = ?, assignee_name = ? WHERE id = ?", [actor, users[0].name, id]);
    } else {
      if (!['done', 'release'].includes(action) || task.status !== 'in_progress' || task.assignee_id !== actor) throw new Error('Цю дію може виконати лише відповідальний за активне завдання.');
      if (action === 'done') await connection.query("UPDATE engineering_tasks SET status = 'done' WHERE id = ?", [id]);
      else await connection.query("UPDATE engineering_tasks SET status = 'new', assignee_id = NULL, assignee_name = NULL WHERE id = ?", [id]);
    }
    await connection.query('INSERT INTO engineering_events (task_id, actor_id, actor_name, action) VALUES (?, ?, ?, ?)', [id, actor, users[0].name, action]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
export async function storeEngineeringMail(connection: PoolConnection, sourceKey: string, trackingId: string, subject: string, body: string, targets: string[]) {
  await connection.beginTransaction();
  try {
    const [existing] = await connection.query<RowDataPacket[]>('SELECT id FROM engineering_mail WHERE source_key = ?', [sourceKey]);
    if (!existing.length) {
      const [task] = await connection.query<ResultSetHeader>('INSERT INTO engineering_tasks (tracking_id, subject, body) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), subject = VALUES(subject), body = VALUES(body)', [trackingId, subject, body]);
      const [mail] = await connection.query<ResultSetHeader>('INSERT INTO engineering_mail (source_key, task_id, subject, body) VALUES (?, ?, ?, ?)', [sourceKey, task.insertId, subject, body]);
      const partCount = 1 + Math.ceil(Math.max(0, body.length - 2600) / 3800);
      for (const target of targets) for (let part = 0; part < partCount; part++) {
        await connection.query('INSERT INTO engineering_deliveries (mail_id, chat_id, part) VALUES (?, ?, ?)', [mail.insertId, target, part]);
      }
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
}
