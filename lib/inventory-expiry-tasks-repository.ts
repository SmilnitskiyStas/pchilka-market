import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { listInventoryBatchesFromDb } from '@/lib/inventory-batches-repository';
import type { InventoryBatchRecord } from '@/lib/inventory-batch-types';

type ExpiryTaskRow = RowDataPacket & {
  id: number;
  batch_id: number;
  product_id: number;
  store_id: number;
  responsible_user_id: number | null;
  assigned_user_id: number | null;
  source_type: string;
  task_type: string;
  status: string;
  outcome: string | null;
  risk_level: string;
  due_date: string;
  days_left_snapshot: number;
  title: string;
  note: string | null;
  resolution_note: string | null;
  created_by_user_id: number | null;
  started_at: Date | string | null;
  first_detected_at: Date | string;
  last_detected_at: Date | string;
  last_notified_at: Date | string | null;
  completed_at: Date | string | null;
  completed_by_user_id: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  product_name?: string;
  article?: string;
  barcode?: string | null;
  batch_code?: string | null;
  store_label?: string | null;
  responsible_user_name?: string | null;
};

export type InventoryExpiryTaskRecord = {
  id: number;
  batchId: number;
  productId: number;
  storeId: number;
  responsibleUserId: number | null;
  assignedUserId: number | null;
  sourceType: string;
  taskType: string;
  status: string;
  outcome: string;
  riskLevel: string;
  dueDate: string;
  daysLeftSnapshot: number;
  title: string;
  note: string;
  resolutionNote: string;
  createdByUserId: number | null;
  startedAt: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  lastNotifiedAt: string;
  completedAt: string;
  completedByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  productName: string;
  article: string;
  barcode: string;
  batchCode: string;
  storeLabel: string;
  responsibleUserName: string;
};

export type InventoryExpiryNotificationCandidate = InventoryExpiryTaskRecord & {
  reminderKind: 'initial' | 'repeat';
};

export type InventoryExpiryTaskStatusGroup = 'active' | 'archived' | 'all';

function toIso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function daysLeftUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
}

function deriveRiskLevel(daysLeft: number) {
  if (daysLeft <= 1) return 'critical';
  if (daysLeft <= 3) return 'high';
  if (daysLeft <= 7) return 'medium';
  return 'low';
}

function deriveTaskStatus(batch: InventoryBatchRecord) {
  if (batch.quantityCurrent <= 0 || batch.batchStatus === 'closed') return 'cancelled';
  if (batch.checkStatus === 'writeoff' || batch.checkStatus === 'discussion_required' || batch.checkStatus === 'checked') {
    return 'completed';
  }
  return 'open';
}

function deriveTaskOutcome(batch: InventoryBatchRecord) {
  if (batch.checkStatus === 'writeoff' || batch.batchStatus === 'writeoff_pending') return 'writeoff_required';
  if (batch.checkStatus === 'discussion_required' || batch.batchStatus === 'hold') return 'manager_review';
  if (batch.checkStatus === 'checked') return 'checked_ok';
  return '';
}

function mapRow(row: ExpiryTaskRow): InventoryExpiryTaskRecord {
  return {
    id: row.id,
    batchId: row.batch_id,
    productId: row.product_id,
    storeId: row.store_id,
    responsibleUserId: row.responsible_user_id,
    assignedUserId: row.assigned_user_id,
    sourceType: row.source_type ?? 'system',
    taskType: row.task_type,
    status: row.status,
    outcome: row.outcome ?? '',
    riskLevel: row.risk_level,
    dueDate: String(row.due_date ?? ''),
    daysLeftSnapshot: Number(row.days_left_snapshot ?? 0),
    title: row.title,
    note: row.note ?? '',
    resolutionNote: row.resolution_note ?? '',
    createdByUserId: row.created_by_user_id ?? null,
    startedAt: toIso(row.started_at),
    firstDetectedAt: toIso(row.first_detected_at),
    lastDetectedAt: toIso(row.last_detected_at),
    lastNotifiedAt: toIso(row.last_notified_at),
    completedAt: toIso(row.completed_at),
    completedByUserId: row.completed_by_user_id ?? null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    productName: row.product_name ?? '',
    article: row.article ?? '',
    barcode: row.barcode ?? '',
    batchCode: row.batch_code ?? '',
    storeLabel: row.store_label ?? '',
    responsibleUserName: row.responsible_user_name ?? ''
  };
}

export async function syncInventoryExpiryTasksInDb() {
  const pool = getDbPool();
  const batches = await listInventoryBatchesFromDb(5000);
  const relevantBatches = batches.filter((batch) => {
    if (batch.quantityCurrent <= 0) return false;
    const daysLeft = daysLeftUntil(batch.expiryDate);
    return daysLeft <= Number(batch.notifiedDays || 7);
  });

  const [existingRows] = await pool.query<ExpiryTaskRow[]>(
    `
      SELECT
        id,
        batch_id,
        product_id,
        store_id,
        responsible_user_id,
        assigned_user_id,
        source_type,
        task_type,
        status,
        outcome,
        risk_level,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
        days_left_snapshot,
        title,
        note,
        resolution_note,
        created_by_user_id,
        started_at,
        first_detected_at,
        last_detected_at,
        last_notified_at,
        completed_at,
        completed_by_user_id,
        created_at,
        updated_at
      FROM expiry_tasks
      WHERE task_type = 'expiry_check'
    `
  );

  const latestTaskByBatch = new Map<number, ExpiryTaskRow>();
  for (const row of existingRows) {
    const existing = latestTaskByBatch.get(row.batch_id);
    if (!existing || row.id > existing.id) {
      latestTaskByBatch.set(row.batch_id, row);
    }
  }

  const relevantBatchIds = new Set<number>();
  let created = 0;
  let updated = 0;
  let cancelled = 0;

  for (const batch of relevantBatches) {
    const batchId = Number(batch.id);
    relevantBatchIds.add(batchId);

    const daysLeft = daysLeftUntil(batch.expiryDate);
    const riskLevel = deriveRiskLevel(daysLeft);
    const nextStatus = deriveTaskStatus(batch);
    const nextOutcome = deriveTaskOutcome(batch);
    const title = `Перевірити товар "${batch.productName}"`;
    const note = [
      `Партія #${batch.id}`,
      batch.batchCode ? `код ${batch.batchCode}` : '',
      `залишок ${batch.quantityCurrent}`,
      `строк ${batch.expiryDate}`
    ].filter(Boolean).join(' | ');

    const existingTask = latestTaskByBatch.get(batchId);
    if (!existingTask) {
      await pool.query<ResultSetHeader>(
        `
          INSERT INTO expiry_tasks (
            batch_id,
            product_id,
            store_id,
            responsible_user_id,
            assigned_user_id,
            source_type,
            task_type,
            status,
            outcome,
            risk_level,
            due_date,
            days_left_snapshot,
            title,
            note
          ) VALUES (?, ?, ?, ?, ?, 'system', 'expiry_check', ?, ?, ?, ?, ?, ?)
        `,
        [
          batchId,
          Number(batch.productId),
          Number(batch.storeId),
          batch.responsibleUserId ? Number(batch.responsibleUserId) : null,
          batch.responsibleUserId ? Number(batch.responsibleUserId) : null,
          nextStatus,
          nextOutcome || null,
          riskLevel,
          batch.expiryDate,
          daysLeft,
          title,
          note
        ]
      );
      created += 1;
      continue;
    }

    await pool.query(
      `
        UPDATE expiry_tasks
        SET
          responsible_user_id = ?,
          assigned_user_id = ?,
          status = ?,
          outcome = CASE
            WHEN ? = 'completed' THEN ?
            WHEN ? = 'cancelled' THEN outcome
            ELSE ''
          END,
          risk_level = ?,
          due_date = ?,
          days_left_snapshot = ?,
          title = ?,
          note = ?,
          last_detected_at = NOW(),
          completed_at = CASE
            WHEN ? IN ('completed', 'cancelled') THEN COALESCE(completed_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
        WHERE id = ?
      `,
      [
        batch.responsibleUserId ? Number(batch.responsibleUserId) : null,
        batch.responsibleUserId ? Number(batch.responsibleUserId) : null,
        nextStatus,
        nextStatus,
        nextOutcome || null,
        nextStatus,
        riskLevel,
        batch.expiryDate,
        daysLeft,
        title,
        note,
        nextStatus,
        existingTask.id
      ]
    );
    updated += 1;
  }

  for (const row of existingRows) {
    if (relevantBatchIds.has(row.batch_id)) continue;
    if (!['open', 'in_progress'].includes(row.status)) continue;

    await pool.query(
      `
        UPDATE expiry_tasks
        SET
          status = 'cancelled',
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW()
        WHERE id = ?
      `,
      [row.id]
    );
    cancelled += 1;
  }

  return {
    scannedBatches: batches.length,
    relevantBatches: relevantBatches.length,
    created,
    updated,
    cancelled
  };
}

export async function listInventoryExpiryNotificationCandidatesFromDb(limit = 200): Promise<InventoryExpiryNotificationCandidate[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<ExpiryTaskRow[]>(
    `
      SELECT
        et.id,
        et.batch_id,
        et.product_id,
        et.store_id,
        et.responsible_user_id,
        et.assigned_user_id,
        et.source_type,
        et.task_type,
        et.status,
        et.outcome,
        et.risk_level,
        DATE_FORMAT(et.due_date, '%Y-%m-%d') AS due_date,
        et.days_left_snapshot,
        et.title,
        et.note,
        et.resolution_note,
        et.created_by_user_id,
        et.started_at,
        et.first_detected_at,
        et.last_detected_at,
        et.last_notified_at,
        et.completed_at,
        et.completed_by_user_id,
        et.created_at,
        et.updated_at,
        p.product_name,
        p.article,
        (
          SELECT GROUP_CONCAT(pb.barcode ORDER BY pb.id ASC SEPARATOR ', ')
          FROM product_barcodes pb
          WHERE pb.product_id = p.id
        ) AS barcode,
        b.batch_code,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        CONCAT_WS(' ', u.surname, u.name) AS responsible_user_name
      FROM expiry_tasks et
      INNER JOIN product_batches b ON b.id = et.batch_id
      INNER JOIN products p ON p.id = et.product_id
      INNER JOIN stores s ON s.id = et.store_id
      LEFT JOIN users u ON u.id = COALESCE(et.assigned_user_id, et.responsible_user_id)
      WHERE
        et.task_type = 'expiry_check'
        AND et.status IN ('open', 'in_progress')
        AND (
          et.last_notified_at IS NULL
          OR DATE(et.last_notified_at) < CURDATE()
        )
      ORDER BY et.due_date ASC, et.risk_level DESC, et.id ASC
      LIMIT ?
    `,
    [Math.min(Math.max(limit, 1), 500)]
  );

  return rows.map((row) => ({
    ...mapRow(row),
    reminderKind: row.last_notified_at ? 'repeat' : 'initial'
  }));
}

export async function listInventoryExpiryTasksFromDb(options?: {
  responsibleUserId?: string | number | null;
  storeId?: string | number | null;
  statusGroup?: InventoryExpiryTaskStatusGroup;
  limit?: number;
}): Promise<InventoryExpiryTaskRecord[]> {
  const pool = getDbPool();
  const statusGroup = options?.statusGroup ?? 'all';
  const limit = Math.min(Math.max(Number(options?.limit ?? 250), 1), 1000);
  const responsibleUserId = Number(options?.responsibleUserId ?? 0);
  const storeId = Number(options?.storeId ?? 0);

  const whereClauses = [`et.task_type = 'expiry_check'`];
  const params: Array<string | number> = [];

  if (statusGroup === 'active') {
    whereClauses.push(`et.status IN ('open', 'in_progress')`);
  } else if (statusGroup === 'archived') {
    whereClauses.push(`et.status IN ('completed', 'cancelled')`);
  }

  if (Number.isFinite(responsibleUserId) && responsibleUserId > 0) {
    whereClauses.push(`COALESCE(et.assigned_user_id, et.responsible_user_id) = ?`);
    params.push(responsibleUserId);
  }

  if (Number.isFinite(storeId) && storeId > 0) {
    whereClauses.push(`et.store_id = ?`);
    params.push(storeId);
  }

  params.push(limit);

  const [rows] = await pool.query<ExpiryTaskRow[]>(
    `
      SELECT
        et.id,
        et.batch_id,
        et.product_id,
        et.store_id,
        et.responsible_user_id,
        et.assigned_user_id,
        et.source_type,
        et.task_type,
        et.status,
        et.outcome,
        et.risk_level,
        DATE_FORMAT(et.due_date, '%Y-%m-%d') AS due_date,
        et.days_left_snapshot,
        et.title,
        et.note,
        et.resolution_note,
        et.created_by_user_id,
        et.started_at,
        et.first_detected_at,
        et.last_detected_at,
        et.last_notified_at,
        et.completed_at,
        et.completed_by_user_id,
        et.created_at,
        et.updated_at,
        p.product_name,
        p.article,
        (
          SELECT GROUP_CONCAT(pb.barcode ORDER BY pb.id ASC SEPARATOR ', ')
          FROM product_barcodes pb
          WHERE pb.product_id = p.id
        ) AS barcode,
        b.batch_code,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        CONCAT_WS(' ', u.surname, u.name) AS responsible_user_name
      FROM expiry_tasks et
      INNER JOIN product_batches b ON b.id = et.batch_id
      INNER JOIN products p ON p.id = et.product_id
      INNER JOIN stores s ON s.id = et.store_id
      LEFT JOIN users u ON u.id = COALESCE(et.assigned_user_id, et.responsible_user_id)
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY
        CASE
          WHEN et.status IN ('open', 'in_progress') THEN 0
          ELSE 1
        END,
        et.due_date ASC,
        et.updated_at DESC,
        et.id DESC
      LIMIT ?
    `,
    params
  );

  return rows.map(mapRow);
}

export async function markInventoryExpiryTaskNotifiedInDb(taskId: string | number) {
  const pool = getDbPool();
  const normalizedTaskId = Number(taskId);
  if (!Number.isFinite(normalizedTaskId) || normalizedTaskId <= 0) return;

  await pool.query(
    `
      UPDATE expiry_tasks
      SET last_notified_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `,
    [normalizedTaskId]
  );
}

export async function markInventoryExpiryTaskStartedInDb(taskId: string | number) {
  const pool = getDbPool();
  const normalizedTaskId = Number(taskId);
  if (!Number.isFinite(normalizedTaskId) || normalizedTaskId <= 0) return;

  await pool.query(
    `
      UPDATE expiry_tasks
      SET
        status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
      WHERE id = ?
    `,
    [normalizedTaskId]
  );
}

export async function findInventoryExpiryTaskByIdInDb(taskId: string | number): Promise<InventoryExpiryTaskRecord | null> {
  const normalizedTaskId = Number(taskId);
  if (!Number.isFinite(normalizedTaskId) || normalizedTaskId <= 0) return null;

  const pool = getDbPool();
  const [rows] = await pool.query<ExpiryTaskRow[]>(
    `
      SELECT
        et.id,
        et.batch_id,
        et.product_id,
        et.store_id,
        et.responsible_user_id,
        et.assigned_user_id,
        et.source_type,
        et.task_type,
        et.status,
        et.outcome,
        et.risk_level,
        DATE_FORMAT(et.due_date, '%Y-%m-%d') AS due_date,
        et.days_left_snapshot,
        et.title,
        et.note,
        et.resolution_note,
        et.created_by_user_id,
        et.started_at,
        et.first_detected_at,
        et.last_detected_at,
        et.last_notified_at,
        et.completed_at,
        et.completed_by_user_id,
        et.created_at,
        et.updated_at,
        p.product_name,
        p.article,
        (
          SELECT GROUP_CONCAT(pb.barcode ORDER BY pb.id ASC SEPARATOR ', ')
          FROM product_barcodes pb
          WHERE pb.product_id = p.id
        ) AS barcode,
        b.batch_code,
        CONCAT_WS(' | ', s.store_code, s.city, s.address_line) AS store_label,
        CONCAT_WS(' ', u.surname, u.name) AS responsible_user_name
      FROM expiry_tasks et
      INNER JOIN product_batches b ON b.id = et.batch_id
      INNER JOIN products p ON p.id = et.product_id
      INNER JOIN stores s ON s.id = et.store_id
      LEFT JOIN users u ON u.id = COALESCE(et.assigned_user_id, et.responsible_user_id)
      WHERE et.id = ?
      LIMIT 1
    `,
    [normalizedTaskId]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function completeInventoryExpiryTaskInDb(input: {
  taskId: string | number;
  completedByUserId: string | number;
  outcome: string;
  resolutionNote?: string | null;
}) {
  const pool = getDbPool();
  const normalizedTaskId = Number(input.taskId);
  const normalizedUserId = Number(input.completedByUserId);
  if (!Number.isFinite(normalizedTaskId) || normalizedTaskId <= 0) return;
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return;

  await pool.query(
    `
      UPDATE expiry_tasks
      SET
        status = 'completed',
        outcome = ?,
        resolution_note = ?,
        started_at = COALESCE(started_at, NOW()),
        completed_at = COALESCE(completed_at, NOW()),
        completed_by_user_id = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
    [input.outcome.trim() || null, input.resolutionNote?.trim() || null, normalizedUserId, normalizedTaskId]
  );
}
