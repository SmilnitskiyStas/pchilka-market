import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getAllStoreInventoryAssortmentComparisonByDatesInDb } from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

function safeFilePart(value: string) {
  return String(value || 'all-stores').trim().replace(/[^\p{L}\p{N}\-_]+/gu, '-').replace(/-+/g, '-') || 'all-stores';
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const baselineDate = String(url.searchParams.get('baselineDate') ?? '').trim();
    const targetDate = String(url.searchParams.get('targetDate') ?? '').trim();
    if (!baselineDate || !targetDate) {
      return NextResponse.json({ ok: false, error: 'Потрібно вибрати дві дати для порівняння.' }, { status: 400 });
    }

    const comparison = await getAllStoreInventoryAssortmentComparisonByDatesInDb(baselineDate, targetDate);
    const rows = comparison.rows.map((row) => ({
      'Магазин': row.storeLabel,
      [`План на ${baselineDate}`]: row.baseline.totalRows,
      [`Додано на ${baselineDate}`]: row.baseline.presentRows,
      [`Заповненість на ${baselineDate}, %`]: row.baseline.completionPercent,
      [`План на ${targetDate}`]: row.target.totalRows,
      [`Додано на ${targetDate}`]: row.target.presentRows,
      [`Заповненість на ${targetDate}, %`]: row.target.completionPercent,
      'Зміна доданих товарів': row.delta.presentRows,
      'Зміна заповненості, п.п.': row.delta.completionPercent,
      'Залишилось додати': row.target.unmatchedRows
    }));
    rows.push({
      'Магазин': 'РАЗОМ',
      [`План на ${baselineDate}`]: comparison.rows.reduce((sum, row) => sum + row.baseline.totalRows, 0),
      [`Додано на ${baselineDate}`]: comparison.rows.reduce((sum, row) => sum + row.baseline.presentRows, 0),
      [`Заповненість на ${baselineDate}, %`]: comparison.rows.length
        ? Number((comparison.rows.reduce((sum, row) => sum + row.baseline.presentRows, 0) / Math.max(1, comparison.rows.reduce((sum, row) => sum + row.baseline.totalRows, 0)) * 100).toFixed(2))
        : 0,
      [`План на ${targetDate}`]: comparison.rows.reduce((sum, row) => sum + row.target.totalRows, 0),
      [`Додано на ${targetDate}`]: comparison.rows.reduce((sum, row) => sum + row.target.presentRows, 0),
      [`Заповненість на ${targetDate}, %`]: comparison.rows.length
        ? Number((comparison.rows.reduce((sum, row) => sum + row.target.presentRows, 0) / Math.max(1, comparison.rows.reduce((sum, row) => sum + row.target.totalRows, 0)) * 100).toFixed(2))
        : 0,
      'Зміна доданих товарів': comparison.totals.presentRows,
      'Зміна заповненості, п.п.': comparison.totals.completionPercent,
      'Залишилось додати': comparison.rows.reduce((sum, row) => sum + row.target.unmatchedRows, 0)
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
      { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 18 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Всі магазини');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `store-assortment-all-${safeFilePart(baselineDate)}-vs-${safeFilePart(targetDate)}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося сформувати Excel по всіх магазинах.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
