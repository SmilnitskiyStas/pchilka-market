import { NextResponse } from 'next/server';

import { touchAdminUserLastLogin } from '@/lib/admin-users-repository';
import { applyAdminSessionCookie, verifyAdminCredentials } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function parseDbUserIdFromSub(sub: string | undefined): number | null {
  if (!sub || !sub.startsWith('admin_user:')) return null;
  const id = Number(sub.replace('admin_user:', ''));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = String(body?.username ?? '');
    const password = String(body?.password ?? '');

    const verified = await verifyAdminCredentials(username, password);
    if (!verified.ok || !verified.username || !verified.sub) {
      return NextResponse.json({ ok: false, error: 'Невірний логін або пароль.' }, { status: 401 });
    }

    const dbUserId = parseDbUserIdFromSub(verified.sub);
    if (dbUserId) {
      await touchAdminUserLastLogin(dbUserId).catch(() => undefined);
    }

    const response = NextResponse.json({ ok: true, username: verified.username });
    applyAdminSessionCookie(response, { username: verified.username, sub: verified.sub, role: verified.role, permissions: verified.permissions }, request);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: 'Не вдалося виконати вхід.' }, { status: 400 });
  }
}
