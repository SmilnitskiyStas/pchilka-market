import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  createInventoryBatchInDb,
  findInventoryDuplicateBatchInDb,
  listInventoryBatchesFromDb,
  mergeInventoryBatchQuantityInDb
} from '@/lib/inventory-batches-repository';
import { normalizeInventoryBatchInput } from '@/lib/inventory-batch-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 200);
    const storeId = url.searchParams.get('storeId');
    const batches = await listInventoryBatchesFromDb(limit, storeId);
    return NextResponse.json({ ok: true, batches });
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
    const body = (await request.json()) as { batch?: unknown; duplicateAction?: 'merge' | 'create_anyway' };
    const normalized = normalizeInventoryBatchInput((body?.batch ?? {}) as Record<string, unknown>);
    const duplicateBatch = await findInventoryDuplicateBatchInDb({
      storeId: normalized.storeId,
      productId: normalized.productId,
      expiryDate: normalized.expiryDate
    });

    if (duplicateBatch && body?.duplicateAction !== 'merge' && body?.duplicateAction !== 'create_anyway') {
      return NextResponse.json(
        {
          ok: false,
          error: 'У цьому магазині вже є така партія з цим самим терміном придатності.',
          duplicateBatch
        },
        { status: 409 }
      );
    }

    if (duplicateBatch && body?.duplicateAction === 'merge') {
      const batch = await mergeInventoryBatchQuantityInDb({
        batchId: duplicateBatch.id,
        quantity: normalized.quantity,
        batchCode: normalized.batchCode,
        deliveryDate: normalized.deliveryDate,
        notifiedDays: normalized.notifiedDays
      });
      return NextResponse.json({ ok: true, batch, resolution: 'merged' });
    }

    const batch = await createInventoryBatchInDb(normalized);
    return NextResponse.json({ ok: true, batch, resolution: 'created' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити партію.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
