import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { normalizeInventoryUserRole, type InventoryUserRole } from '@/lib/inventory-user-roles';

type DiscussionThreadRow = RowDataPacket & {
  id: number;
  task_id: number | null;
  batch_id: number;
  product_id: number;
  store_id: number;
  requester_user_id: number;
  manager_user_id: number | null;
  title: string;
  status: string;
  created_from_action: string;
  closed_at: Date | string | null;
  closed_by_user_id: number | null;
  last_message_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  requester_name?: string | null;
  requester_surname?: string | null;
  requester_chat_id?: string | null;
  requester_role?: string | null;
  manager_name?: string | null;
  manager_surname?: string | null;
  manager_chat_id?: string | null;
  manager_role?: string | null;
  product_name?: string | null;
  batch_code?: string | null;
  store_label?: string | null;
  closed_by_name?: string | null;
};

type DiscussionMessageRow = RowDataPacket & {
  id: number;
  thread_id: number;
  sender_user_id: number;
  recipient_user_id: number | null;
  sender_role: string;
  channel: string;
  message_text: string;
  created_at: Date | string;
};

type DiscussionSessionRow = RowDataPacket & {
  user_id: number;
  thread_id: number;
  session_role: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryDiscussionThreadRecord = {
  id: number;
  taskId: number | null;
  batchId: number;
  productId: number;
  storeId: number;
  requesterUserId: number;
  managerUserId: number | null;
  title: string;
  status: 'open' | 'closed';
  createdFromAction: string;
  closedAt: string;
  closedByUserId: number | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  requesterName: string;
  requesterSurname: string;
  requesterChatId: string;
  requesterRole: InventoryUserRole;
  managerName: string;
  managerSurname: string;
  managerChatId: string;
  managerRole: InventoryUserRole;
  productName: string;
  batchCode: string;
  storeLabel: string;
  closedByName: string;
};

export type InventoryDiscussionMessageRecord = {
  id: number;
  threadId: number;
  senderUserId: number;
  recipientUserId: number | null;
  senderRole: InventoryUserRole;
  channel: string;
  messageText: string;
  createdAt: string;
};

export type InventoryDiscussionSessionRecord = {
  userId: number;
  threadId: number;
  sessionRole: 'requester' | 'manager';
  createdAt: string;
  updatedAt: string;
  thread: InventoryDiscussionThreadRecord | null;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapThreadRow(row: DiscussionThreadRow): InventoryDiscussionThreadRecord {
  return {
    id: row.id,
    taskId: row.task_id ?? null,
    batchId: Number(row.batch_id),
    productId: Number(row.product_id),
    storeId: Number(row.store_id),
    requesterUserId: Number(row.requester_user_id),
    managerUserId: row.manager_user_id ? Number(row.manager_user_id) : null,
    title: String(row.title ?? ''),
    status: String(row.status ?? 'open') === 'closed' ? 'closed' : 'open',
    createdFromAction: String(row.created_from_action ?? ''),
    closedAt: toIso(row.closed_at),
    closedByUserId: row.closed_by_user_id ? Number(row.closed_by_user_id) : null,
    lastMessageAt: toIso(row.last_message_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    requesterName: String(row.requester_name ?? ''),
    requesterSurname: String(row.requester_surname ?? ''),
    requesterChatId: String(row.requester_chat_id ?? ''),
    requesterRole: normalizeInventoryUserRole(row.requester_role),
    managerName: String(row.manager_name ?? ''),
    managerSurname: String(row.manager_surname ?? ''),
    managerChatId: String(row.manager_chat_id ?? ''),
    managerRole: normalizeInventoryUserRole(row.manager_role),
    productName: String(row.product_name ?? ''),
    batchCode: String(row.batch_code ?? ''),
    storeLabel: String(row.store_label ?? ''),
    closedByName: String(row.closed_by_name ?? '')
  };
}

function mapMessageRow(row: DiscussionMessageRow): InventoryDiscussionMessageRecord {
  return {
    id: Number(row.id),
    threadId: Number(row.thread_id),
    senderUserId: Number(row.sender_user_id),
    recipientUserId: row.recipient_user_id ? Number(row.recipient_user_id) : null,
    senderRole: normalizeInventoryUserRole(row.sender_role),
    channel: String(row.channel ?? ''),
    messageText: String(row.message_text ?? ''),
    createdAt: toIso(row.created_at)
  };
}

function buildThreadsSelectSql(whereSql = 'WHERE t.id = ?', limitSql = 'LIMIT 1') {
  return `
    SELECT
      t.id,
      t.task_id,
      t.batch_id,
      t.product_id,
      t.store_id,
      t.requester_user_id,
      t.manager_user_id,
      t.title,
      t.status,
      t.created_from_action,
      t.closed_at,
      t.closed_by_user_id,
      t.last_message_at,
      t.created_at,
      t.updated_at,
      ru.name AS requester_name,
      ru.surname AS requester_surname,
      ru.user_chat_id AS requester_chat_id,
      ru.role AS requester_role,
      mu.name AS manager_name,
      mu.surname AS manager_surname,
      mu.user_chat_id AS manager_chat_id,
      mu.role AS manager_role,
      p.product_name,
      b.batch_code,
      CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
      CONCAT_WS(' ', cu.surname, cu.name) AS closed_by_name
    FROM inventory_discussion_threads t
    INNER JOIN users ru ON ru.id = t.requester_user_id
    LEFT JOIN users mu ON mu.id = t.manager_user_id
    LEFT JOIN users cu ON cu.id = t.closed_by_user_id
    INNER JOIN products p ON p.id = t.product_id
    INNER JOIN product_batches b ON b.id = t.batch_id
    INNER JOIN stores s ON s.id = t.store_id
    ${whereSql}
    ORDER BY t.updated_at DESC, t.id DESC
    ${limitSql}
  `;
}

export async function findInventoryDiscussionThreadByIdInDb(threadId: string | number) {
  const normalizedThreadId = Number(threadId);
  if (!Number.isFinite(normalizedThreadId) || normalizedThreadId <= 0) return null;

  const pool = getDbPool();
  const [rows] = await pool.query<DiscussionThreadRow[]>(
    buildThreadsSelectSql('WHERE t.id = ?', 'LIMIT 1'),
    [normalizedThreadId]
  );

  return rows[0] ? mapThreadRow(rows[0]) : null;
}

export async function createInventoryDiscussionRequestInDb(input: {
  taskId?: number | null;
  batchId: number;
  productId: number;
  storeId: number;
  requesterUserId: number;
  requesterRole: InventoryUserRole;
  title: string;
  messageText: string;
}) {
  const pool = getDbPool();

  const [existingRows] = await pool.query<DiscussionThreadRow[]>(
    buildThreadsSelectSql(
      `
        WHERE
          t.status = 'open'
          AND t.batch_id = ?
          AND t.requester_user_id = ?
          AND (
            (t.task_id IS NULL AND ? IS NULL)
            OR t.task_id = ?
          )
      `,
      'LIMIT 1'
    ),
    [input.batchId, input.requesterUserId, input.taskId ?? null, input.taskId ?? null]
  );

  let threadId = existingRows[0]?.id ?? 0;

  if (!threadId) {
    const [result] = await pool.query<ResultSetHeader>(
      `
        INSERT INTO inventory_discussion_threads (
          task_id,
          batch_id,
          product_id,
          store_id,
          requester_user_id,
          manager_user_id,
          title,
          status,
          created_from_action,
          last_message_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'open', 'discussion_required', NOW())
      `,
      [
        input.taskId ?? null,
        input.batchId,
        input.productId,
        input.storeId,
        input.requesterUserId,
        input.title.trim()
      ]
    );
    threadId = Number(result.insertId);
  } else {
    await pool.query(
      `
        UPDATE inventory_discussion_threads
        SET
          title = ?,
          status = 'open',
          closed_at = NULL,
          closed_by_user_id = NULL,
          last_message_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `,
      [input.title.trim(), threadId]
    );
  }

  const message = await createInventoryDiscussionMessageInDb({
    threadId,
    senderUserId: input.requesterUserId,
    recipientUserId: null,
    senderRole: input.requesterRole,
    channel: 'webapp',
    messageText: input.messageText
  });

  const thread = await findInventoryDiscussionThreadByIdInDb(threadId);
  if (!thread) {
    throw new Error('Не вдалося прочитати discussion thread після створення.');
  }

  return { thread, message };
}

export async function createInventoryDiscussionMessageInDb(input: {
  threadId: number;
  senderUserId: number;
  recipientUserId?: number | null;
  senderRole: InventoryUserRole;
  channel?: string;
  messageText: string;
}) {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO inventory_discussion_messages (
        thread_id,
        sender_user_id,
        recipient_user_id,
        sender_role,
        channel,
        message_text
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      input.threadId,
      input.senderUserId,
      input.recipientUserId ?? null,
      input.senderRole,
      input.channel?.trim() || 'telegram',
      input.messageText.trim()
    ]
  );

  await pool.query(
    `
      UPDATE inventory_discussion_threads
      SET
        last_message_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
    [input.threadId]
  );

  const [rows] = await pool.query<DiscussionMessageRow[]>(
    `
      SELECT id, thread_id, sender_user_id, recipient_user_id, sender_role, channel, message_text, created_at
      FROM inventory_discussion_messages
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося прочитати discussion message після створення.');
  }

  return mapMessageRow(rows[0]);
}

export async function takeInventoryDiscussionThreadInDb(input: {
  threadId: number;
  managerUserId: number;
}) {
  const thread = await findInventoryDiscussionThreadByIdInDb(input.threadId);
  if (!thread) {
    throw new Error('Діалог не знайдено.');
  }
  if (thread.status !== 'open') {
    throw new Error('Діалог уже закрито.');
  }
  if (thread.managerUserId && thread.managerUserId !== input.managerUserId) {
    const managerName = [thread.managerSurname, thread.managerName].filter(Boolean).join(' ').trim();
    throw new Error(managerName ? `Діалог уже веде ${managerName}.` : 'Діалог уже взято в роботу іншим керівником.');
  }

  const pool = getDbPool();
  await pool.query(
    `
      UPDATE inventory_discussion_threads
      SET
        manager_user_id = COALESCE(manager_user_id, ?),
        updated_at = NOW()
      WHERE id = ?
    `,
    [input.managerUserId, input.threadId]
  );

  const refreshed = await findInventoryDiscussionThreadByIdInDb(input.threadId);
  if (!refreshed) {
    throw new Error('Не вдалося прочитати discussion thread після взяття в роботу.');
  }

  return refreshed;
}

export async function closeInventoryDiscussionThreadInDb(input: {
  threadId: number;
  closedByUserId: number;
}) {
  const pool = getDbPool();
  await pool.query(
    `
      UPDATE inventory_discussion_threads
      SET
        status = 'closed',
        closed_at = COALESCE(closed_at, NOW()),
        closed_by_user_id = COALESCE(closed_by_user_id, ?),
        updated_at = NOW()
      WHERE id = ?
    `,
    [input.closedByUserId, input.threadId]
  );

  const thread = await findInventoryDiscussionThreadByIdInDb(input.threadId);
  if (!thread) {
    throw new Error('Не вдалося прочитати discussion thread після закриття.');
  }

  return thread;
}

export async function activateInventoryDiscussionSessionInDb(input: {
  userId: number;
  threadId: number;
  sessionRole: 'requester' | 'manager';
}) {
  const pool = getDbPool();
  await pool.query(
    `
      INSERT INTO inventory_discussion_sessions (
        user_id,
        thread_id,
        session_role
      ) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        thread_id = VALUES(thread_id),
        session_role = VALUES(session_role),
        updated_at = NOW()
    `,
    [input.userId, input.threadId, input.sessionRole]
  );
}

export async function clearInventoryDiscussionSessionInDb(userId: number) {
  if (!Number.isFinite(userId) || userId <= 0) return;
  const pool = getDbPool();
  await pool.query('DELETE FROM inventory_discussion_sessions WHERE user_id = ?', [userId]);
}

export async function clearInventoryDiscussionSessionsByThreadIdInDb(threadId: number) {
  if (!Number.isFinite(threadId) || threadId <= 0) return;
  const pool = getDbPool();
  await pool.query('DELETE FROM inventory_discussion_sessions WHERE thread_id = ?', [threadId]);
}

export async function findActiveInventoryDiscussionSessionByUserIdInDb(userId: number) {
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const pool = getDbPool();
  const [rows] = await pool.query<DiscussionSessionRow[]>(
    `
      SELECT user_id, thread_id, session_role, created_at, updated_at
      FROM inventory_discussion_sessions
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  const row = rows[0];
  if (!row) return null;

  const thread = await findInventoryDiscussionThreadByIdInDb(row.thread_id);

  return {
    userId: Number(row.user_id),
    threadId: Number(row.thread_id),
    sessionRole: String(row.session_role) === 'manager' ? 'manager' : 'requester',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    thread
  } satisfies InventoryDiscussionSessionRecord;
}
