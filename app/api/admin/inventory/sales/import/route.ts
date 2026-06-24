import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { importInventorySalesRowsInDb } from '@/lib/inventory-batch-sales-repository';
import { parseInventorySalesWorkbook } from '@/lib/inventory-sales-xlsx-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const dryRun = String(formData.get('dryRun') ?? '').trim() === '1';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Файл не передано.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ ok: false, error: 'Потрібен файл у форматі .xlsx.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const rows = parseInventorySalesWorkbook(Buffer.from(bytes));
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'У файлі не знайдено рядків продажів.' }, { status: 400 });
    }

    const importResult = await importInventorySalesRowsInDb({
      fileName: file.name,
      rows,
      saleSource: 'pos-xlsx',
      dryRun
    });

    return NextResponse.json({ ok: true, importResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося імпортувати продажі з Excel.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
