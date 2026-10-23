import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { ruleAnalytics } from '@/lib/loyalty-rule-analytics';

export const runtime = 'nodejs';

function validDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function makeSheet(title: string, period: string, headers: string[], rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([[title], [period], [], headers, ...rows]);
  sheet['!cols'] = headers.map((header, index) => ({ wch: index === 1 ? 48 : Math.max(13, header.length + 3) }));
  sheet['!autofilter'] = { ref: `A4:${XLSX.utils.encode_col(headers.length - 1)}${rows.length + 4}` };
  return sheet;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const rule = Number(url.searchParams.get('rule') || 836);
    const from = validDate(url.searchParams.get('from'));
    const to = validDate(url.searchParams.get('to'));
    const store = String(Number(url.searchParams.get('store') || 0) || '');
    if (!Number.isInteger(rule) || rule < 1) return NextResponse.json({ ok: false, error: 'Некоректне правило.' }, { status: 400 });

    const analytics = await ruleAnalytics(rule, from, to, store);
    const period = `Період: ${from || 'початок даних'} — ${to || 'сьогодні'}`;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, makeSheet(`Правило ${rule} — магазини`, period, ['ТП', 'Магазин', 'Чеків', 'Позицій', 'Одиниць', 'Знижка, грн'], analytics.stores.map((item: any) => [item.shopCode, item.shopName || '', Number(item.orders), Number(item.lineCount), Number(item.units), Number(item.discountTotal)])), 'Магазини');
    XLSX.utils.book_append_sheet(workbook, makeSheet(`Правило ${rule} — товари`, period, ['Код товару', 'Назва товару', 'Штрихкод', 'Позицій', 'Одиниць', 'Знижка, грн'], analytics.products.map((item: any) => [item.productCode, item.productName || '', item.barcode || '', Number(item.lineCount), Number(item.units), Number(item.discountTotal)])), 'Товари');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      [`Правило ${rule} — підсумок`], [period], [],
      ['Чеків', Number(analytics.summary.orders || 0)], ['Позицій', Number(analytics.summary.lineCount || 0)], ['Одиниць', Number(analytics.summary.units || 0)], ['Знижка, грн', Number(analytics.summary.discountTotal || 0)],
      ['Перша операція', analytics.summary.firstAt || ''], ['Остання операція', analytics.summary.lastAt || '']
    ]), 'Підсумок');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const suffix = `${from || 'all'}_${to || 'today'}`;
    return new NextResponse(buffer, { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rule-${rule}-analytics-${suffix}.xlsx"`
    } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося сформувати Excel-файл.' }, { status: 500 });
  }
}
