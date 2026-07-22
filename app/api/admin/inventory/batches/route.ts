import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  createInventoryBatchInDb,
  findInventoryDuplicateBatchInDb,
  getInventoryBatchOverviewMetricsFromDb,
  listInventoryBatchesPageFromDb,
  mergeInventoryBatchQuantityInDb,
  withInventoryBatchDuplicateLock
} from '@/lib/inventory-batches-repository';
import { normalizeInventoryBatchInput } from '@/lib/inventory-batch-types';
import { upsertStoreInventoryAssortmentSnapshotInDb } from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') ?? 200);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1), 500);
    const storeId = url.searchParams.get('storeId');
    const cursorBatchId = url.searchParams.get('cursorBatchId');
    const [batchPage, metrics] = await Promise.all([
      listInventoryBatchesPageFromDb({ limit: limit + 1, storeId, cursorBatchId }),
      getInventoryBatchOverviewMetricsFromDb(storeId)
    ]);
    const hasMore = batchPage.length > limit;
    const batches = hasMore ? batchPage.slice(0, limit) : batchPage;
    const nextCursorBatchId = hasMore ? batches[batches.length - 1]?.id ?? null : null;
    return NextResponse.json({ ok: true, batches, metrics, hasMore, nextCursorBatchId });
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
    const body = (await request.json()) as { batch?: unknown; duplicateAction?: 'merge' };
    const normalized = normalizeInventoryBatchInput((body?.batch ?? {}) as Record<string, unknown>);
    return await withInventoryBatchDuplicateLock(normalized, async (executor) => {
      const duplicateBatch = await findInventoryDuplicateBatchInDb(
        {
          storeId: normalized.storeId,
          productId: normalized.productId,
          expiryDate: normalized.expiryDate
        },
        executor
      );

      if (duplicateBatch && body?.duplicateAction !== 'merge') {
        return NextResponse.json(
          {
            ok: false,
            error: 'У цьому магазині вже є така партія з цим самим терміном придатності.',
            duplicateBatch
          },
          { status: 409 }
        );
      }

      if (duplicateBatch) {
        const batch = await mergeInventoryBatchQuantityInDb(
          {
            batchId: duplicateBatch.id,
            quantity: normalized.quantity,
            batchCode: normalized.batchCode,
            deliveryDate: normalized.deliveryDate,
            notifiedDays: normalized.notifiedDays
          },
          executor
        );
        await upsertStoreInventoryAssortmentSnapshotInDb(Number(normalized.storeId));
        return NextResponse.json({ ok: true, batch, resolution: 'merged' });
      }

      const batch = await createInventoryBatchInDb(normalized, executor);
      await upsertStoreInventoryAssortmentSnapshotInDb(Number(normalized.storeId));
      return NextResponse.json({ ok: true, batch, resolution: 'created' });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити партію.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
