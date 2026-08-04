import { createHmac, timingSafeEqual } from 'crypto';

import { NextResponse } from 'next/server';

import { findAdminUserByLogin } from '@/lib/admin-users-repository';
import { actionForHttpMethod, hasAdminPermission, resourceForAdminPath, type AdminPermission } from '@/lib/admin-permissions';
import { verifyPassword } from '@/lib/password-hash';

const SESSION_COOKIE_NAME = 'pchilka_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

type SessionPayload = {
  sub: string;
  username: string;
  expiresAt: number;
  role: 'admin' | 'editor';
  permissions: AdminPermission[];
};

function getEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function getDefaultAdminPassword(): string {
  return process.env.NODE_ENV === 'production' ? '' : 'admin12345';
}

function getLegacyAdminUsername(): string {
  return getEnv('ADMIN_USERNAME') || 'admin';
}

function getLegacyAdminPassword(): string {
  return getEnv('ADMIN_PASSWORD') || getDefaultAdminPassword();
}

function getSessionSecret(): string {
  return getEnv('ADMIN_SESSION_SECRET') || 'pchilka-dev-admin-secret';
}

function shouldUseSecureAdminCookie(request?: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (!request) return true;

  const forwardedProto = request.headers.get('x-forwarded-proto')?.trim().toLowerCase();
  if (forwardedProto === 'http') {
    return false;
  }

  if (forwardedProto === 'https') {
    return true;
  }

  try {
    const url = new URL(request.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return false;
    }
  } catch {
    return true;
  }

  return true;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<{ ok: boolean; username?: string; sub?: string; role?: 'admin' | 'editor'; permissions?: AdminPermission[] }> {
  const login = normalizeLogin(username);
  if (!login || !password) return { ok: false };

  const dbUser = await findAdminUserByLogin(login).catch(() => null);
  if (dbUser && dbUser.isActive && dbUser.authProvider === 'local' && dbUser.passwordHash) {
    const isValid = await verifyPassword(password, dbUser.passwordHash).catch(() => false);
    if (isValid) {
      return { ok: true, username: dbUser.login, sub: `admin_user:${dbUser.id}`, role: dbUser.role, permissions: dbUser.permissions };
    }
  }

  // Transitional fallback (env). Keep until DB users are fully adopted.
  const legacyUser = getLegacyAdminUsername();
  const legacyPassword = getLegacyAdminPassword();
  if (legacyPassword && login === legacyUser.toLowerCase() && password === legacyPassword) {
    return { ok: true, username: legacyUser, sub: `legacy:${legacyUser}`, role: 'admin', permissions: [] };
  }

  return { ok: false };
}

function createAdminSessionToken(payloadInput: { username: string; sub: string; role?: 'admin' | 'editor'; permissions?: AdminPermission[] }): string {
  const payload: SessionPayload = {
    sub: payloadInput.sub,
    username: payloadInput.username,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    role: payloadInput.role ?? 'admin',
    permissions: payloadInput.permissions ?? []
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseAdminSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const given = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!payload || typeof payload.username !== 'string' || typeof payload.sub !== 'string') return null;
    if (typeof payload.expiresAt !== 'number') return null;
    if (Date.now() > payload.expiresAt) return null;
    if (payload.role !== 'admin' && payload.role !== 'editor') return null;
    if (!Array.isArray(payload.permissions) || !payload.permissions.every((value) => typeof value === 'string')) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  return parseAdminSessionToken(token) !== null;
}

export function getAdminSessionFromToken(token: string | undefined): { username: string; sub: string; role: 'admin' | 'editor'; permissions: AdminPermission[] } | null {
  const parsed = parseAdminSessionToken(token);
  if (!parsed) return null;
  return { username: parsed.username, sub: parsed.sub, role: parsed.role, permissions: parsed.permissions };
}

export function applyAdminSessionCookie(
  response: NextResponse,
  session: { username: string; sub: string; role?: 'admin' | 'editor'; permissions?: AdminPermission[] },
  request?: Request
) {
  response.cookies.set(SESSION_COOKIE_NAME, createAdminSessionToken(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureAdminCookie(request),
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
}

export function getAdminSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

function getCookieValueFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;

  const pairs = header.split(';');
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split('=');
    if (rawName !== name) continue;
    return rest.join('=');
  }

  return undefined;
}

export function isAdminRequestAuthorized(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie');
  const token = getCookieValueFromHeader(cookieHeader, SESSION_COOKIE_NAME);
  const session = parseAdminSessionToken(token);
  if (!session) return false;

  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/admin/auth/me' || pathname === '/api/admin/auth/logout') return true;
  return hasAdminPermission(session.role, session.permissions, resourceForAdminPath(pathname), actionForHttpMethod(request.method));
}

export function getAdminSessionFromRequest(request: Request): { username: string; sub: string; role: 'admin' | 'editor'; permissions: AdminPermission[] } | null {
  const cookieHeader = request.headers.get('cookie');
  const token = getCookieValueFromHeader(cookieHeader, SESSION_COOKIE_NAME);
  const parsed = parseAdminSessionToken(token);
  if (!parsed) return null;
  return { username: parsed.username, sub: parsed.sub, role: parsed.role, permissions: parsed.permissions };
}

export function unauthorizedAdminResponse() {
  return NextResponse.json({ ok: false, error: 'Потрібна авторизація admin.' }, { status: 401 });
}
