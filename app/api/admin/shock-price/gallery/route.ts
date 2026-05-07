import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import {
  getShockPriceGalleryFromDb,
  saveShockPriceGalleryToDb
} from '@/lib/shock-price-gallery-repository';
import {
  normalizeShockPriceGallery,
  type ShockPriceGalleryItem
} from '@/lib/shock-price-gallery';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const items = await getShockPriceGalleryFromDb();
    return NextResponse.json({ ok: true, items });
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
    const body = (await request.json()) as { items?: Partial<ShockPriceGalleryItem>[] };
    const normalized = normalizeShockPriceGallery(body?.items ?? []);
    const saved = await saveShockPriceGalleryToDb(normalized);
    return NextResponse.json({ ok: true, items: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
