import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import { type AdminPermission, normalizeAdminPermissions } from '@/lib/admin-permissions';

export type AdminUserRecord = {
  id: number;
  login: string;
  displayName: string | null;
  passwordHash: string | null;
  authProvider: 'local' | 'google';
  googleSub: string | null;
  email: string | null;
  role: 'admin' | 'editor';
  permissions: AdminPermission[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminUserRow = RowDataPacket & {
  id: number;
  login: string;
  display_name: string | null;
  password_hash: string | null;
  auth_provider: 'local' | 'google';
  google_sub: string | null;
  email: string | null;
  role: 'admin' | 'editor';
  permissions: string | AdminPermission[] | null;
  is_active: number;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CountRow = RowDataPacket & { total: number };

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapRow(row: AdminUserRow): AdminUserRecord {
  return {
    id: row.id,
    login: row.login,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    authProvider: row.auth_provider,
    googleSub: row.google_sub,
    email: row.email,
    role: row.role,
    permissions: normalizeAdminPermissions(typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions),
    isActive: row.is_active === 1,
    lastLoginAt: toIso(row.last_login_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString()
  };
}

export async function countAdminUsersInDb(): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM admin_users');
  return Number(rows[0]?.total ?? 0);
}

export async function findAdminUserByLogin(login: string): Promise<AdminUserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<AdminUserRow[]>(
    `
      SELECT id, login, display_name, password_hash, auth_provider, google_sub, email, role, permissions, is_active, last_login_at, created_at, updated_at
      FROM admin_users
      WHERE login = ?
      LIMIT 1
    `,
    [login]
  );

  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function findAdminUserById(id: number): Promise<AdminUserRecord | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<AdminUserRow[]>(
    `
      SELECT id, login, display_name, password_hash, auth_provider, google_sub, email, role, permissions, is_active, last_login_at, created_at, updated_at
      FROM admin_users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function createAdminUserInDb(input: {
  login: string;
  displayName?: string | null;
  passwordHash?: string | null;
  authProvider?: 'local' | 'google';
  googleSub?: string | null;
  email?: string | null;
  role?: 'admin' | 'editor';
  permissions?: AdminPermission[];
}): Promise<AdminUserRecord> {
  const pool = getDbPool();
  const [result] = await pool.query<ResultSetHeader>(
    `
      INSERT INTO admin_users (login, display_name, password_hash, auth_provider, google_sub, email, role, permissions, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      input.login,
      input.displayName ?? null,
      input.passwordHash ?? null,
      input.authProvider ?? 'local',
      input.googleSub ?? null,
      input.email ?? null,
      input.role ?? 'admin',
      JSON.stringify(normalizeAdminPermissions(input.permissions))
    ]
  );

  const [rows] = await pool.query<AdminUserRow[]>(
    `
      SELECT id, login, display_name, password_hash, auth_provider, google_sub, email, role, permissions, is_active, last_login_at, created_at, updated_at
      FROM admin_users
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Не вдалося створити admin-користувача.');
  }

  return mapRow(row);
}

export async function touchAdminUserLastLogin(userId: number): Promise<void> {
  const pool = getDbPool();
  await pool.query('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

export async function listAdminUsersFromDb(): Promise<AdminUserRecord[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<AdminUserRow[]>(
    `
      SELECT id, login, display_name, password_hash, auth_provider, google_sub, email, role, permissions, is_active, last_login_at, created_at, updated_at
      FROM admin_users
      ORDER BY created_at DESC
    `
  );

  return rows.map(mapRow);
}

export async function updateAdminUserPermissionsInDb(userId: number, permissions: AdminPermission[]): Promise<AdminUserRecord | null> {
  const pool = getDbPool();
  await pool.query('UPDATE admin_users SET permissions = ? WHERE id = ?', [JSON.stringify(normalizeAdminPermissions(permissions)), userId]);
  return findAdminUserById(userId);
}

export async function deleteAdminUserById(userId: number): Promise<void> {
  const pool = getDbPool();
  await pool.query('DELETE FROM admin_users WHERE id = ?', [userId]);
}

export async function countActiveAdminsExcludingUser(userId: number): Promise<number> {
  const pool = getDbPool();
  const [rows] = await pool.query<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM admin_users
      WHERE role = 'admin' AND is_active = 1 AND id <> ?
    `,
    [userId]
  );

  return Number(rows[0]?.total ?? 0);
}
