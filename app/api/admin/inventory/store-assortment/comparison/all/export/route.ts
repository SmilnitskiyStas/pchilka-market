import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getAllStoreInventoryAssortmentComparisonByDatesInDb } from '@/lib/inventory-store-assortment-repository';

export const runtime = 'nodejs';

function safeFilePart(value: string) {
  return String(value || 'all-stores')
    .trim()
    .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'all-stores';
}

function normalizeDates(url: URL) {
  const rawDates = [
    ...url.searchParams.getAll('date'),
    ...(url.searchParams.get('dates') || '').split(','),
    url.searchParams.get('baselineDate') || '',
    url.searchParams.get('targetDate') || ''
  ];
  const dates = [...new Set(rawDates.map((value) => value.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
  return dates;
}

function percent(present: number, total: number) {
  return total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const dates = normalizeDates(url);
    if (dates.length < 2) {
      return NextResponse.json({ ok: false, error: 'Потрібно вказати щонайменше дві дати для звіту.' }, { status: 400 });
    }
    if (dates.length > 31) {
      return NextResponse.json({ ok: false, error: 'У звіті можна вказати не більше 31 дати.' }, { status: 400 });
    }

    const comparisons = await Promise.all(dates.map((date) => getAllStoreInventoryAssortmentComparisonByDatesInDb(date, date)));
    const stores = comparisons[comparisons.length - 1]?.rows ?? [];
    const byDate = new Map(dates.map((date, index) => [date, comparisons[index]]));

    const rows = stores.map((store) => {
      const row: Record<string, string | number> = { Магазин: store.storeLabel };
      const values: number[] = [];
      dates.forEach((date) => {
        const snapshot = byDate.get(date)?.rows.find((entry) => entry.storeId === store.storeId)?.target;
        const present = snapshot?.presentRows ?? 0;
        const total = snapshot?.totalRows ?? 0;
        values.push(present);
        row[`${date} — додано`] = present;
        row[`${date} — план`] = total;
        row[`${date} — заповненість, %`] = percent(present, total);
      });
      dates.slice(1).forEach((date, index) => {
        row[`Δ ${dates[index]} → ${date}`] = values[index + 1] - values[index];
      });
      row[`Δ ${dates[0]} → ${dates[dates.length - 1]}`] = values[values.length - 1] - values[0];
      return row;
    });

    const totalRow: Record<string, string | number> = { Магазин: 'РАЗОМ' };
    dates.forEach((date) => {
      const comparison = byDate.get(date);
      const total = comparison?.rows.reduce((sum, row) => sum + row.target.totalRows, 0) ?? 0;
      const present = comparison?.rows.reduce((sum, row) => sum + row.target.presentRows, 0) ?? 0;
      totalRow[`${date} — додано`] = present;
      totalRow[`${date} — план`] = total;
      totalRow[`${date} — заповненість, %`] = percent(present, total);
    });
    dates.slice(1).forEach((date, index) => {
      const current = Number(totalRow[`${date} — додано`] || 0);
      const previous = Number(totalRow[`${dates[index]} — додано`] || 0);
      totalRow[`Δ ${dates[index]} → ${date}`] = current - previous;
    });
    const first = Number(totalRow[`${dates[0]} — додано`] || 0);
    const last = Number(totalRow[`${dates[dates.length - 1]} — додано`] || 0);
    totalRow[`Δ ${dates[0]} → ${dates[dates.length - 1]}`] = last - first;
    rows.push(totalRow);

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!freeze'] = { xSplit: 1, ySplit: 1 };
    sheet['!cols'] = [{ wch: 34 }, ...Array(Math.max(0, Object.keys(rows[0] || {}).length - 1)).fill({ wch: 17 })];
    const summary = XLSX.utils.aoa_to_sheet([
      ['Звіт заповненості магазинів'],
      [`Період: ${dates[0]} — ${dates[dates.length - 1]}`],
      ['Дані', 'Кількість дат', 'Магазинів', 'Метрика'],
      ['Заповнення плану товарами, внесеними працівниками', dates.length, stores.length, 'унікальні товари']
    ]);
    summary['!cols'] = [{ wch: 52 }, { wch: 16 }, { wch: 14 }, { wch: 22 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Заповненість по магазинах');
    XLSX.utils.book_append_sheet(workbook, summary, 'Опис звіту');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `store-assortment-report-${safeFilePart(dates[0])}-to-${safeFilePart(dates[dates.length - 1])}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося сформувати Excel-звіт по всіх магазинах.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
