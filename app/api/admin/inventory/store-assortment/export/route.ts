import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getStoreInventoryAssortmentSummaryFromDb,
  listStoreInventoryAssortmentFromDb
} from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

function parseStoreId(raw: string | null) {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function safeFilePart(value: string) {
  return String(value || 'store')
    .trim()
    .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'store';
}

function formatFileDatePart(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildWorkbookBuffer(input: {
  storeLabel: string;
  exportedAt: string;
  items: Awaited<ReturnType<typeof listStoreInventoryAssortmentFromDb>>;
  summary: Awaited<ReturnType<typeof getStoreInventoryAssortmentSummaryFromDb>>;
}) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Товари магазину, яких ще немає в програмі'],
    [`Магазин: ${input.storeLabel}`],
    [`Дата експорту: ${input.exportedAt}`],
    [`Не прив’язано: ${input.summary.unmatchedRows} із ${input.summary.presentRows} присутніх товарів`],
    []
  ]);

  XLSX.utils.sheet_add_json(
    worksheet,
    input.items.map((item, index) => ({
      '№': index + 1,
      'Назва товару': item.productName || '',
      'Артикул': item.article || '',
      'Штрихкод': item.barcode || '',
      'Од. вим.': item.unitsOfMeasurement || '',
      'Кількість': item.quantity ?? '',
      'Є в магазині': item.isPresent ? 'Так' : 'Ні',
      'Статус у програмі': item.matchStatus === 'matched' ? 'У програмі' : 'Не привʼязано',
      'Джерело': item.sourceKind === 'manual' ? 'Вручну' : 'Імпорт',
      'Нотатка': item.notes || '',
      'Оновлено': item.updatedAt ? item.updatedAt.slice(0, 10) : ''
    })),
    { origin: 'A6' }
  );

  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 38 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 28 },
    { wch: 14 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Не в програмі');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
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
    const storeLabel = String(url.searchParams.get('storeLabel') ?? `store-${storeId}`).trim() || `store-${storeId}`;
    const items = await listStoreInventoryAssortmentFromDb(storeId, {
      query: q,
      present: 'present',
      status: 'unmatched',
      limit: 10000
    });
    const summary = await getStoreInventoryAssortmentSummaryFromDb(storeId);
    const now = new Date();
    const exportedAt = now.toISOString().slice(0, 16).replace('T', ' ');
    const buffer = buildWorkbookBuffer({ storeLabel, exportedAt, items, summary });
    const fileName = `store-assortment-unmatched-${safeFilePart(storeLabel)}-${formatFileDatePart(now)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=\"${fileName}\"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося сформувати Excel-файл.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
