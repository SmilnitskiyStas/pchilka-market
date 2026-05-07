import { NextResponse } from 'next/server';

import { getAdminSessionFromRequest, isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  listInventoryProductImportReviewItemsFromDb,
  updateInventoryProductImportReviewStatusInDb
} from '@/lib/inventory-product-audit-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const statusParam = String(url.searchParams.get('status') ?? 'pending');
    const status = statusParam === 'resolved' || statusParam === 'all' ? statusParam : 'pending';
    const limit = Number(url.searchParams.get('limit') ?? 100);
    const items = await listInventoryProductImportReviewItemsFromDb(status, limit);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      id?: number;
      status?: 'pending' | 'resolved';
      resolvedNote?: string;
    };

    const id = Number(body?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid review item id.' }, { status: 400 });
    }

    const status = body?.status === 'pending' ? 'pending' : 'resolved';
    const session = getAdminSessionFromRequest(request);

    await updateInventoryProductImportReviewStatusInDb(id, {
      status,
      resolvedBy: session?.username || 'admin',
      resolvedNote: String(body?.resolvedNote ?? '')
    });

    const items = await listInventoryProductImportReviewItemsFromDb('pending', 100);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
