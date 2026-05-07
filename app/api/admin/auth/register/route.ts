import { NextResponse } from 'next/server';

import {
  countAdminUsersInDb,
  createAdminUserInDb,
  findAdminUserByLogin
} from '@/lib/admin-users-repository';
import { applyAdminSessionCookie, isAdminRequestAuthorized } from '@/lib/admin-auth';
import { hashPassword } from '@/lib/password-hash';

export const runtime = 'nodejs';

const LOGIN_PATTERN = /^[a-z0-9._-]{3,40}$/i;

function getBootstrapToken(): string {
  return process.env.ADMIN_BOOTSTRAP_TOKEN?.trim() ?? '';
}

function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDisplayName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      login?: string;
      password?: string;
      displayName?: string;
      bootstrapToken?: string;
    };

    const login = normalizeLogin(String(body?.login ?? ''));
    const password = String(body?.password ?? '');
    const displayName = normalizeDisplayName(String(body?.displayName ?? ''));
    const providedToken = String(body?.bootstrapToken ?? '');

    if (!LOGIN_PATTERN.test(login)) {
      return NextResponse.json(
        { ok: false, error: 'Логін має містити 3-40 символів: латиниця, цифри, ".", "_" або "-".' },
        { status: 400 }
      );
    }

    if (password.trim().length < 8) {
      return NextResponse.json({ ok: false, error: 'Пароль має містити щонайменше 8 символів.' }, { status: 400 });
    }

    const isAuthorizedAdmin = isAdminRequestAuthorized(request);
    const bootstrapToken = getBootstrapToken();
    const isValidBootstrap = bootstrapToken.length > 0 && providedToken === bootstrapToken;

    if (!isAuthorizedAdmin && !isValidBootstrap) {
      return NextResponse.json(
        { ok: false, error: 'Недостатньо прав для створення користувача (потрібен admin-сеанс або bootstrap token).' },
        { status: 403 }
      );
    }

    const usersCount = await countAdminUsersInDb().catch(() => 0);
    if (usersCount > 0 && !isAuthorizedAdmin && !isValidBootstrap) {
      return NextResponse.json({ ok: false, error: 'Створення користувачів дозволено лише для admin.' }, { status: 403 });
    }

    const existing = await findAdminUserByLogin(login);
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Користувач з таким логіном вже існує.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createAdminUserInDb({
      login,
      displayName,
      passwordHash,
      authProvider: 'local',
      role: 'admin'
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        role: user.role
      }
    });

    // Auto-login only when registration is performed without existing admin session.
    if (!isAuthorizedAdmin) {
      applyAdminSessionCookie(response, { username: user.login, sub: `admin_user:${user.id}` });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити admin-користувача.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
