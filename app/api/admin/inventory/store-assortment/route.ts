import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { parseInventoryStoreAssortmentWorkbook } from '@/lib/inventory-store-assortment-xlsx';
import {
  addManualStoreInventoryAssortmentItemInDb,
  clearStoreInventoryAssortmentInDb,
  getStoreInventoryAssortmentSummaryFromDb,
  importStoreInventoryAssortmentFromRows,
  listStoreInventoryAssortmentFromDb,
  upsertStoreInventoryAssortmentSnapshotInDb,
  updateStoreInventoryAssortmentItemInDb
} from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

function parseStoreId(raw: string | null) {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const storeId = parseStoreId(url.searchParams.get('storeId'));
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин.' }, { status: 400 });
    }

    const q = String(url.searchParams.get('q') ?? '').trim();
    const presentParam = String(url.searchParams.get('present') ?? 'all').trim();
    const statusParam = String(url.searchParams.get('status') ?? 'all').trim();

    const [items, summary] = await Promise.all([
      listStoreInventoryAssortmentFromDb(storeId, {
        query: q,
        present: presentParam === 'present' || presentParam === 'missing' ? presentParam : 'all',
        status: statusParam === 'matched' || statusParam === 'unmatched' ? statusParam : 'all'
      }),
      getStoreInventoryAssortmentSummaryFromDb(storeId)
    ]);

    return NextResponse.json({ ok: true, items, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити асортимент магазину.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const storeId = parseStoreId(String(formData.get('storeId') ?? ''));
      const file = formData.get('file');

      if (!storeId) {
        return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин для імпорту.' }, { status: 400 });
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: 'Файл не передано.' }, { status: 400 });
      }
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        return NextResponse.json({ ok: false, error: 'Потрібен файл у форматі .xlsx.' }, { status: 400 });
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const rows = parseInventoryStoreAssortmentWorkbook(fileBuffer);
      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: 'У файлі не знайдено жодного товару для імпорту.' }, { status: 400 });
      }

      const summary = await importStoreInventoryAssortmentFromRows(storeId, rows);
      await upsertStoreInventoryAssortmentSnapshotInDb(storeId);
      return NextResponse.json({ ok: true, summary });
    }

    const body = (await request.json()) as {
      storeId?: string | number;
      productId?: string | number;
      quantity?: number | null;
      isPresent?: boolean;
      notes?: string;
    };

    const storeId = parseStoreId(String(body.storeId ?? ''));
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин.' }, { status: 400 });
    }
    if (!body.productId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати товар каталогу.' }, { status: 400 });
    }

    const item = await addManualStoreInventoryAssortmentItemInDb(storeId, {
      productId: body.productId,
      quantity: body.quantity,
      isPresent: body.isPresent,
      notes: body.notes
    });
    const summary = await getStoreInventoryAssortmentSummaryFromDb(storeId);
    await upsertStoreInventoryAssortmentSnapshotInDb(storeId);
    return NextResponse.json({ ok: true, item, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося зберегти товар магазину.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      storeId?: string | number;
      itemId?: string | number;
      quantity?: number | null;
      isPresent?: boolean;
      notes?: string;
      productId?: string | number | null;
    };

    const storeId = parseStoreId(String(body.storeId ?? ''));
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин.' }, { status: 400 });
    }

    const item = await updateStoreInventoryAssortmentItemInDb(storeId, {
      itemId: String(body.itemId ?? ''),
      quantity: body.quantity,
      isPresent: body.isPresent,
      notes: body.notes,
      productId: body.productId
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: 'Запис асортименту не знайдено.' }, { status: 404 });
    }

    const summary = await getStoreInventoryAssortmentSummaryFromDb(storeId);
    await upsertStoreInventoryAssortmentSnapshotInDb(storeId);
    return NextResponse.json({ ok: true, item, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося оновити товар магазину.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const storeId = parseStoreId(url.searchParams.get('storeId'));
    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин.' }, { status: 400 });
    }

    const clearedCount = await clearStoreInventoryAssortmentInDb(storeId);
    const summary = await getStoreInventoryAssortmentSummaryFromDb(storeId);
    await upsertStoreInventoryAssortmentSnapshotInDb(storeId);
    return NextResponse.json({ ok: true, clearedCount, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося очистити асортимент магазину.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
