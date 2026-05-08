import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { createInventoryActivityLogInDb } from '@/lib/inventory-activity-logs-repository';
import type { InventoryCountItemRecord, InventoryCountSessionRecord, InventoryCountSessionStatus } from '@/lib/inventory-count-types';

type InventoryCountSessionRow = RowDataPacket & {
  id: number;
  store_id: number;
  store_code: string | null;
  city: string | null;
  address_line: string | null;
  status: string;
  scheduled_for: string;
  started_by_user_id: number | null;
  started_by_user_name: string | null;
  completed_by_user_id: number | null;
  completed_by_user_name: string | null;
  items_count: number;
  counted_items_count: number;
  differences_count: number;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
};

type InventoryCountItemRow = RowDataPacket & {
  id: number;
  session_id: number;
  batch_id: number;
  product_id: number;
  expected_quantity: number;
  counted_quantity: number | null;
  difference_quantity: number | null;
  note: string | null;
  checked_by_user_id: number | null;
  checked_by_user_name: string | null;
  checked_at: Date | string | null;
  product_name_snapshot: string | null;
  article_snapshot: string | null;
  barcode_snapshot: string | null;
  units_of_measurement_snapshot: string | null;
  expiry_date_snapshot: string | null;
  batch_code_snapshot: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeStatus(value: string): InventoryCountSessionStatus {
  switch (String(value ?? '').trim()) {
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'in_progress';
    case 'draft':
    default:
      return 'draft';
  }
}

function mapSessionRow(row: InventoryCountSessionRow): InventoryCountSessionRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    storeLabel: [row.store_code, row.city, row.address_line].filter(Boolean).join(' | '),
    status: normalizeStatus(row.status),
    scheduledFor: String(row.scheduled_for ?? ''),
    startedByUserId: row.started_by_user_id,
    startedByUserName: row.started_by_user_name ?? '',
    completedByUserId: row.completed_by_user_id,
    completedByUserName: row.completed_by_user_name ?? '',
    itemsCount: Number(row.items_count ?? 0),
    countedItemsCount: Number(row.counted_items_count ?? 0),
    differencesCount: Number(row.differences_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: toIso(row.completed_at)
  };
}

function mapItemRow(row: InventoryCountItemRow): InventoryCountItemRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    batchId: row.batch_id,
    productId: row.product_id,
    expectedQuantity: Number(row.expected_quantity ?? 0),
    countedQuantity: row.counted_quantity == null ? null : Number(row.counted_quantity),
    differenceQuantity: row.difference_quantity == null ? null : Number(row.difference_quantity),
    note: row.note ?? '',
    checkedByUserId: row.checked_by_user_id,
    checkedByUserName: row.checked_by_user_name ?? '',
    checkedAt: toIso(row.checked_at),
    productNameSnapshot: row.product_name_snapshot ?? '',
    articleSnapshot: row.article_snapshot ?? '',
    barcodeSnapshot: row.barcode_snapshot ?? '',
    unitsOfMeasurementSnapshot: row.units_of_measurement_snapshot ?? '',
    expiryDateSnapshot: String(row.expiry_date_snapshot ?? ''),
    batchCodeSnapshot: row.batch_code_snapshot ?? '',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function selectSessionById(connection: PoolConnection, sessionId: number) {
  const [rows] = await connection.query<InventoryCountSessionRow[]>(
    `
      SELECT
        s.id,
        s.store_id,
        st.store_code,
        st.city,
        st.address_line,
        s.status,
        DATE_FORMAT(s.scheduled_for, '%Y-%m-%d') AS scheduled_for,
        s.started_by_user_id,
        CONCAT_WS(' ', su.surname, su.name) AS started_by_user_name,
        s.completed_by_user_id,
        CONCAT_WS(' ', cu.surname, cu.name) AS completed_by_user_name,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
        ) AS items_count,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
            AND sci.counted_quantity IS NOT NULL
        ) AS counted_items_count,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
            AND COALESCE(sci.difference_quantity, 0) <> 0
        ) AS differences_count,
        s.created_at,
        s.updated_at,
        s.completed_at
      FROM inventory_count_sessions s
      INNER JOIN stores st ON st.id = s.store_id
      LEFT JOIN users su ON su.id = s.started_by_user_id
      LEFT JOIN users cu ON cu.id = s.completed_by_user_id
      WHERE s.id = ?
      LIMIT 1
    `,
    [sessionId]
  );

  return rows[0] ? mapSessionRow(rows[0]) : null;
}

export async function listInventoryCountSessionsForStoreInDb(storeId: string | number, limit = 20): Promise<InventoryCountSessionRecord[]> {
  const pool = getDbPool();
  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    return [];
  }

  const [rows] = await pool.query<InventoryCountSessionRow[]>(
    `
      SELECT
        s.id,
        s.store_id,
        st.store_code,
        st.city,
        st.address_line,
        s.status,
        DATE_FORMAT(s.scheduled_for, '%Y-%m-%d') AS scheduled_for,
        s.started_by_user_id,
        CONCAT_WS(' ', su.surname, su.name) AS started_by_user_name,
        s.completed_by_user_id,
        CONCAT_WS(' ', cu.surname, cu.name) AS completed_by_user_name,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
        ) AS items_count,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
            AND sci.counted_quantity IS NOT NULL
        ) AS counted_items_count,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
            AND COALESCE(sci.difference_quantity, 0) <> 0
        ) AS differences_count,
        s.created_at,
        s.updated_at,
        s.completed_at
      FROM inventory_count_sessions s
      INNER JOIN stores st ON st.id = s.store_id
      LEFT JOIN users su ON su.id = s.started_by_user_id
      LEFT JOIN users cu ON cu.id = s.completed_by_user_id
      WHERE s.store_id = ?
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ?
    `,
    [normalizedStoreId, Math.min(Math.max(Number(limit) || 20, 1), 100)]
  );

  return rows.map(mapSessionRow);
}

export async function findActiveInventoryCountSessionForStoreInDb(storeId: string | number): Promise<InventoryCountSessionRecord | null> {
  const pool = getDbPool();
  const normalizedStoreId = Number(storeId);
  if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
    return null;
  }

  const [rows] = await pool.query<InventoryCountSessionRow[]>(
    `
      SELECT
        s.id,
        s.store_id,
        st.store_code,
        st.city,
        st.address_line,
        s.status,
        DATE_FORMAT(s.scheduled_for, '%Y-%m-%d') AS scheduled_for,
        s.started_by_user_id,
        CONCAT_WS(' ', su.surname, su.name) AS started_by_user_name,
        s.completed_by_user_id,
        CONCAT_WS(' ', cu.surname, cu.name) AS completed_by_user_name,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
        ) AS items_count,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
            AND sci.counted_quantity IS NOT NULL
        ) AS counted_items_count,
        (
          SELECT COUNT(*)
          FROM inventory_count_items sci
          WHERE sci.session_id = s.id
            AND COALESCE(sci.difference_quantity, 0) <> 0
        ) AS differences_count,
        s.created_at,
        s.updated_at,
        s.completed_at
      FROM inventory_count_sessions s
      INNER JOIN stores st ON st.id = s.store_id
      LEFT JOIN users su ON su.id = s.started_by_user_id
      LEFT JOIN users cu ON cu.id = s.completed_by_user_id
      WHERE s.store_id = ?
        AND s.status IN ('draft', 'in_progress')
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 1
    `,
    [normalizedStoreId]
  );

  return rows[0] ? mapSessionRow(rows[0]) : null;
}

export async function listInventoryCountItemsForSessionInDb(sessionId: string | number): Promise<InventoryCountItemRecord[]> {
  const pool = getDbPool();
  const normalizedSessionId = Number(sessionId);
  if (!Number.isFinite(normalizedSessionId) || normalizedSessionId <= 0) {
    return [];
  }

  const [rows] = await pool.query<InventoryCountItemRow[]>(
    `
      SELECT
        i.id,
        i.session_id,
        i.batch_id,
        i.product_id,
        i.expected_quantity,
        i.counted_quantity,
        i.difference_quantity,
        i.note,
        i.checked_by_user_id,
        CONCAT_WS(' ', u.surname, u.name) AS checked_by_user_name,
        i.checked_at,
        i.product_name_snapshot,
        i.article_snapshot,
        i.barcode_snapshot,
        i.units_of_measurement_snapshot,
        DATE_FORMAT(i.expiry_date_snapshot, '%Y-%m-%d') AS expiry_date_snapshot,
        i.batch_code_snapshot,
        i.created_at,
        i.updated_at
      FROM inventory_count_items i
      LEFT JOIN users u ON u.id = i.checked_by_user_id
      WHERE i.session_id = ?
      ORDER BY i.expiry_date_snapshot ASC, i.product_name_snapshot ASC, i.id ASC
    `,
    [normalizedSessionId]
  );

  return rows.map(mapItemRow);
}

export async function createInventoryCountSessionInDb(input: {
  storeId: string | number;
  startedByUserId: number;
  scheduledFor?: string;
}): Promise<{ session: InventoryCountSessionRecord; items: InventoryCountItemRecord[] }> {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedStoreId = Number(input.storeId);
    if (!Number.isFinite(normalizedStoreId) || normalizedStoreId <= 0) {
      throw new Error('Некоректний storeId для інвентаризації.');
    }

    const [activeRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
      `
        SELECT id
        FROM inventory_count_sessions
        WHERE store_id = ?
          AND status IN ('draft', 'in_progress')
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [normalizedStoreId]
    );
    if (activeRows[0]) {
      throw new Error('Для цього магазину вже є незавершена сесія інвентаризації.');
    }

    const [batchRows] = await connection.query<
      Array<
        RowDataPacket & {
          batch_id: number;
          product_id: number;
          expected_quantity: number;
          product_name: string;
          article: string | null;
          barcode: string | null;
          units_of_measurement: string | null;
          expiry_date: string;
          batch_code: string | null;
        }
      >
    >(
      `
        SELECT
          pb.id AS batch_id,
          pb.product_id,
          pb.quantity_current AS expected_quantity,
          p.product_name,
          p.article,
          (
            SELECT GROUP_CONCAT(pbc.barcode ORDER BY pbc.id ASC SEPARATOR ', ')
            FROM product_barcodes pbc
            WHERE pbc.product_id = p.id
          ) AS barcode,
          COALESCE(
            (
              SELECT pbc.units_of_measurement
              FROM product_barcodes pbc
              WHERE pbc.product_id = p.id
                AND TRIM(COALESCE(pbc.units_of_measurement, '')) <> ''
              ORDER BY pbc.id ASC
              LIMIT 1
            ),
            p.default_units_of_measurement,
            ''
          ) AS units_of_measurement,
          DATE_FORMAT(pb.expiry_date, '%Y-%m-%d') AS expiry_date,
          pb.batch_code
        FROM product_batches pb
        INNER JOIN products p ON p.id = pb.product_id
        WHERE pb.store_id = ?
          AND pb.quantity_current > 0
          AND pb.batch_status <> 'closed'
        ORDER BY pb.expiry_date ASC, p.product_name ASC, pb.id ASC
      `,
      [normalizedStoreId]
    );

    if (batchRows.length === 0) {
      throw new Error('Для цього магазину немає активних партій для інвентаризації.');
    }

    const scheduledFor = String(input.scheduledFor ?? new Date().toISOString().slice(0, 10)).trim();
    const [sessionResult] = await connection.query<ResultSetHeader>(
      `
        INSERT INTO inventory_count_sessions (
          store_id,
          scheduled_for,
          status,
          started_by_user_id
        ) VALUES (?, ?, 'in_progress', ?)
      `,
      [normalizedStoreId, scheduledFor, input.startedByUserId]
    );

    const sessionId = Number(sessionResult.insertId);

    for (const batch of batchRows) {
      await connection.query(
        `
          INSERT INTO inventory_count_items (
            session_id,
            batch_id,
            product_id,
            expected_quantity,
            product_name_snapshot,
            article_snapshot,
            barcode_snapshot,
            units_of_measurement_snapshot,
            expiry_date_snapshot,
            batch_code_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          sessionId,
          batch.batch_id,
          batch.product_id,
          Number(batch.expected_quantity ?? 0),
          batch.product_name,
          batch.article ?? '',
          batch.barcode ?? '',
          batch.units_of_measurement ?? '',
          batch.expiry_date,
          batch.batch_code ?? ''
        ]
      );
    }

    await connection.commit();

    const session = await selectSessionById(connection, sessionId);
    const items = await listInventoryCountItemsForSessionInDb(sessionId);
    if (!session) {
      throw new Error('Не вдалося підготувати сесію інвентаризації.');
    }

    return { session, items };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateInventoryCountItemInDb(input: {
  sessionId: string | number;
  itemId: string | number;
  countedQuantity: number;
  note?: string;
  checkedByUserId: number;
  storeId: number;
}): Promise<InventoryCountItemRecord> {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedSessionId = Number(input.sessionId);
    const normalizedItemId = Number(input.itemId);
    const normalizedCountedQuantity = Math.max(Math.round(Number(input.countedQuantity ?? 0)), 0);

    if (!Number.isFinite(normalizedSessionId) || normalizedSessionId <= 0) {
      throw new Error('Некоректний sessionId.');
    }
    if (!Number.isFinite(normalizedItemId) || normalizedItemId <= 0) {
      throw new Error('Некоректний itemId.');
    }

    const session = await selectSessionById(connection, normalizedSessionId);
    if (!session) {
      throw new Error('Сесію інвентаризації не знайдено.');
    }
    if (session.storeId !== Number(input.storeId)) {
      throw new Error('Немає доступу до інвентаризації іншого магазину.');
    }
    if (session.status === 'completed') {
      throw new Error('Сесію інвентаризації вже завершено.');
    }

    const [currentRows] = await connection.query<InventoryCountItemRow[]>(
      `
        SELECT
          i.id,
          i.session_id,
          i.batch_id,
          i.product_id,
          i.expected_quantity,
          i.counted_quantity,
          i.difference_quantity,
          i.note,
          i.checked_by_user_id,
          NULL AS checked_by_user_name,
          i.checked_at,
          i.product_name_snapshot,
          i.article_snapshot,
          i.barcode_snapshot,
          i.units_of_measurement_snapshot,
          DATE_FORMAT(i.expiry_date_snapshot, '%Y-%m-%d') AS expiry_date_snapshot,
          i.batch_code_snapshot,
          i.created_at,
          i.updated_at
        FROM inventory_count_items i
        WHERE i.id = ? AND i.session_id = ?
        LIMIT 1
      `,
      [normalizedItemId, normalizedSessionId]
    );

    const current = currentRows[0];
    if (!current) {
      throw new Error('Позицію інвентаризації не знайдено.');
    }

    const differenceQuantity = normalizedCountedQuantity - Number(current.expected_quantity ?? 0);
    await connection.query(
      `
        UPDATE inventory_count_items
        SET
          counted_quantity = ?,
          difference_quantity = ?,
          note = ?,
          checked_by_user_id = ?,
          checked_at = NOW(),
          updated_at = NOW()
        WHERE id = ? AND session_id = ?
      `,
      [
        normalizedCountedQuantity,
        differenceQuantity,
        String(input.note ?? '').trim() || null,
        input.checkedByUserId,
        normalizedItemId,
        normalizedSessionId
      ]
    );

    await connection.query(
      `
        UPDATE inventory_count_sessions
        SET status = 'in_progress', updated_at = NOW()
        WHERE id = ?
      `,
      [normalizedSessionId]
    );

    await connection.commit();

    const items = await listInventoryCountItemsForSessionInDb(normalizedSessionId);
    const updated = items.find((item) => item.id === normalizedItemId);
    if (!updated) {
      throw new Error('Не вдалося прочитати оновлену позицію інвентаризації.');
    }

    return updated;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function completeInventoryCountSessionInDb(input: {
  sessionId: string | number;
  completedByUserId: number;
  storeId: number;
}): Promise<{ session: InventoryCountSessionRecord; items: InventoryCountItemRecord[] }> {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const normalizedSessionId = Number(input.sessionId);
    if (!Number.isFinite(normalizedSessionId) || normalizedSessionId <= 0) {
      throw new Error('Некоректний sessionId.');
    }

    const session = await selectSessionById(connection, normalizedSessionId);
    if (!session) {
      throw new Error('Сесію інвентаризації не знайдено.');
    }
    if (session.storeId !== Number(input.storeId)) {
      throw new Error('Немає доступу до інвентаризації іншого магазину.');
    }
    if (session.status === 'completed') {
      throw new Error('Сесію інвентаризації вже завершено.');
    }

    const [itemRows] = await connection.query<InventoryCountItemRow[]>(
      `
        SELECT
          i.id,
          i.session_id,
          i.batch_id,
          i.product_id,
          i.expected_quantity,
          i.counted_quantity,
          i.difference_quantity,
          i.note,
          i.checked_by_user_id,
          NULL AS checked_by_user_name,
          i.checked_at,
          i.product_name_snapshot,
          i.article_snapshot,
          i.barcode_snapshot,
          i.units_of_measurement_snapshot,
          DATE_FORMAT(i.expiry_date_snapshot, '%Y-%m-%d') AS expiry_date_snapshot,
          i.batch_code_snapshot,
          i.created_at,
          i.updated_at
        FROM inventory_count_items i
        WHERE i.session_id = ?
        ORDER BY i.id ASC
      `,
      [normalizedSessionId]
    );

    if (itemRows.length === 0) {
      throw new Error('У сесії інвентаризації немає позицій.');
    }

    const incompleteItem = itemRows.find((item) => item.counted_quantity == null);
    if (incompleteItem) {
      throw new Error(`Не всі позиції перевірено. Завершіть підрахунок для партії #${incompleteItem.batch_id}.`);
    }

    for (const item of itemRows) {
      const oldQuantity = Number(item.expected_quantity ?? 0);
      const newQuantity = Number(item.counted_quantity ?? 0);
      const differenceQuantity = newQuantity - oldQuantity;

      if (differenceQuantity !== 0) {
        await connection.query(
          `
            UPDATE product_batches
            SET
              quantity_current = ?,
              quantity = ?,
              batch_status = CASE
                WHEN ? <= 0 THEN 'closed'
                ELSE batch_status
              END,
              updated_at = NOW()
            WHERE id = ?
          `,
          [newQuantity, newQuantity, newQuantity, item.batch_id]
        );

        await connection.query(
          `
            INSERT INTO inventory_adjustments (
              session_id,
              batch_id,
              product_id,
              store_id,
              adjusted_by_user_id,
              reason,
              old_quantity,
              new_quantity,
              difference_quantity,
              note
            ) VALUES (?, ?, ?, ?, ?, 'inventory_count', ?, ?, ?, ?)
          `,
          [
            normalizedSessionId,
            item.batch_id,
            item.product_id,
            session.storeId,
            input.completedByUserId,
            oldQuantity,
            newQuantity,
            differenceQuantity,
            item.note ?? null
          ]
        );

        await createInventoryActivityLogInDb(
          {
            userId: input.completedByUserId,
            batchId: item.batch_id,
            productId: item.product_id,
            storeId: session.storeId,
            actionType: 'inventory_count_adjustment',
            comment: `Інвентаризація, сесія #${normalizedSessionId}. Різниця: ${differenceQuantity}. ${item.note ?? ''}`.trim(),
            oldQuantity,
            newQuantity
          },
          connection
        );
      }
    }

    await connection.query(
      `
        UPDATE inventory_count_sessions
        SET
          status = 'completed',
          completed_by_user_id = ?,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `,
      [input.completedByUserId, normalizedSessionId]
    );

    await connection.commit();

    const completedSession = await selectSessionById(connection, normalizedSessionId);
    const items = await listInventoryCountItemsForSessionInDb(normalizedSessionId);
    if (!completedSession) {
      throw new Error('Не вдалося прочитати завершену сесію інвентаризації.');
    }

    return { session: completedSession, items };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
