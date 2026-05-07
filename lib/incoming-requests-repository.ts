import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

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

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
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

export async function createIncomingRequestInDb(input: IncomingRequestCreateInput): Promise<IncomingRequestRecord> {
  const normalized = normalizeIncomingRequestInput(input);
  const pool = getDbPool();

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
