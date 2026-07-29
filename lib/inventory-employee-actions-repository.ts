import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { normalizeInventoryUserRole, type InventoryUserRole } from '@/lib/inventory-user-roles';

type BatchCheckActionRow = RowDataPacket & {
  id: number;
  created_at: Date | string;
  store_id: number | null;
  store_label?: string | null;
  user_id: number | null;
  user_name?: string | null;
  batch_id: number | null;
  product_id: number | null;
  product_name?: string | null;
  article?: string | null;
  batch_code?: string | null;
  action?: string | null;
  counted_quantity?: number | null;
  item_condition?: string | null;
  issue_reason?: string | null;
  note?: string | null;
  photo_url?: string | null;
};

type ActivityActionRow = RowDataPacket & {
  id: number;
  created_at: Date | string;
  store_id: number | null;
  store_label?: string | null;
  user_id: number | null;
  user_name?: string | null;
  batch_id: number | null;
  product_id: number | null;
  product_name?: string | null;
  article?: string | null;
  batch_code?: string | null;
  action_type?: string | null;
  comment?: string | null;
  old_quantity?: number | null;
  new_quantity?: number | null;
  old_expiry_date?: Date | string | null;
  new_expiry_date?: Date | string | null;
};

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
  requester_role?: string | null;
  manager_name?: string | null;
  manager_surname?: string | null;
  manager_role?: string | null;
  product_name?: string | null;
  article?: string | null;
  batch_code?: string | null;
  store_label?: string | null;
  closed_by_name?: string | null;
};

type DiscussionMessageRow = RowDataPacket & {
  id: number;
  thread_id: number;
  sender_user_id: number;
  recipient_user_id: number | null;
  sender_role?: string | null;
  channel?: string | null;
  message_text?: string | null;
  created_at: Date | string;
  sender_name?: string | null;
  sender_surname?: string | null;
  recipient_name?: string | null;
  recipient_surname?: string | null;
};

export type InventoryEmployeeActionRecord = {
  id: string;
  source: 'batch_check' | 'activity_log';
  createdAt: string;
  storeId: number | null;
  storeLabel: string;
  userId: number | null;
  userName: string;
  batchId: number | null;
  productId: number | null;
  productName: string;
  article: string;
  batchCode: string;
  title: string;
  details: string;
  photoUrl: string;
};

export type InventoryEmployeeDiscussionMessageRecord = {
  id: number;
  threadId: number;
  senderUserId: number;
  senderName: string;
  senderRole: InventoryUserRole;
  recipientUserId: number | null;
  recipientName: string;
  channel: string;
  messageText: string;
  createdAt: string;
};

export type InventoryEmployeeDiscussionThreadRecord = {
  id: number;
  taskId: number | null;
  batchId: number;
  productId: number;
  storeId: number;
  storeLabel: string;
  productName: string;
  article: string;
  batchCode: string;
  title: string;
  status: 'open' | 'closed';
  requesterUserId: number;
  requesterName: string;
  requesterRole: InventoryUserRole;
  managerUserId: number | null;
  managerName: string;
  managerRole: InventoryUserRole;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  closedAt: string;
  closedByName: string;
  messages: InventoryEmployeeDiscussionMessageRecord[];
};

export type InventoryEmployeeActionsDashboard = {
  actions: InventoryEmployeeActionRecord[];
  discussions: InventoryEmployeeDiscussionThreadRecord[];
  summary: {
    actionsCount: number;
    discussionsCount: number;
    discussionMessagesCount: number;
  };
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function buildActionTitleFromBatchCheck(action: string) {
  switch (action) {
    case 'checked':
      return 'Перевірив партію';
    case 'writeoff':
      return 'Позначив партію на списання';
    case 'discussion_required':
      return 'Відправив партію на обговорення';
    default:
      return action || 'Дія з партією';
  }
}

function buildActionDetailsFromBatchCheck(row: BatchCheckActionRow) {
  return [
    row.counted_quantity != null ? `Факт. кількість: ${row.counted_quantity}` : '',
    row.item_condition ? `Стан: ${row.item_condition}` : '',
    row.issue_reason ? `Причина: ${row.issue_reason}` : '',
    row.note ? `Коментар: ${row.note}` : ''
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildActionTitleFromActivityLog(actionType: string) {
  switch (actionType) {
    case 'batch_expiry_date_corrected':
      return 'Скоригував термін придатності';
    case 'inventory_count_adjustment':
      return 'Провів коригування залишку';
    case 'product_created_from_telegram_intake':
      return 'Створив товар через Telegram intake';
    case 'batch_check_checked':
      return 'Перевірив партію';
    case 'batch_check_writeoff':
      return 'Позначив партію на списання';
    case 'batch_check_discussion_required':
      return 'Відправив партію на обговорення';
    case 'inventory_scanner_start_requested':
      return 'Сканер: запущено';
    case 'inventory_scanner_stream_ready':
      return 'Сканер: камера готова';
    case 'inventory_scanner_video_ready':
      return 'Сканер: відео готове до розпізнавання';
    case 'inventory_scanner_detector_error':
      return 'Сканер: помилка декодера';
    case 'inventory_scanner_barcode_detected':
      return 'Сканер: штрихкод розпізнано';
    case 'inventory_scanner_no_barcode_detected':
      return 'Сканер: штрихкод не розпізнано';
    case 'inventory_scanner_camera_error':
      return 'Сканер: помилка камери';
    default:
      return actionType || 'Дія працівника';
  }
}

function buildActionDetailsFromActivityLog(row: ActivityActionRow) {
  const changes: string[] = [];
  if (row.old_quantity != null || row.new_quantity != null) {
    changes.push(`Кількість: ${row.old_quantity ?? '—'} -> ${row.new_quantity ?? '—'}`);
  }
  if (row.old_expiry_date || row.new_expiry_date) {
    changes.push(`Термін: ${toIso(row.old_expiry_date).slice(0, 10) || '—'} -> ${toIso(row.new_expiry_date).slice(0, 10) || '—'}`);
  }
  if (row.comment && String(row.action_type ?? '') === 'inventory_scanner_barcode_detected') {
    try {
      const scannerMeta = JSON.parse(row.comment) as {
        barcode?: unknown;
        detectionAttempts?: unknown;
        elapsedMs?: unknown;
      };
      const barcode = String(scannerMeta.barcode ?? '').trim();
      const attempts = Number(scannerMeta.detectionAttempts);
      const elapsedMs = Number(scannerMeta.elapsedMs);

      if (barcode) changes.push(`Штрихкод: ${barcode}`);
      if (Number.isFinite(attempts) && attempts > 0) changes.push(`Спроб розпізнавання: ${attempts}`);
      if (Number.isFinite(elapsedMs) && elapsedMs >= 0) changes.push(`Час розпізнавання: ${(elapsedMs / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })} с`);
    } catch {
      changes.push('Штрихкод розпізнано сканером.');
    }
  } else if (row.comment) {
    changes.push(`Коментар: ${row.comment}`);
  }
  return changes.join(' | ');
}

function mapBatchCheckRow(row: BatchCheckActionRow): InventoryEmployeeActionRecord {
  return {
    id: `batch-check:${row.id}`,
    source: 'batch_check',
    createdAt: toIso(row.created_at),
    storeId: row.store_id == null ? null : Number(row.store_id),
    storeLabel: String(row.store_label ?? ''),
    userId: row.user_id == null ? null : Number(row.user_id),
    userName: String(row.user_name ?? ''),
    batchId: row.batch_id == null ? null : Number(row.batch_id),
    productId: row.product_id == null ? null : Number(row.product_id),
    productName: String(row.product_name ?? ''),
    article: String(row.article ?? ''),
    batchCode: String(row.batch_code ?? ''),
    title: buildActionTitleFromBatchCheck(String(row.action ?? '')),
    details: buildActionDetailsFromBatchCheck(row),
    photoUrl: String(row.photo_url ?? '')
  };
}

function mapActivityRow(row: ActivityActionRow): InventoryEmployeeActionRecord {
  return {
    id: `activity-log:${row.id}`,
    source: 'activity_log',
    createdAt: toIso(row.created_at),
    storeId: row.store_id == null ? null : Number(row.store_id),
    storeLabel: String(row.store_label ?? ''),
    userId: row.user_id == null ? null : Number(row.user_id),
    userName: String(row.user_name ?? ''),
    batchId: row.batch_id == null ? null : Number(row.batch_id),
    productId: row.product_id == null ? null : Number(row.product_id),
    productName: String(row.product_name ?? ''),
    article: String(row.article ?? ''),
    batchCode: String(row.batch_code ?? ''),
    title: buildActionTitleFromActivityLog(String(row.action_type ?? '')),
    details: buildActionDetailsFromActivityLog(row),
    photoUrl: ''
  };
}

function mapDiscussionMessageRow(row: DiscussionMessageRow): InventoryEmployeeDiscussionMessageRecord {
  return {
    id: Number(row.id),
    threadId: Number(row.thread_id),
    senderUserId: Number(row.sender_user_id),
    senderName: [row.sender_surname, row.sender_name].filter(Boolean).join(' ').trim(),
    senderRole: normalizeInventoryUserRole(row.sender_role),
    recipientUserId: row.recipient_user_id == null ? null : Number(row.recipient_user_id),
    recipientName: [row.recipient_surname, row.recipient_name].filter(Boolean).join(' ').trim(),
    channel: String(row.channel ?? ''),
    messageText: String(row.message_text ?? ''),
    createdAt: toIso(row.created_at)
  };
}

function mapDiscussionThreadRow(row: DiscussionThreadRow): InventoryEmployeeDiscussionThreadRecord {
  return {
    id: Number(row.id),
    taskId: row.task_id == null ? null : Number(row.task_id),
    batchId: Number(row.batch_id),
    productId: Number(row.product_id),
    storeId: Number(row.store_id),
    storeLabel: String(row.store_label ?? ''),
    productName: String(row.product_name ?? ''),
    article: String(row.article ?? ''),
    batchCode: String(row.batch_code ?? ''),
    title: String(row.title ?? ''),
    status: String(row.status ?? '') === 'closed' ? 'closed' : 'open',
    requesterUserId: Number(row.requester_user_id),
    requesterName: [row.requester_surname, row.requester_name].filter(Boolean).join(' ').trim(),
    requesterRole: normalizeInventoryUserRole(row.requester_role),
    managerUserId: row.manager_user_id == null ? null : Number(row.manager_user_id),
    managerName: [row.manager_surname, row.manager_name].filter(Boolean).join(' ').trim(),
    managerRole: normalizeInventoryUserRole(row.manager_role),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastMessageAt: toIso(row.last_message_at),
    closedAt: toIso(row.closed_at),
    closedByName: String(row.closed_by_name ?? ''),
    messages: []
  };
}

export async function getInventoryEmployeeActionsDashboardFromDb(options?: {
  storeId?: string | number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}) {
  const db = getDbPool();
  const storeId = Number(options?.storeId ?? 0);
  const dateFrom = String(options?.dateFrom ?? '').trim();
  const dateTo = String(options?.dateTo ?? '').trim();
  const limit = Math.min(Math.max(Number(options?.limit ?? 50), 1), 200);

  const buildWhere = (alias: string, createdAtField: string) => {
    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (Number.isFinite(storeId) && storeId > 0) {
      whereClauses.push(`${alias}.store_id = ?`);
      params.push(storeId);
    }
    if (dateFrom) {
      whereClauses.push(`DATE(${createdAtField}) >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push(`DATE(${createdAtField}) <= ?`);
      params.push(dateTo);
    }

    return {
      whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '',
      params
    };
  };

  const batchCheckWhere = buildWhere('bc', 'bc.created_at');
  const activityWhere = buildWhere('al', 'al.created_at');
  const discussionWhere = buildWhere('t', 'COALESCE(t.last_message_at, t.created_at)');

  const [batchCheckRows] = await db.query<BatchCheckActionRow[]>(
    `
      SELECT
        bc.id,
        bc.created_at,
        bc.store_id,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        bc.user_id,
        CONCAT_WS(' ', u.surname, u.name) AS user_name,
        bc.batch_id,
        bc.product_id,
        p.product_name,
        p.article,
        pb.batch_code,
        bc.action,
        bc.counted_quantity,
        bc.item_condition,
        bc.issue_reason,
        bc.note,
        bc.photo_url
      FROM batch_checks bc
      LEFT JOIN users u ON u.id = bc.user_id
      LEFT JOIN product_batches pb ON pb.id = bc.batch_id
      LEFT JOIN products p ON p.id = bc.product_id
      LEFT JOIN stores s ON s.id = bc.store_id
      ${batchCheckWhere.whereSql}
      ORDER BY bc.created_at DESC, bc.id DESC
      LIMIT ?
    `,
    [...batchCheckWhere.params, limit]
  );

  const [activityRows] = await db.query<ActivityActionRow[]>(
    `
      SELECT
        al.id,
        al.created_at,
        al.store_id,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        al.user_id,
        CONCAT_WS(' ', u.surname, u.name) AS user_name,
        al.batch_id,
        al.product_id,
        p.product_name,
        p.article,
        pb.batch_code,
        al.action_type,
        al.comment,
        al.old_quantity,
        al.new_quantity,
        al.old_expiry_date,
        al.new_expiry_date
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN product_batches pb ON pb.id = al.batch_id
      LEFT JOIN products p ON p.id = al.product_id
      LEFT JOIN stores s ON s.id = al.store_id
      ${activityWhere.whereSql}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [...activityWhere.params, limit]
  );

  const [discussionThreadRows] = await db.query<DiscussionThreadRow[]>(
    `
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
        ru.role AS requester_role,
        mu.name AS manager_name,
        mu.surname AS manager_surname,
        mu.role AS manager_role,
        p.product_name,
        p.article,
        pb.batch_code,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        CONCAT_WS(' ', cu.surname, cu.name) AS closed_by_name
      FROM inventory_discussion_threads t
      INNER JOIN users ru ON ru.id = t.requester_user_id
      LEFT JOIN users mu ON mu.id = t.manager_user_id
      LEFT JOIN users cu ON cu.id = t.closed_by_user_id
      INNER JOIN products p ON p.id = t.product_id
      INNER JOIN product_batches pb ON pb.id = t.batch_id
      INNER JOIN stores s ON s.id = t.store_id
      ${discussionWhere.whereSql}
      ORDER BY COALESCE(t.last_message_at, t.created_at) DESC, t.id DESC
      LIMIT ?
    `,
    [...discussionWhere.params, Math.max(limit, 30)]
  );

  const discussions = discussionThreadRows.map(mapDiscussionThreadRow);
  const threadIds = discussions.map((thread) => thread.id);

  let discussionMessagesCount = 0;
  if (threadIds.length > 0) {
    const placeholders = threadIds.map(() => '?').join(', ');
    const [messageRows] = await db.query<DiscussionMessageRow[]>(
      `
        SELECT
          m.id,
          m.thread_id,
          m.sender_user_id,
          m.recipient_user_id,
          m.sender_role,
          m.channel,
          m.message_text,
          m.created_at,
          su.name AS sender_name,
          su.surname AS sender_surname,
          ru.name AS recipient_name,
          ru.surname AS recipient_surname
        FROM inventory_discussion_messages m
        INNER JOIN users su ON su.id = m.sender_user_id
        LEFT JOIN users ru ON ru.id = m.recipient_user_id
        WHERE m.thread_id IN (${placeholders})
        ORDER BY m.created_at ASC, m.id ASC
      `,
      threadIds
    );

    const messagesByThreadId = new Map<number, InventoryEmployeeDiscussionMessageRecord[]>();
    for (const row of messageRows) {
      const message = mapDiscussionMessageRow(row);
      const items = messagesByThreadId.get(message.threadId) ?? [];
      items.push(message);
      messagesByThreadId.set(message.threadId, items);
      discussionMessagesCount += 1;
    }

    for (const thread of discussions) {
      thread.messages = messagesByThreadId.get(thread.id) ?? [];
    }
  }

  const actions = [...batchCheckRows.map(mapBatchCheckRow), ...activityRows.map(mapActivityRow)]
    .sort((a, b) => {
      const left = Date.parse(a.createdAt);
      const right = Date.parse(b.createdAt);
      return right - left;
    })
    .slice(0, limit);

  return {
    actions,
    discussions,
    summary: {
      actionsCount: actions.length,
      discussionsCount: discussions.length,
      discussionMessagesCount
    }
  } satisfies InventoryEmployeeActionsDashboard;
}
