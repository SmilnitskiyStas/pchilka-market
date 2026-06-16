import { NextResponse } from 'next/server';

import {
  getAdminSessionFromRequest,
  isAdminRequestAuthorized,
  unauthorizedAdminResponse
} from '@/lib/admin-auth';
import { listInventoryManualProductCreationsFromDb } from '@/lib/inventory-activity-logs-repository';
import { updateInventoryProductApprovalInDb } from '@/lib/inventory-products-repository';
import { normalizeInventoryProductInput } from '@/lib/inventory-product-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 100);
    const status = String(url.searchParams.get('status') ?? '').trim();
    const items = await listInventoryManualProductCreationsFromDb(limit);
    const filteredItems = status ? items.filter((item) => item.approvalStatus === status) : items;
    return NextResponse.json({ ok: true, items: filteredItems });
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
      productId?: number;
      action?: 'approve' | 'reject' | 'update';
      note?: string;
      product?: Record<string, unknown>;
    };

    const productId = Number(body.productId ?? 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json({ ok: false, error: 'Некоректний товар для погодження.' }, { status: 400 });
    }

    const action = body.action;
    if (!action || !['approve', 'reject', 'update'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Некоректна дія погодження.' }, { status: 400 });
    }

    const product = body.product ? normalizeInventoryProductInput(body.product) : null;
    if (product) {
      if (!product.article || !product.productName || !product.unitsOfMeasurement) {
        return NextResponse.json(
          { ok: false, error: 'Для редагування потрібно вказати артикул, назву товару та одиницю вимірювання.' },
          { status: 400 }
        );
      }
    }

    if (action === 'reject' && !String(body.note ?? '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'Для відхилення потрібно вказати примітку.' },
        { status: 400 }
      );
    }

    const updatedProduct = await updateInventoryProductApprovalInDb({
      productId,
      action,
      // Admin auth uses `admin_users`, while inventory approval foreign keys point to `users`.
      // Passing the admin id here can break approval with FK errors on production.
      reviewedByUserId: null,
      changedBy: getAdminSessionFromRequest(request)?.username ?? 'admin',
      note: String(body.note ?? ''),
      product
    });

    return NextResponse.json({ ok: true, product: updatedProduct });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
