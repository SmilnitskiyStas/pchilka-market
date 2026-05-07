import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  listPromotionsFromDb,
  replacePromotionsInDb
} from '@/lib/promotions-repository';
import type { PromotionRecord } from '@/lib/promotion-types';

export const runtime = 'nodejs';

function normalizePromotion(raw: Partial<PromotionRecord>): PromotionRecord {
  const status = raw.status === 'published' || raw.status === 'archived' ? raw.status : 'draft';

  return {
    id: String(raw.id ?? `promo_${Date.now()}`),
    slug: String(raw.slug ?? '').trim(),
    title: String(raw.title ?? '').trim(),
    shortDescription: String(raw.shortDescription ?? '').trim(),
    content: String(raw.content ?? '').trim(),
    imageUrl: String(raw.imageUrl ?? '').trim(),
    startsAt: raw.startsAt ? String(raw.startsAt).trim() : undefined,
    endsAt: raw.endsAt ? String(raw.endsAt).trim() : undefined,
    status,
    isWeekly: raw.isWeekly === true,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString())
  };
}

export async function GET() {
  try {
    const promotions = await listPromotionsFromDb();
    return NextResponse.json({ ok: true, promotions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { promotions?: Partial<PromotionRecord>[] };
    const promotions = Array.isArray(body?.promotions) ? body.promotions.map(normalizePromotion) : [];

    const invalid = promotions.find((item) => !item.slug || !item.title);
    if (invalid) {
      return NextResponse.json({ ok: false, error: 'Кожна акція повинна мати slug та title.' }, { status: 400 });
    }

    const saved = await replacePromotionsInDb(promotions);
    return NextResponse.json({ ok: true, promotions: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
