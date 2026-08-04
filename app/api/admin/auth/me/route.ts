import { NextResponse } from 'next/server';

import { findAdminUserById } from '@/lib/admin-users-repository';
import { getAdminSessionFromRequest } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function parseDbUserIdFromSub(sub: string): number | null {
  if (!sub.startsWith('admin_user:')) return null;
  const id = Number(sub.replace('admin_user:', ''));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Потрібна авторизація admin.' }, { status: 401 });
  }

  const userId = parseDbUserIdFromSub(session.sub);
  if (!userId) {
    return NextResponse.json({
      ok: true,
      user: {
        id: null,
        login: session.username,
        role: 'admin',
        permissions: [],
        authProvider: 'legacy'
      }
    });
  }

  const user = await findAdminUserById(userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Користувача не знайдено.' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      role: user.role,
      permissions: user.permissions,
      authProvider: user.authProvider,
      isActive: user.isActive
    }
  });
}
