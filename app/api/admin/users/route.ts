import { NextResponse } from 'next/server';

import {
  countActiveAdminsExcludingUser,
  createAdminUserInDb,
  deleteAdminUserById,
  findAdminUserById,
  findAdminUserByLogin,
  listAdminUsersFromDb
} from '@/lib/admin-users-repository';
import { getAdminSessionFromRequest, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { hashPassword } from '@/lib/password-hash';

export const runtime = 'nodejs';

const LOGIN_PATTERN = /^[a-z0-9._-]{3,40}$/i;

function parseDbUserIdFromSub(sub: string): number | null {
  if (!sub.startsWith('admin_user:')) return null;
  const id = Number(sub.replace('admin_user:', ''));
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

async function getCurrentUser(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) return null;

  const dbUserId = parseDbUserIdFromSub(session.sub);
  if (!dbUserId) {
    return { id: null, login: session.username, role: 'admin' as const };
  }

  const dbUser = await findAdminUserById(dbUserId);
  if (!dbUser || !dbUser.isActive) return null;

  return { id: dbUser.id, login: dbUser.login, role: dbUser.role };
}

export async function GET(request: Request) {
  const current = await getCurrentUser(request);
  if (!current) return unauthorizedAdminResponse();

  const users = await listAdminUsersFromDb();
  return NextResponse.json({
    ok: true,
    users: users.map((item) => ({
      id: item.id,
      login: item.login,
      displayName: item.displayName,
      role: item.role,
      authProvider: item.authProvider,
      isActive: item.isActive,
      lastLoginAt: item.lastLoginAt,
      createdAt: item.createdAt
    })),
    currentUser: current
  });
}

export async function POST(request: Request) {
  const current = await getCurrentUser(request);
  if (!current) return unauthorizedAdminResponse();
  if (current.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Недостатньо прав (потрібна роль admin).' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      login?: string;
      password?: string;
      displayName?: string;
      role?: 'admin' | 'editor';
    };

    const login = normalizeLogin(String(body?.login ?? ''));
    const password = String(body?.password ?? '');
    const displayName = String(body?.displayName ?? '').trim();
    const role = body?.role === 'editor' ? 'editor' : 'admin';

    if (!LOGIN_PATTERN.test(login)) {
      return NextResponse.json(
        { ok: false, error: 'Логін має містити 3-40 символів: латиниця, цифри, ".", "_" або "-".' },
        { status: 400 }
      );
    }

    if (password.trim().length < 8) {
      return NextResponse.json({ ok: false, error: 'Пароль має містити щонайменше 8 символів.' }, { status: 400 });
    }

    const existing = await findAdminUserByLogin(login);
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Користувач з таким логіном вже існує.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createAdminUserInDb({
      login,
      displayName: displayName || null,
      passwordHash,
      authProvider: 'local',
      role
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        role: user.role,
        authProvider: user.authProvider,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити користувача.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const current = await getCurrentUser(request);
  if (!current) return unauthorizedAdminResponse();
  if (current.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Недостатньо прав (потрібна роль admin).' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { userId?: number };
    const userId = Number(body?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ ok: false, error: 'Некоректний userId.' }, { status: 400 });
    }

    if (current.id && userId === current.id) {
      return NextResponse.json({ ok: false, error: 'Не можна видалити поточного користувача.' }, { status: 400 });
    }

    const target = await findAdminUserById(userId);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено.' }, { status: 404 });
    }

    if (target.role === 'admin') {
      const remainingAdmins = await countActiveAdminsExcludingUser(target.id);
      if (remainingAdmins === 0) {
        return NextResponse.json({ ok: false, error: 'Не можна видалити останнього admin-користувача.' }, { status: 400 });
      }
    }

    await deleteAdminUserById(target.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося видалити користувача.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
