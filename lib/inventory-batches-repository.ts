import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  normalizeInventoryBatchInput,
  type InventoryBatchInput,
  type InventoryBatchRecord
} from '@/lib/inventory-batch-types';

type BatchRow = RowDataPacket & {
  id: number;
  product_id: number;
  product_name: string;
  article: string;
  barcode_list?: string | null;
  store_id: number;
  batch_code: string | null;
  store_code: string | null;
  city: string;
  address_line: string;
  quantity: number;
  quantity_received: number;
  quantity_current: number;
  batch_status: string;
  expiry_date: string;
  delivery_date: string | null;
  notified: number;
  notified_at: Date | string | null;
  notified_days: number;
  check_status: string;
  checked_at: Date | string | null;
  action_taken: string | null;
  action_note: string | null;
  checked_followup_action: string | null;
  responsible_user_id: number | null;
  responsible_user_name: string | null;
  responsible_user_surname: string | null;
  created_by_user_id: number | null;
  created_by_user_name: string | null;
  created_by_user_surname: string | null;
  discussion_required: number;
  discussion_note: string | null;
  admin_decision: string | null;
  admin_decision_note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type InventoryOpenBatchCodeRecord = {
  batchCode: string;
  itemCount: number;
  totalQuantity: number;
  latestCreatedAt: string;
};

type OpenBatchCodeRow = RowDataPacket & {
  batch_code: string;
  item_count: number;
  total_quantity: number;
  latest_created_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapRow(row: BatchRow): InventoryBatchRecord {
  const barcode = String(row.barcode_list ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');

  return {
    id: String(row.id),
    productId: String(row.product_id),
    productName: row.product_name,
    article: row.article,
    barcode,
    storeId: String(row.store_id),
    storeLabel: [row.store_code, row.city, row.address_line].filter(Boolean).join(' | '),
    batchCode: row.batch_code ?? '',
    quantity: Number(row.quantity_current ?? row.quantity ?? 0),
    quantityReceived: Number(row.quantity_received ?? row.quantity ?? 0),
    quantityCurrent: Number(row.quantity_current ?? row.quantity ?? 0),
    batchStatus: row.batch_status ?? 'active',
    expiryDate: String(row.expiry_date ?? ''),
    deliveryDate: String(row.delivery_date ?? ''),
    notifiedDays: Number(row.notified_days ?? 7),
    checkStatus: row.check_status,
    actionTaken: row.action_taken ?? '',
    actionNote: row.action_note ?? '',
    checkedFollowupAction: row.checked_followup_action ?? '',
    responsibleUserId: row.responsible_user_id == null ? '' : String(row.responsible_user_id),
    responsibleUserName: [row.responsible_user_name, row.responsible_user_surname].filter(Boolean).join(' '),
    createdByUserId: row.created_by_user_id == null ? '' : String(row.created_by_user_id),
    createdByUserName: [row.created_by_user_name, row.created_by_user_surname].filter(Boolean).join(' '),
    discussionRequired: row.discussion_required === 1,
    discussionNote: row.discussion_note ?? '',
    adminDecision: row.admin_decision ?? '',
    adminDecisionNote: row.admin_decision_note ?? '',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

type InventoryDbExecutor = Pool | PoolConnection;

type CreateInventoryBatchOptions = {
  createdByUserId?: number | null;
  updatedByUserId?: number | null;
  responsibleUserId?: number | null;
};

function buildBatchSelectSql(whereSql: string) {
  return `
      SELECT
        pb.id,
        pb.product_id,
        p.product_name,
        p.article,
        GROUP_CONCAT(DISTINCT pbc.barcode ORDER BY pbc.id ASC SEPARATOR ',') AS barcode_list,
        pb.store_id,
        pb.batch_code,
        s.store_code,
        s.city,
        s.address_line,
        pb.quantity,
        pb.quantity_received,
        pb.quantity_current,
        pb.batch_status,
        DATE_FORMAT(pb.expiry_date, '%Y-%m-%d') AS expiry_date,
        DATE_FORMAT(pb.delivery_date, '%Y-%m-%d') AS delivery_date,
        pb.notified_days,
        pb.check_status,
        pb.action_taken,
        pb.action_note,
        pb.checked_followup_action,
        pb.responsible_user_id,
        ru.name AS responsible_user_name,
        ru.surname AS responsible_user_surname,
        pb.created_by_user_id,
        cu.name AS created_by_user_name,
        cu.surname AS created_by_user_surname,
        pb.discussion_required,
        pb.discussion_note,
        pb.admin_decision,
        pb.admin_decision_note,
        pb.created_at,
        pb.updated_at
      FROM product_batches pb
      INNER JOIN products p ON p.id = pb.product_id
      LEFT JOIN product_barcodes pbc ON pbc.product_id = p.id
      INNER JOIN stores s ON s.id = pb.store_id
      LEFT JOIN users ru ON ru.id = pb.responsible_user_id
      LEFT JOIN users cu ON cu.id = pb.created_by_user_id
      ${whereSql}
      GROUP BY
        pb.id,
        pb.product_id,
        p.product_name,
        p.article,
        pb.store_id,
        pb.batch_code,
        s.store_code,
        s.city,
        s.address_line,
        pb.quantity,
        pb.quantity_received,
        pb.quantity_current,
        pb.batch_status,
        pb.expiry_date,
        pb.delivery_date,
        pb.notified_days,
        pb.check_status,
        pb.action_taken,
        pb.action_note,
        pb.checked_followup_action,
        pb.responsible_user_id,
        ru.name,
        ru.surname,
        pb.created_by_user_id,
        cu.name,
        cu.surname,
        pb.discussion_required,
        pb.discussion_note,
        pb.admin_decision,
        pb.admin_decision_note,
        pb.created_at,
        pb.updated_at
  `;
}

export async function listInventoryBatchesFromDb(limit = 200, storeId?: string | number | null): Promise<InventoryBatchRecord[]> {
  const pool = getDbPool();
  const normalizedStoreId = Number(storeId);
  const values: Array<number> = [];
  const whereSql =
    Number.isFinite(normalizedStoreId) && normalizedStoreId > 0
      ? 'WHERE pb.store_id = ?'
      : '';

  if (whereSql) {
    values.push(normalizedStoreId);
  }
  values.push(Math.min(Math.max(limit, 1), 5000));

  const [rows] = await pool.query<BatchRow[]>(
    `
      ${buildBatchSelectSql(whereSql)}
      ORDER BY pb.created_at DESC, pb.id DESC
      LIMIT ?
    `,
    values
  );

  return rows.map(mapRow);
}

export async function listInventoryBatchesPageFromDb(input?: {
  limit?: number;
  storeId?: string | number | null;
  cursorBatchId?: string | number | null;
}): Promise<InventoryBatchRecord[]> {
  const pool = getDbPool();
  const normalizedStoreId = Number(input?.storeId);
  const normalizedCursorBatchId = Number(input?.cursorBatchId);
  const limit = Math.min(Math.max(Number(input?.limit ?? 500), 1), 1000);
  const whereClauses: string[] = [];
  const values: number[] = [];

  if (Number.isFinite(normalizedStoreId) && normalizedStoreId > 0) {
    whereClauses.push('pb.store_id = ?');
    values.push(normalizedStoreId);
  }

  if (Number.isFinite(normalizedCursorBatchId) && normalizedCursorBatchId > 0) {
    whereClauses.push('pb.id < ?');
    values.push(normalizedCursorBatchId);
  }

  values.push(limit);

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await pool.query<BatchRow[]>(
    `
      ${buildBatchSelectSql(whereSql)}
      ORDER BY pb.id DESC
      LIMIT ?
    `,
    values
  );

  return rows.map(mapRow);
}

export async function findInventoryBatchByIdInDb(batchId: string | number): Promise<InventoryBatchRecord | null> {
  const pool = getDbPool();
  const normalizedBatchId = Number(batchId);
  if (!Number.isFinite(normalizedBatchId) || normalizedBatchId <= 0) {
    return null;
  }

  const [rows] = await pool.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.id = ?')}
      LIMIT 1
    `,
    [normalizedBatchId]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export type InventoryNotificationBatchCandidate = InventoryBatchRecord & {
  responsibleUserDbId: number | null;
  isRepeatReminder: boolean;
};

type InventoryNotificationBatchRow = BatchRow & {
  responsible_user_db_id: number | null;
  is_repeat_reminder: number;
};

export async function findInventoryDuplicateBatchInDb(
  input: { storeId?: string | number; productId?: string | number; expiryDate?: string },
  executor?: InventoryDbExecutor
): Promise<InventoryBatchRecord | null> {
  const db = executor ?? getDbPool();
  const storeId = Number(input.storeId);
  const productId = Number(input.productId);
  const expiryDate = String(input.expiryDate ?? '').trim();

  if (!Number.isFinite(storeId) || storeId <= 0) {
    return null;
  }
  if (!Number.isFinite(productId) || productId <= 0) {
    return null;
  }
  if (!expiryDate) {
    return null;
  }

  const [rows] = await db.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.store_id = ? AND pb.product_id = ? AND pb.expiry_date = ?')}
      ORDER BY pb.created_at DESC, pb.id DESC
      LIMIT 1
    `,
    [storeId, productId, expiryDate]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listInventoryNotificationCandidatesFromDb(limit = 100): Promise<InventoryNotificationBatchCandidate[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<InventoryNotificationBatchRow[]>(
    `
      SELECT
        pb.id,
        pb.product_id,
        p.product_name,
        p.article,
        pb.store_id,
        pb.batch_code,
        s.store_code,
        s.city,
        s.address_line,
        pb.quantity_current AS quantity,
        pb.quantity_received,
        pb.quantity_current,
        pb.batch_status,
        DATE_FORMAT(pb.expiry_date, '%Y-%m-%d') AS expiry_date,
        DATE_FORMAT(pb.delivery_date, '%Y-%m-%d') AS delivery_date,
        pb.notified,
        pb.notified_at,
        pb.notified_days,
        pb.check_status,
        pb.checked_at,
        pb.action_taken,
        pb.action_note,
        pb.responsible_user_id,
        pb.responsible_user_id AS responsible_user_db_id,
        CASE WHEN pb.notified = 1 THEN 1 ELSE 0 END AS is_repeat_reminder,
        ru.name AS responsible_user_name,
        ru.surname AS responsible_user_surname,
        pb.created_by_user_id,
        cu.name AS created_by_user_name,
        cu.surname AS created_by_user_surname,
        pb.discussion_required,
        pb.discussion_note,
        pb.admin_decision,
        pb.admin_decision_note,
        pb.created_at,
        pb.updated_at
      FROM product_batches pb
      INNER JOIN products p ON p.id = pb.product_id
      INNER JOIN stores s ON s.id = pb.store_id
      LEFT JOIN users ru ON ru.id = pb.responsible_user_id
      LEFT JOIN users cu ON cu.id = pb.created_by_user_id
      WHERE
        pb.quantity_current > 0
        AND DATEDIFF(pb.expiry_date, CURDATE()) <= pb.notified_days
        AND (
          pb.notified = 0
          OR (
            pb.notified = 1
            AND pb.notified_at IS NOT NULL
            AND DATE(pb.notified_at) < CURDATE()
            AND (pb.checked_at IS NULL OR pb.checked_at <= pb.notified_at)
          )
        )
      ORDER BY pb.expiry_date ASC, pb.id ASC
      LIMIT ?
    `,
    [Math.min(Math.max(limit, 1), 500)]
  );

  return rows.map((row) => ({
    ...mapRow(row),
    responsibleUserDbId: row.responsible_user_db_id,
    isRepeatReminder: row.is_repeat_reminder === 1
  }));
}

export async function markInventoryBatchNotifiedInDb(batchId: string | number): Promise<void> {
  const pool = getDbPool();
  const normalizedBatchId = Number(batchId);
  if (!Number.isFinite(normalizedBatchId) || normalizedBatchId <= 0) {
    throw new Error('Некоректний batchId.');
  }

  await pool.query(
    `
      UPDATE product_batches
      SET notified = 1, notified_at = NOW()
      WHERE id = ?
    `,
    [normalizedBatchId]
  );
}

export async function findLatestInventoryBatchCodeForStoreInDb(storeId: string | number): Promise<string> {
  const pool = getDbPool();
  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    return '';
  }

  const [rows] = await pool.query<Array<RowDataPacket & { batch_code: string | null }>>(
    `
      SELECT batch_code
      FROM product_batches
      WHERE
        store_id = ?
        AND batch_code IS NOT NULL
        AND TRIM(batch_code) <> ''
        AND DATE(created_at) = CURDATE()
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [normalizedStoreId]
  );

  return String(rows[0]?.batch_code ?? '').trim();
}

export async function listOpenInventoryBatchCodesForStoreInDb(
  storeId: string | number,
  executor?: InventoryDbExecutor
): Promise<InventoryOpenBatchCodeRecord[]> {
  const db = executor ?? getDbPool();
  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    return [];
  }

  const [rows] = await db.query<OpenBatchCodeRow[]>(
    `
      SELECT
        batch_code,
        COUNT(*) AS item_count,
        COALESCE(SUM(quantity_current), 0) AS total_quantity,
        MAX(created_at) AS latest_created_at
      FROM product_batches
      WHERE
        store_id = ?
        AND batch_code IS NOT NULL
        AND TRIM(batch_code) <> ''
        AND DATE(created_at) = CURDATE()
      GROUP BY batch_code
      ORDER BY latest_created_at DESC, batch_code DESC
    `,
    [normalizedStoreId]
  );

  return rows.map((row) => ({
    batchCode: String(row.batch_code),
    itemCount: Number(row.item_count ?? 0),
    totalQuantity: Number(row.total_quantity ?? 0),
    latestCreatedAt: toIso(row.latest_created_at)
  }));
}

export async function generateNextInventoryBatchCodeForStoreInDb(
  storeId: string | number,
  executor?: InventoryDbExecutor
): Promise<string> {
  const db = executor ?? getDbPool();
  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    throw new Error('Некоректний storeId.');
  }

  const [storeRows] = await db.query<Array<RowDataPacket & { store_code: string | null; batch_date: string }>>(
    `
      SELECT store_code, DATE_FORMAT(CURDATE(), '%Y%m%d') AS batch_date
      FROM stores
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedStoreId]
  );

  const batchDate = String(storeRows[0]?.batch_date ?? '');
  const rawStoreCode = String(storeRows[0]?.store_code ?? `STORE${normalizedStoreId}`);
  const safeStoreCode = rawStoreCode
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  const prefix = `${safeStoreCode || `STORE${normalizedStoreId}`}-${batchDate}`;

  const [sequenceRows] = await db.query<Array<RowDataPacket & { max_sequence: number | null }>>(
    `
      SELECT MAX(CAST(SUBSTRING_INDEX(batch_code, '-', -1) AS UNSIGNED)) AS max_sequence
      FROM product_batches
      WHERE
        store_id = ?
        AND batch_code LIKE ?
        AND DATE(created_at) = CURDATE()
    `,
    [normalizedStoreId, `${prefix}-%`]
  );

  const nextSequence = Number(sequenceRows[0]?.max_sequence ?? 0) + 1;
  return `${prefix}-${String(nextSequence).padStart(2, '0')}`;
}

export async function createInventoryBatchInDb(
  input: InventoryBatchInput,
  executor?: InventoryDbExecutor,
  options?: CreateInventoryBatchOptions
): Promise<InventoryBatchRecord> {
  const normalized = normalizeInventoryBatchInput(input);
  const db = executor ?? getDbPool();

  const productId = Number(normalized.productId);
  const storeId = Number(normalized.storeId);
  if (!Number.isFinite(productId) || productId <= 0) {
    throw new Error('Некоректний productId.');
  }
  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new Error('Некоректний storeId.');
  }
  if (!normalized.expiryDate) {
    throw new Error('Вкажіть expiry date.');
  }
  if (normalized.quantity <= 0) {
    throw new Error('Кількість має бути більшою за 0.');
  }

  if (!executor && !normalized.batchCode) {
    const pool = getDbPool();
    const connection = await pool.getConnection();
    const lockName = `inventory_batch_code:${storeId}`;

    try {
      await connection.query('SELECT GET_LOCK(?, 10)', [lockName]);
      const generatedBatchCode = await generateNextInventoryBatchCodeForStoreInDb(storeId, connection);
      return await createInventoryBatchInDb({ ...normalized, batchCode: generatedBatchCode }, connection, options);
    } finally {
      await connection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
      connection.release();
    }
  }

  if (executor && !normalized.batchCode) {
    normalized.batchCode = await generateNextInventoryBatchCodeForStoreInDb(storeId, executor);
  }

  const [productRows] = await db.query<Array<RowDataPacket & { notified_days_default: number | null }>>(
    'SELECT notified_days_default FROM products WHERE id = ? LIMIT 1',
    [productId]
  );
  if (productRows.length === 0) {
    throw new Error('Товар не знайдено.');
  }

  const notifiedDays = normalized.notifiedDays ?? Number(productRows[0].notified_days_default ?? 7);
  const createdByUserId =
    options?.createdByUserId != null && Number.isFinite(Number(options.createdByUserId))
      ? Number(options.createdByUserId)
      : null;
  const updatedByUserId =
    options?.updatedByUserId != null && Number.isFinite(Number(options.updatedByUserId))
      ? Number(options.updatedByUserId)
      : createdByUserId;
  const responsibleUserId =
    options?.responsibleUserId != null && Number.isFinite(Number(options.responsibleUserId))
      ? Number(options.responsibleUserId)
      : null;

  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO product_batches (
        product_id,
        store_id,
        batch_code,
        quantity,
        quantity_received,
        quantity_current,
        batch_status,
        expiry_date,
        delivery_date,
        notified_days,
        check_status,
        notified,
        discussion_required,
        responsible_user_id,
        created_by_user_id,
        updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 0, 0, ?, ?, ?)
    `,
    [
      productId,
      storeId,
      normalized.batchCode || null,
      normalized.quantity,
      normalized.quantityReceived > 0 ? normalized.quantityReceived : normalized.quantity,
      normalized.quantity,
      'active',
      normalized.expiryDate,
      normalized.deliveryDate || null,
      notifiedDays,
      responsibleUserId,
      createdByUserId,
      updatedByUserId
    ]
  );

  const [rows] = await db.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.id = ?')}
      LIMIT 1
    `,
    [result.insertId]
  );

  if (rows.length === 0) {
    throw new Error('Не вдалося прочитати створену партію.');
  }

  return mapRow(rows[0]);
}

export async function mergeInventoryBatchQuantityInDb(
  input: {
    batchId: string | number;
    quantity: number;
    batchCode?: string;
    deliveryDate?: string;
    notifiedDays?: number | string | null;
  },
  executor?: InventoryDbExecutor,
  options?: Pick<CreateInventoryBatchOptions, 'updatedByUserId' | 'responsibleUserId'>
): Promise<InventoryBatchRecord> {
  const db = executor ?? getDbPool();
  const batchId = Number(input.batchId);
  const quantity = Math.max(Math.round(Number(input.quantity ?? 0)), 0);
  const batchCode = String(input.batchCode ?? '').trim();
  const deliveryDate = String(input.deliveryDate ?? '').trim();
  const notifiedDaysRaw = input.notifiedDays;
  const notifiedDays =
    notifiedDaysRaw == null || notifiedDaysRaw === '' ? null : Math.min(Math.max(Math.round(Number(notifiedDaysRaw)), 1), 90);
  const updatedByUserId =
    options?.updatedByUserId != null && Number.isFinite(Number(options.updatedByUserId))
      ? Number(options.updatedByUserId)
      : null;
  const responsibleUserId =
    options?.responsibleUserId != null && Number.isFinite(Number(options.responsibleUserId))
      ? Number(options.responsibleUserId)
      : null;

  if (!Number.isFinite(batchId) || batchId <= 0) {
    throw new Error('РќРµРєРѕСЂРµРєС‚РЅРёР№ batchId.');
  }
  if (quantity <= 0) {
    throw new Error('РљС–Р»СЊРєС–СЃС‚СЊ РјР°С” Р±СѓС‚Рё Р±С–Р»СЊС€РѕСЋ Р·Р° 0.');
  }

  await db.query(
    `
      UPDATE product_batches
      SET
        quantity = quantity + ?,
        quantity_received = quantity_received + ?,
        quantity_current = quantity_current + ?,
        batch_status = CASE
          WHEN quantity_current + ? <= 0 THEN 'closed'
          ELSE 'active'
        END,
        batch_code = CASE
          WHEN (batch_code IS NULL OR TRIM(batch_code) = '') AND ? <> '' THEN ?
          ELSE batch_code
        END,
        delivery_date = CASE
          WHEN (delivery_date IS NULL) AND ? <> '' THEN ?
          ELSE delivery_date
        END,
        notified_days = CASE
          WHEN ? IS NULL THEN notified_days
          ELSE ?
        END,
        responsible_user_id = COALESCE(responsible_user_id, ?),
        updated_by_user_id = COALESCE(?, updated_by_user_id),
        updated_at = NOW()
      WHERE id = ?
    `,
    [
      quantity,
      quantity,
      quantity,
      quantity,
      batchCode,
      batchCode || null,
      deliveryDate,
      deliveryDate || null,
      notifiedDays,
      notifiedDays,
      responsibleUserId,
      updatedByUserId,
      batchId
    ]
  );

  const [rows] = await db.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.id = ?')}
      LIMIT 1
    `,
    [batchId]
  );

  if (rows.length === 0) {
    throw new Error('РќРµ РІРґР°Р»РѕСЃСЏ РїСЂРѕС‡РёС‚Р°С‚Рё РѕРЅРѕРІР»РµРЅСѓ РїР°СЂС‚С–СЋ.');
  }

  return mapRow(rows[0]);
}

export async function reassignInventoryBatchResponsibleInDb(input: {
  batchId: string | number;
  responsibleUserId?: string | number | null;
  storeId?: string | number | null;
}): Promise<InventoryBatchRecord> {
  const pool = getDbPool();
  const batchId = Number(input.batchId);
  const responsibleUserId =
    input.responsibleUserId == null || input.responsibleUserId === '' ? null : Number(input.responsibleUserId);
  const scopedStoreId =
    input.storeId == null || input.storeId === '' ? null : Number(input.storeId);

  if (!Number.isFinite(batchId) || batchId <= 0) {
    throw new Error('Некоректний batchId.');
  }

  const [batchRows] = await pool.query<Array<RowDataPacket & { store_id: number; responsible_user_id: number | null }>>(
    'SELECT store_id, responsible_user_id FROM product_batches WHERE id = ? LIMIT 1',
    [batchId]
  );
  if (batchRows.length === 0) {
    throw new Error('Партію не знайдено.');
  }

  if (scopedStoreId != null && (!Number.isFinite(scopedStoreId) || scopedStoreId <= 0 || batchRows[0].store_id !== scopedStoreId)) {
    throw new Error('РџР°СЂС‚С–СЋ С†СЊРѕРіРѕ РјР°РіР°Р·РёРЅСѓ РЅРµ Р·РЅР°Р№РґРµРЅРѕ.');
  }

  if (responsibleUserId != null) {
    if (!Number.isFinite(responsibleUserId) || responsibleUserId <= 0) {
      throw new Error('Некоректний responsibleUserId.');
    }

    const [userRows] = await pool.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM users
        WHERE id = ? AND store_id = ? AND is_active = 1
        LIMIT 1
      `,
      [responsibleUserId, batchRows[0].store_id]
    );

    if (userRows.length === 0) {
      throw new Error('Можна призначати лише активного працівника з цього ж магазину.');
    }
  }

  const previousResponsibleUserId = batchRows[0].responsible_user_id;
  const responsibleChanged = previousResponsibleUserId !== responsibleUserId;

  await pool.query(
    `
      UPDATE product_batches
      SET
        responsible_user_id = ?,
        notified = CASE WHEN ? = 1 THEN 0 ELSE notified END,
        notified_at = CASE WHEN ? = 1 THEN NULL ELSE notified_at END
      WHERE id = ?
    `,
    [responsibleUserId, responsibleChanged ? 1 : 0, responsibleChanged ? 1 : 0, batchId]
  );

  const [rows] = await pool.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.id = ?')}
      LIMIT 1
    `,
    [batchId]
  );

  if (rows.length === 0) {
    throw new Error('Не вдалося прочитати оновлену партію.');
  }

  return mapRow(rows[0]);
}

export async function updateInventoryBatchCheckActionInDb(input: {
  batchId: string | number;
  userId: string | number;
  storeId: string | number;
  action: 'checked' | 'writeoff' | 'discussion_required';
  note?: string | null;
  checkedFollowupAction?: 'left_on_shelf' | 'removed_from_shelf' | 'other' | null;
}): Promise<InventoryBatchRecord> {
  const pool = getDbPool();
  const batchId = Number(input.batchId);
  const userId = Number(input.userId);
  const storeId = Number(input.storeId);
  const note = String(input.note ?? '').trim();
  const checkedFollowupAction = String(input.checkedFollowupAction ?? '').trim();

  if (!Number.isFinite(batchId) || batchId <= 0) {
    throw new Error('Некоректний batchId.');
  }
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Некоректний userId.');
  }
  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new Error('Некоректний storeId.');
  }

  const [batchRows] = await pool.query<Array<RowDataPacket & { id: number; store_id: number }>>(
    `
      SELECT id, store_id
      FROM product_batches
      WHERE id = ?
      LIMIT 1
    `,
    [batchId]
  );

  if (batchRows.length === 0) {
    throw new Error('Партію не знайдено.');
  }
  if (batchRows[0].store_id !== storeId) {
    throw new Error('Немає доступу до партії іншого магазину.');
  }

  const nextCheckStatus = input.action;
  const nextActionTaken = input.action;
  const nextCheckedFollowupAction = input.action === 'checked' ? checkedFollowupAction || null : null;
  const discussionRequired = input.action === 'discussion_required' ? 1 : 0;
  const discussionNote = input.action === 'discussion_required' ? note || null : null;
  const discussionRequestedByUserId = input.action === 'discussion_required' ? userId : null;

  await pool.query(
    `
      UPDATE product_batches
      SET
        check_status = ?,
        checked_by_user_id = ?,
        checked_at = NOW(),
        action_taken = ?,
        action_note = ?,
        checked_followup_action = ?,
        batch_status = CASE
          WHEN ? = 'writeoff' THEN 'writeoff_pending'
          WHEN ? = 'discussion_required' THEN 'hold'
          WHEN ? = 'checked' AND ? = 'removed_from_shelf' THEN 'closed'
          WHEN quantity_current <= 0 THEN 'closed'
          ELSE 'active'
        END,
        discussion_required = ?,
        discussion_note = ?,
        discussion_requested_by_user_id = ?,
        discussion_requested_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
        updated_by_user_id = ?
      WHERE id = ?
    `,
    [
      nextCheckStatus,
      userId,
      nextActionTaken,
      note || null,
      nextCheckedFollowupAction,
      input.action,
      input.action,
      input.action,
      nextCheckedFollowupAction,
      discussionRequired,
      discussionNote,
      discussionRequestedByUserId,
      discussionRequired,
      userId,
      batchId
    ]
  );

  const [rows] = await pool.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.id = ?')}
      LIMIT 1
    `,
    [batchId]
  );

  if (rows.length === 0) {
    throw new Error('Не вдалося прочитати оновлену партію.');
  }

  return mapRow(rows[0]);
}

export async function updateInventoryBatchExpiryDateInDb(input: {
  batchId: string | number;
  storeId?: string | number | null;
  expiryDate: string;
  updatedByUserId?: string | number | null;
}): Promise<InventoryBatchRecord> {
  const pool = getDbPool();
  const batchId = Number(input.batchId);
  const scopedStoreId = input.storeId == null || input.storeId === '' ? null : Number(input.storeId);
  const updatedByUserId =
    input.updatedByUserId == null || input.updatedByUserId === '' ? null : Number(input.updatedByUserId);
  const expiryDate = String(input.expiryDate ?? '').trim();

  if (!Number.isFinite(batchId) || batchId <= 0) {
    throw new Error('Некоректний batchId.');
  }
  if (!expiryDate) {
    throw new Error('Вкажіть новий термін придатності.');
  }

  const [batchRows] = await pool.query<Array<RowDataPacket & { store_id: number }>>(
    `
      SELECT store_id
      FROM product_batches
      WHERE id = ?
      LIMIT 1
    `,
    [batchId]
  );

  if (batchRows.length === 0) {
    throw new Error('Партію не знайдено.');
  }

  if (scopedStoreId != null && (!Number.isFinite(scopedStoreId) || scopedStoreId <= 0 || batchRows[0].store_id !== scopedStoreId)) {
    throw new Error('Немає доступу до партії іншого магазину.');
  }

  await pool.query(
    `
      UPDATE product_batches
      SET
        expiry_date = ?,
        notified = 0,
        notified_at = NULL,
        updated_by_user_id = COALESCE(?, updated_by_user_id),
        updated_at = NOW()
      WHERE id = ?
    `,
    [expiryDate, updatedByUserId, batchId]
  );

  const [rows] = await pool.query<BatchRow[]>(
    `
      ${buildBatchSelectSql('WHERE pb.id = ?')}
      LIMIT 1
    `,
    [batchId]
  );

  if (rows.length === 0) {
    throw new Error('Не вдалося прочитати оновлену партію.');
  }

  return mapRow(rows[0]);
}
