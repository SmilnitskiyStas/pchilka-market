import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getStoreInventoryAssortmentComparisonByDatesInDb,
  listStoreInventoryAssortmentSnapshotsInDb
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

function buildWorkbookBuffer(input: {
  storeLabel: string;
  baselineDate: string;
  targetDate: string;
  comparison: Awaited<ReturnType<typeof getStoreInventoryAssortmentComparisonByDatesInDb>>;
  history: Awaited<ReturnType<typeof listStoreInventoryAssortmentSnapshotsInDb>>;
}) {
  const baseline = input.comparison.baselineSnapshot;
  const target = input.comparison.targetSnapshot;
  const delta = input.comparison.delta;

  const overviewSheet = XLSX.utils.aoa_to_sheet([
    ['Порівняння заповненості магазину'],
    [`Магазин: ${input.storeLabel}`],
    [`Базова дата: ${input.baselineDate}`],
    [`Дата порівняння: ${input.targetDate}`],
    []
  ]);

  XLSX.utils.sheet_add_json(
    overviewSheet,
    [
      {
        Метрика: 'Усього рядків',
        [`На ${baseline?.snapshotDate || input.baselineDate}`]: baseline?.totalRows ?? 0,
        [`На ${target?.snapshotDate || input.targetDate}`]: target?.totalRows ?? 0,
        'Різниця': delta.totalRows
      },
      {
        Метрика: 'Присутні у магазині',
        [`На ${baseline?.snapshotDate || input.baselineDate}`]: baseline?.presentRows ?? 0,
        [`На ${target?.snapshotDate || input.targetDate}`]: target?.presentRows ?? 0,
        'Різниця': delta.presentRows
      },
      {
        Метрика: 'Вже в програмі',
        [`На ${baseline?.snapshotDate || input.baselineDate}`]: baseline?.matchedRows ?? 0,
        [`На ${target?.snapshotDate || input.targetDate}`]: target?.matchedRows ?? 0,
        'Різниця': delta.matchedRows
      },
      {
        Метрика: 'Ще не в програмі',
        [`На ${baseline?.snapshotDate || input.baselineDate}`]: baseline?.unmatchedRows ?? 0,
        [`На ${target?.snapshotDate || input.targetDate}`]: target?.unmatchedRows ?? 0,
        'Різниця': delta.unmatchedRows
      },
      {
        Метрика: 'Заповненість, %',
        [`На ${baseline?.snapshotDate || input.baselineDate}`]: baseline?.completionPercent ?? 0,
        [`На ${target?.snapshotDate || input.targetDate}`]: target?.completionPercent ?? 0,
        'Різниця': delta.completionPercent
      },
      {
        Метрика: 'Кількість товару',
        [`На ${baseline?.snapshotDate || input.baselineDate}`]: baseline?.quantityTotal ?? 0,
        [`На ${target?.snapshotDate || input.targetDate}`]: target?.quantityTotal ?? 0,
        'Різниця': delta.quantityTotal
      }
    ],
    { origin: 'A6' }
  );
  overviewSheet['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  const historySheet = XLSX.utils.json_to_sheet(
    input.history.map((item) => ({
      'Дата зрізу': item.snapshotDate,
      'Усього рядків': item.totalRows,
      'Присутні у магазині': item.presentRows,
      'Вже в програмі': item.matchedRows,
      'Ще не в програмі': item.unmatchedRows,
      'Заповненість, %': item.completionPercent,
      'Кількість товару': item.quantityTotal,
      'Створено': item.createdAt ? item.createdAt.slice(0, 19).replace('T', ' ') : ''
    }))
  );
  historySheet['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Порівняння');
  XLSX.utils.book_append_sheet(workbook, historySheet, 'Історія зрізів');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const storeId = parseStoreId(url.searchParams.get('storeId'));
    const baselineDate = String(url.searchParams.get('baselineDate') ?? '').trim();
    const targetDate = String(url.searchParams.get('targetDate') ?? '').trim();
    const storeLabel = String(url.searchParams.get('storeLabel') ?? `store-${storeId}`).trim() || `store-${storeId}`;

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати магазин.' }, { status: 400 });
    }
    if (!baselineDate || !targetDate) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати дві дати для порівняння.' }, { status: 400 });
    }

    const [comparison, history] = await Promise.all([
      getStoreInventoryAssortmentComparisonByDatesInDb(storeId, baselineDate, targetDate),
      listStoreInventoryAssortmentSnapshotsInDb(storeId, { limit: 60 })
    ]);

    const buffer = buildWorkbookBuffer({ storeLabel, baselineDate, targetDate, comparison, history });
    const fileName = `store-assortment-comparison-${safeFilePart(storeLabel)}-${baselineDate}-vs-${targetDate}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=\"${fileName}\"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося сформувати Excel з порівнянням.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
