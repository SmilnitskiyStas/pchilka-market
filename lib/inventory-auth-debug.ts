import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { createInventoryActivityLogInDb } from '@/lib/inventory-activity-logs-repository';

type InventoryDbExecutor = Pool | PoolConnection;

export const INVENTORY_AUTH_DEBUG_ACTION_TYPES = [
  'inventory_telegram_webhook_rejected',
  'inventory_telegram_start_received',
  'inventory_telegram_start_existing_user',
  'inventory_telegram_start_registration_link_sent',
  'inventory_telegram_start_send_failed',
  'inventory_intake_context_access_granted',
  'inventory_intake_context_invalid_token',
  'inventory_intake_context_user_not_found',
  'inventory_intake_context_user_inactive',
  'inventory_intake_context_user_missing_store',
  'inventory_intake_context_store_not_found',
  'inventory_intake_context_unexpected_error'
] as const;

export type InventoryAuthDebugActionType = (typeof INVENTORY_AUTH_DEBUG_ACTION_TYPES)[number];

type InventoryAuthDebugLogRow = RowDataPacket & {
  id: number;
  created_at: Date | string;
  user_id: number | null;
  store_id: number | null;
  action_type: string;
  comment: string | null;
  user_name: string | null;
  user_surname: string | null;
  store_code: string | null;
  city: string | null;
  address_line: string | null;
};

export type InventoryAuthDebugLogRecord = {
  id: number;
  createdAt: string;
  userId: number | null;
  storeId: number | null;
  actionType: string;
  comment: string;
  userName: string;
  userSurname: string;
  storeLabel: string;
  meta: Record<string, unknown> | null;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function safeStringify(value: Record<string, unknown>) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: 'Failed to serialize auth debug payload.' });
  }
}

function safeParseComment(comment: string | null) {
  if (!comment) return null;

  try {
    const parsed = JSON.parse(comment) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function mapAuthDebugRow(row: InventoryAuthDebugLogRow): InventoryAuthDebugLogRecord {
  return {
    id: row.id,
    createdAt: toIso(row.created_at),
    userId: row.user_id ?? null,
    storeId: row.store_id ?? null,
    actionType: row.action_type,
    comment: row.comment ?? '',
    userName: row.user_name ?? '',
    userSurname: row.user_surname ?? '',
    storeLabel: [row.store_code, row.city, row.address_line].filter(Boolean).join(' | '),
    meta: safeParseComment(row.comment)
  };
}

export async function createInventoryAuthDebugLogInDb(
  input: {
    actionType: InventoryAuthDebugActionType;
    userId?: number | null;
    storeId?: number | null;
    meta?: Record<string, unknown>;
  },
  executor?: InventoryDbExecutor
) {
  await createInventoryActivityLogInDb(
    {
      userId: input.userId ?? null,
      storeId: input.storeId ?? null,
      actionType: input.actionType,
      comment: input.meta ? safeStringify(input.meta) : null
    },
    executor
  );
}

export async function listInventoryAuthDebugLogsFromDb(limit = 100): Promise<InventoryAuthDebugLogRecord[]> {
  const db = getDbPool();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const actionTypes = [...INVENTORY_AUTH_DEBUG_ACTION_TYPES];
  const placeholders = actionTypes.map(() => '?').join(', ');

  const [rows] = await db.query<InventoryAuthDebugLogRow[]>(
    `
      SELECT
        al.id,
        al.created_at,
        al.user_id,
        al.store_id,
        al.action_type,
        al.comment,
        u.name AS user_name,
        u.surname AS user_surname,
        s.store_code,
        s.city,
        s.address_line
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN stores s ON s.id = al.store_id
      WHERE al.action_type IN (${placeholders})
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ?
    `,
    [...actionTypes, safeLimit]
  );

  return rows.map(mapAuthDebugRow);
}

export async function writeInventoryAuthDebugLog(
  input: {
    actionType: InventoryAuthDebugActionType;
    userId?: number | null;
    storeId?: number | null;
    meta?: Record<string, unknown>;
  },
  executor?: InventoryDbExecutor
) {
  try {
    await createInventoryAuthDebugLogInDb(input, executor);
  } catch (error) {
    console.error('Failed to write inventory auth debug log', {
      actionType: input.actionType,
      userId: input.userId ?? null,
      storeId: input.storeId ?? null,
      meta: input.meta ?? null,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
