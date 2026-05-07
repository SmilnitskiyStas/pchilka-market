import { NextResponse } from 'next/server';

import { getAdminSessionFromRequest, isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { advanceInventoryImportJob, createInventoryImportJob, readImportJobStatus } from '@/lib/inventory-import-jobs';
import { readLatestInventoryProductImportLogFile } from '@/lib/inventory-import-log-files';
import { parseInventoryProductsWorkbook } from '@/lib/inventory-xlsx-import';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const latest = url.searchParams.get('latest');
    const jobId = String(url.searchParams.get('jobId') ?? '').trim();
    const shouldAdvance = url.searchParams.get('advance') === '1';

    if (jobId) {
      const importJob = shouldAdvance ? await advanceInventoryImportJob(jobId) : await readImportJobStatus(jobId);
      return NextResponse.json({ ok: true, importJob });
    }

    if (latest !== '1') {
      return NextResponse.json({ ok: false, error: 'Unsupported query.' }, { status: 400 });
    }

    const importLog = await readLatestInventoryProductImportLogFile();
    return NextResponse.json({ ok: true, importLog });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося прочитати дані імпорту.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Файл не передано.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ ok: false, error: 'Потрібен файл у форматі .xlsx.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);
    const rows = parseInventoryProductsWorkbook(fileBuffer);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'У файлі не знайдено жодного рядка для імпорту.' }, { status: 400 });
    }

    const session = getAdminSessionFromRequest(request);
    const importJob = await createInventoryImportJob({
      fileName: file.name,
      importedBy: session?.username || 'admin',
      rows
    });

    return NextResponse.json({ ok: true, importJob });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося імпортувати товари з Excel.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
