import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  completePosArchiveDay,
  storePosArchiveBatch,
  type PosArchiveBatch,
  type PosArchiveCompletion
} from '@/lib/pos-archive-storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sameSecret(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isBatch(value: unknown): value is PosArchiveBatch {
  if (!value || typeof value !== 'object') return false;
  const batch = value as Partial<PosArchiveBatch>;
  return batch.action === 'batch' && isDate(batch.archiveDay) && typeof batch.runId === 'string' &&
    Array.isArray(batch.orders) && batch.orders.length <= 250 &&
    Array.isArray(batch.items) && batch.items.length <= 25_000 &&
    Array.isArray(batch.payments) && batch.payments.length <= 10_000;
}

function isCompletion(value: unknown): value is PosArchiveCompletion {
  if (!value || typeof value !== 'object') return false;
  const completion = value as Partial<PosArchiveCompletion>;
  return completion.action === 'complete' && isDate(completion.archiveDay) && typeof completion.runId === 'string' &&
    Number.isSafeInteger(completion.orderCount) && Number.isSafeInteger(completion.itemCount) &&
    Number.isSafeInteger(completion.paymentCount) && Number.isSafeInteger(completion.batchCount);
}

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.POS_ARCHIVE_INGEST_SECRET?.trim() ?? '';
    const actualSecret = request.headers.get('x-pos-archive-secret')?.trim() ?? '';
    if (!expectedSecret || !sameSecret(actualSecret, expectedSecret)) {
      return NextResponse.json({ ok: false, error: 'Invalid archive secret.' }, { status: 401 });
    }

    const payload: unknown = await request.json();
    if (isBatch(payload)) {
      const result = await storePosArchiveBatch(payload);
      return NextResponse.json({ ok: true, result });
    }
    if (isCompletion(payload)) {
      const result = await completePosArchiveDay(payload);
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ ok: false, error: 'Invalid archive payload.' }, { status: 400 });
  } catch (error) {
    console.error('[pos-archive-ingest]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown archive error.' },
      { status: 500 }
    );
  }
}
