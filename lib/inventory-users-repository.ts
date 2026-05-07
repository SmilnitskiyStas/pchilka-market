import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { normalizeInventoryUserRole, type InventoryUserRole } from '@/lib/inventory-user-roles';

export type InventoryUserRecord = {
  id: number;
  storeId: number | null;
  storeLabel: string;
  name: string;
  surname: string;
  positionTitle: string;
  userChatId: string;
  role: InventoryUserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InventoryUserRow = RowDataPacket & {
  id: number;
  store_id: number | null;
  store_code: string | null;
  city: string | null;
  address_line: string | null;
  name: string;
  surname: string;
  position_title: string | null;
  user_chat_id: string | number;
  role: string;
  is_active: number;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function mapRow(row: InventoryUserRow): InventoryUserRecord {
  return {
    id: row.id,
    storeId: row.store_id,
    storeLabel: [row.store_code, row.city, row.address_line].filter(Boolean).join(' | '),
    name: row.name,
    surname: row.surname,
    positionTitle: row.position_title ?? '',
    userChatId: String(row.user_chat_id),
    role: normalizeInventoryUserRole(row.role),
    isActive: row.is_active === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export async function findInventoryUserByChatId(userChatId: string): Promise<InventoryUserRecord | null> {
  const pool = getDbPool();
  const baseSelect = `
      SELECT
        u.id,
        u.store_id,
        s.store_code,
        s.city,
        s.address_line,
        u.name,
        u.surname,
        u.position_title,
        u.user_chat_id,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN stores s ON s.id = u.store_id
  `;

  const queryVariants = [
    `
      ${baseSelect}
      WHERE u.user_chat_id = ? AND u.is_active = 1 AND u.store_id IS NOT NULL AND u.store_id > 0
      ORDER BY u.updated_at DESC, u.id DESC
      LIMIT 1
    `,
    `
      ${baseSelect}
      WHERE u.user_chat_id = ? AND u.is_active = 1
      ORDER BY
        CASE WHEN u.store_id IS NULL OR u.store_id <= 0 THEN 1 ELSE 0 END ASC,
        u.updated_at DESC,
        u.id DESC
      LIMIT 1
    `,
    `
      ${baseSelect}
      WHERE u.user_chat_id = ?
      ORDER BY
        u.is_active DESC,
        CASE WHEN u.store_id IS NULL OR u.store_id <= 0 THEN 1 ELSE 0 END ASC,
        u.updated_at DESC,
        u.id DESC
      LIMIT 1
    `
  ];

  for (const sql of queryVariants) {
    const [rows] = await pool.query<InventoryUserRow[]>(sql, [userChatId]);
    if (rows[0]) {
      return mapRow(rows[0]);
    }
  }

  return null;
}

export async function createInventoryUserInDb(input: {
  storeId: number;
  name: string;
  surname: string;
  positionTitle?: string;
  userChatId: string;
  role?: InventoryUserRole;
}): Promise<InventoryUserRecord> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO users (store_id, name, surname, position_title, user_chat_id, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `,
    [input.storeId, input.name, input.surname, input.positionTitle ?? null, input.userChatId, input.role ?? 'staff']
  );

  const [rows] = await pool.query<InventoryUserRow[]>(
    `
      SELECT
        u.id,
        u.store_id,
        s.store_code,
        s.city,
        s.address_line,
        u.name,
        u.surname,
        u.position_title,
        u.user_chat_id,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN stores s ON s.id = u.store_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  if (!rows[0]) {
    throw new Error('Не вдалося прочитати створеного користувача.');
  }

  return mapRow(rows[0]);
}

export async function listInventoryUsersFromDb(input?: {
  storeId?: string | number | null;
  limit?: number;
}): Promise<InventoryUserRecord[]> {
  const pool = getDbPool();
  const values: Array<number> = [];
  const storeId = Number(input?.storeId);
  const hasStoreFilter = Number.isFinite(storeId) && storeId > 0;

  let whereSql = '';
  if (hasStoreFilter) {
    whereSql = 'WHERE u.store_id = ?';
    values.push(storeId);
  }

  values.push(Math.min(Math.max(Number(input?.limit ?? 200), 1), 500));

  const [rows] = await pool.query<InventoryUserRow[]>(
    `
      SELECT
        u.id,
        u.store_id,
        s.store_code,
        s.city,
        s.address_line,
        u.name,
        u.surname,
        u.position_title,
        u.user_chat_id,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN stores s ON s.id = u.store_id
      ${whereSql}
      ORDER BY u.store_id ASC, u.surname ASC, u.name ASC, u.id DESC
      LIMIT ?
    `,
    values
  );

  return rows.map(mapRow);
}

export async function updateInventoryUserInDb(input: {
  userId: string | number;
  storeId: string | number;
  scopedStoreId?: string | number | null;
  role?: InventoryUserRole;
  positionTitle?: string;
  isActive?: boolean;
}): Promise<InventoryUserRecord> {
  const pool = getDbPool();
  const userId = Number(input.userId);
  const storeId = Number(input.storeId);
  const scopedStoreId =
    input.scopedStoreId == null || input.scopedStoreId === '' ? null : Number(input.scopedStoreId);

  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Некоректний userId.');
  }
  if (!Number.isFinite(storeId) || storeId <= 0) {
    throw new Error('Некоректний storeId.');
  }
  if (scopedStoreId != null && (!Number.isFinite(scopedStoreId) || scopedStoreId <= 0)) {
    throw new Error('Некоректний scopedStoreId.');
  }

  const [storeRows] = await pool.query<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM stores WHERE id = ? AND is_active = 1 LIMIT 1',
    [storeId]
  );
  if (!storeRows[0]) {
    throw new Error('Активний магазин для працівника не знайдено.');
  }

  const [rows] = await pool.query<InventoryUserRow[]>(
    `
      SELECT
        u.id,
        u.store_id,
        s.store_code,
        s.city,
        s.address_line,
        u.name,
        u.surname,
        u.position_title,
        u.user_chat_id,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN stores s ON s.id = u.store_id
      WHERE u.id = ?
        ${scopedStoreId == null ? '' : 'AND u.store_id = ?'}
      LIMIT 1
    `,
    scopedStoreId == null ? [userId] : [userId, scopedStoreId]
  );

  if (!rows[0]) {
    throw new Error('Працівника магазину не знайдено.');
  }

  const current = rows[0];
  const nextRole = input.role ?? current.role;
  const nextPositionTitle = input.positionTitle != null ? input.positionTitle.trim() : current.position_title ?? '';
  const nextIsActive = input.isActive == null ? current.is_active === 1 : input.isActive;

  await pool.query(
    `
      UPDATE users
      SET store_id = ?, role = ?, position_title = ?, is_active = ?
      WHERE id = ?
        ${scopedStoreId == null ? '' : 'AND store_id = ?'}
    `,
    scopedStoreId == null
      ? [storeId, nextRole, nextPositionTitle || null, nextIsActive ? 1 : 0, userId]
      : [storeId, nextRole, nextPositionTitle || null, nextIsActive ? 1 : 0, userId, scopedStoreId]
  );

  const [updatedRows] = await pool.query<InventoryUserRow[]>(
    `
      SELECT
        u.id,
        u.store_id,
        s.store_code,
        s.city,
        s.address_line,
        u.name,
        u.surname,
        u.position_title,
        u.user_chat_id,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN stores s ON s.id = u.store_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  if (!updatedRows[0]) {
    throw new Error('Не вдалося прочитати оновленого працівника.');
  }

  return mapRow(updatedRows[0]);
}
