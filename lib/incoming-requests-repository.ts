import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createHash } from 'crypto';

import { getDbPool } from '@/lib/db';
import {
  normalizeIncomingRequestInput,
  normalizeIncomingRequestStatus,
  type IncomingRequestCreateInput,
  type IncomingRequestRecord,
  type IncomingRequestStatus,
  type IncomingRequestType
} from '@/lib/incoming-requests';

type IncomingRequestRow = RowDataPacket & {
  id: number;
  request_type: IncomingRequestType;
  full_name: string | null;
  company_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  vacancy: string | null;
  subject: string | null;
  target_store: string | null;
  message: string | null;
  metadata_json: unknown;
  source_page: string | null;
  status: IncomingRequestStatus;
  created_at: string;
  updated_at: string;
};

function publicMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const result = { ...value };
  delete result._submissionKey;
  delete result._submissionFingerprint;
  return result;
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? publicMetadata(parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return publicMetadata(raw as Record<string, unknown>);
  }

  return null;
}

function mapRow(row: IncomingRequestRow): IncomingRequestRecord {
  return {
    id: String(row.id),
    requestType: row.request_type,
    fullName: row.full_name ?? '',
    companyName: row.company_name ?? '',
    contactPerson: row.contact_person ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    city: row.city ?? '',
    vacancy: row.vacancy ?? '',
    subject: row.subject ?? '',
    targetStore: row.target_store ?? '',
    message: row.message ?? '',
    metadata: parseMetadata(row.metadata_json),
    sourcePage: row.source_page ?? '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

type RequestExecutor = Pick<Pool, 'query'>;

async function insertIncomingRequest(input: IncomingRequestCreateInput, pool: RequestExecutor): Promise<IncomingRequestRecord> {
  const normalized = normalizeIncomingRequestInput(input);

  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO incoming_requests (
        request_type, full_name, company_name, contact_person, phone, email,
        city, vacancy, subject, target_store, message, metadata_json, source_page, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `,
    [
      normalized.requestType,
      normalized.fullName || null,
      normalized.companyName || null,
      normalized.contactPerson || null,
      normalized.phone || null,
      normalized.email || null,
      normalized.city || null,
      normalized.vacancy || null,
      normalized.subject || null,
      normalized.targetStore || null,
      normalized.message || null,
      normalized.metadata ? JSON.stringify(normalized.metadata) : null,
      normalized.sourcePage || null
    ]
  );

  const [rows] = await pool.query<IncomingRequestRow[]>(
    `
      SELECT id, request_type, full_name, company_name, contact_person, phone, email,
             city, vacancy, subject, target_store, message, metadata_json, source_page, status, created_at, updated_at
      FROM incoming_requests
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  if (rows.length === 0) {
    throw new Error('Failed to read inserted incoming request.');
  }

  return mapRow(rows[0]);
}

export class IncomingRequestReplayError extends Error {
  constructor(message: string, public readonly status: 409 | 503) { super(message); }
}

export function isValidSubmissionKey(value: string): boolean {
  return /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonicalValue(item)]));
  return value;
}

export async function createIncomingRequestInDb(input: IncomingRequestCreateInput, submissionKey?: string): Promise<IncomingRequestRecord> {
  const normalized = normalizeIncomingRequestInput(input);
  normalized.metadata = normalized.metadata ? publicMetadata(normalized.metadata) : null;
  const pool = getDbPool();
  // Existing bot and API callers without a receipt key keep their existing behavior.
  if (!submissionKey) return insertIncomingRequest(normalized, pool);
  if (!isValidSubmissionKey(submissionKey)) throw new IncomingRequestReplayError('Некоректний ключ відправлення. Оновіть форму.', 409);
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const key = hash(submissionKey);
  const fingerprint = hash(JSON.stringify(canonicalValue(normalized)));
  const lockName = `request:${hash(`${process.env.DB_NAME || ''}:${normalized.requestType}:${key}`).slice(0, 56)}`;
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [locks] = await connection.query<Array<RowDataPacket & { acquired: number | null }>>('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
    if (Number(locks[0]?.acquired) !== 1) throw new IncomingRequestReplayError('Заявка ще обробляється. Спробуйте повторити за кілька секунд.', 503);
    locked = true;
    const [receipts] = await connection.query<Array<RowDataPacket & { id: number; submission_fingerprint: string }>>(
      `SELECT id, JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$._submissionFingerprint')) AS submission_fingerprint
       FROM incoming_requests WHERE request_type = ? AND created_at >= CURRENT_TIMESTAMP - INTERVAL 24 HOUR
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$._submissionKey')) = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      [normalized.requestType, key]
    );
    if (receipts.length) {
      if (receipts[0].submission_fingerprint !== fingerprint) throw new IncomingRequestReplayError('Повторне відправлення містить інші дані. Оновіть форму та повторіть.', 409);
      const existing = await readIncomingRequest(receipts[0].id, connection);
      if (!existing) throw new IncomingRequestReplayError('Не вдалося підтвердити попереднє відправлення. Спробуйте ще раз.', 503);
      return existing;
    }
    return await insertIncomingRequest({ ...normalized, metadata: { ...normalized.metadata, _submissionKey: key, _submissionFingerprint: fingerprint } }, connection);
  } finally {
    let reusable = true;
    if (locked) {
      try { await connection.query('SELECT RELEASE_LOCK(?)', [lockName]); }
      catch { connection.destroy(); reusable = false; }
    }
    if (reusable) connection.release();
  }
}

export async function getIncomingRequestByIdFromDb(requestId: number): Promise<IncomingRequestRecord | null> {
  return readIncomingRequest(requestId, getDbPool());
}

async function readIncomingRequest(requestId: number, executor: RequestExecutor): Promise<IncomingRequestRecord | null> {
  const [rows] = await executor.query<IncomingRequestRow[]>(
    `SELECT id, request_type, full_name, company_name, contact_person, phone, email,
            city, vacancy, subject, target_store, message, metadata_json, source_page, status, created_at, updated_at
     FROM incoming_requests WHERE id = ? LIMIT 1`,
    [requestId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

type ListIncomingRequestsOptions = {
  limit?: number;
  status?: IncomingRequestStatus;
  requestType?: IncomingRequestType;
  query?: string;
};

export async function listIncomingRequestsFromDb(options: ListIncomingRequestsOptions = {}): Promise<IncomingRequestRecord[]> {
  const pool = getDbPool();
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (options.status) {
    where.push('status = ?');
    values.push(options.status);
  }

  if (options.requestType) {
    where.push('request_type = ?');
    values.push(options.requestType);
  }

  const query = String(options.query ?? '').trim();
  if (query) {
    where.push(`(
      full_name LIKE ? OR company_name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ? OR
      vacancy LIKE ? OR subject LIKE ? OR target_store LIKE ? OR message LIKE ?
    )`);
    const likeValue = `%${query}%`;
    for (let index = 0; index < 10; index += 1) values.push(likeValue);
  }

  const limit = Math.min(Math.max(Number(options.limit ?? 300), 1), 1000);
  values.push(limit);

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query<IncomingRequestRow[]>(
    `
      SELECT id, request_type, full_name, company_name, contact_person, phone, email,
             city, vacancy, subject, target_store, message, metadata_json, source_page, status, created_at, updated_at
      FROM incoming_requests
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    values
  );

  return rows.map(mapRow);
}

export async function updateIncomingRequestStatusInDb(
  requestId: number,
  status: IncomingRequestStatus
): Promise<IncomingRequestRecord | null> {
  const pool = getDbPool();
  const normalizedStatus = normalizeIncomingRequestStatus(status);
  await pool.query('UPDATE incoming_requests SET status = ? WHERE id = ?', [normalizedStatus, requestId]);

  const [rows] = await pool.query<IncomingRequestRow[]>(
    `
      SELECT id, request_type, full_name, company_name, contact_person, phone, email,
             city, vacancy, subject, target_store, message, metadata_json, source_page, status, created_at, updated_at
      FROM incoming_requests
      WHERE id = ?
      LIMIT 1
    `,
    [requestId]
  );

  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function countIncomingRequestsInDb(status?: IncomingRequestStatus): Promise<number> {
  const pool = getDbPool();
  const whereSql = status ? 'WHERE status = ?' : '';
  const values: Array<string> = status ? [status] : [];

  const [rows] = await pool.query<Array<RowDataPacket & { total: number }>>(
    `
      SELECT COUNT(*) AS total
      FROM incoming_requests
      ${whereSql}
    `,
    values
  );

  const total = Number(rows?.[0]?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}
