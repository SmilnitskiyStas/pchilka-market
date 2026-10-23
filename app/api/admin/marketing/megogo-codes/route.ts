import { NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2/promise';
import * as XLSX from 'xlsx';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getDbPool } from '@/lib/db';

export const runtime = 'nodejs';

const CAMPAIGN_KEY = 'megogo-843';
const CAMPAIGN_WHERE = "campaign_key LIKE 'megogo-843%'";
const PAGE_SIZE = 50;

function normalizeCode(value: unknown) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
}

function extractCodesFromText(text: string) {
  const codes: string[] = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const cells = line.split(/[;,]/).map(normalizeCode).filter(Boolean);
    if (cells.length > 1) throw new Error('У файлі має бути тільки одна колонка з кодами.');
    if (cells[0]) codes.push(cells[0]);
  }
  return codes;
}

function extractCodesFromWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('Файл Excel не містить аркушів.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], { header: 1, blankrows: false, defval: '' });
  const codes: string[] = [];
  for (const row of rows) {
    const cells = row.map(normalizeCode).filter(Boolean);
    if (cells.length > 1) throw new Error('У файлі має бути тільки одна колонка з кодами.');
    if (cells[0]) codes.push(cells[0]);
  }
  return codes;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get('q') ?? '').trim().slice(0, 255);
    const parsedPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const searchSql = query ? ' AND LOCATE(?, code_value) > 0' : '';
    const searchParams = query ? [query] : [];
    const pool = getDbPool();
    const [summaryResult, totalResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) total, SUM(status = 'available') available, SUM(status = 'issued') issued, MAX(last_presented_at) lastPresentedAt FROM megogo_code_issuance WHERE ${CAMPAIGN_WHERE}`),
      pool.query(`SELECT COUNT(*) total FROM megogo_code_issuance WHERE ${CAMPAIGN_WHERE}${searchSql}`, searchParams),
    ]);
    const total = Number((totalResult[0] as any[])[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const [rowsResult] = await pool.query(
      `SELECT id, campaign_key campaignKey, code_value codeValue, status, issued_at issuedAt, last_presented_at lastPresentedAt, issued_loyalty_code loyaltyCode, issued_check_total checkTotal, issued_order_code orderCode, issued_store_code storeCode, issued_workplace_id workplaceId, issued_rule_code ruleCode, created_at createdAt FROM megogo_code_issuance WHERE ${CAMPAIGN_WHERE}${searchSql} ORDER BY CASE WHEN status = 'issued' THEN 0 ELSE 1 END, issued_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...searchParams, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );

    return NextResponse.json({
      ok: true,
      summary: (summaryResult[0] as any[])[0] ?? { total: 0, available: 0, issued: 0, lastPresentedAt: null },
      rows: rowsResult,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages, query },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити коди MEGOGO.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'Оберіть файл з кодами.' }, { status: 400 });
    if (file.size === 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Файл має бути не порожнім і не більшим за 5 МБ.' }, { status: 400 });

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawCodes = name.endsWith('.xlsx') || name.endsWith('.xls')
      ? extractCodesFromWorkbook(buffer)
      : extractCodesFromText(buffer.toString('utf8'));
    const codes = [...new Set(rawCodes.map(normalizeCode).filter(Boolean))];
    if (codes.length === 0) return NextResponse.json({ ok: false, error: 'У файлі не знайдено кодів.' }, { status: 400 });
    if (codes.some((code) => code.length > 255)) return NextResponse.json({ ok: false, error: 'Один або кілька кодів задовгі.' }, { status: 400 });

    let added = 0;
    const pool = getDbPool();
    for (let offset = 0; offset < codes.length; offset += 1000) {
      const batch = codes.slice(offset, offset + 1000);
      const [result] = await pool.query<ResultSetHeader>('INSERT IGNORE INTO megogo_code_issuance (campaign_key, code_value) VALUES ?', [batch.map((code) => [CAMPAIGN_KEY, code])]);
      added += result.affectedRows;
    }
    return NextResponse.json({ ok: true, received: rawCodes.length, unique: codes.length, added, alreadyExists: codes.length - added });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося додати коди.' }, { status: 400 });
  }
}