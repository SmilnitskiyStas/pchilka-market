import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { normalizeInventoryUserRole, type InventoryUserRole } from '@/lib/inventory-user-roles';
import { listInventoryUsersFromDb, updateInventoryUserInDb } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const storeId = url.searchParams.get('storeId');
    const limit = Number(url.searchParams.get('limit') ?? 200);
    const users = await listInventoryUsersFromDb({ storeId, limit });
    return NextResponse.json({ ok: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      userId?: string | number;
      storeId?: string | number;
      role?: InventoryUserRole;
      positionTitle?: string;
      isActive?: boolean;
    };

    const user = await updateInventoryUserInDb({
      userId: body?.userId ?? '',
      storeId: body?.storeId ?? '',
      role: body?.role ? normalizeInventoryUserRole(body.role) : undefined,
      positionTitle: String(body?.positionTitle ?? ''),
      isActive: body?.isActive
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
