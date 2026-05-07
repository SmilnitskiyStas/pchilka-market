import { NextResponse } from 'next/server';

import type { HomeBanner } from '@/content/home-banners';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listBannersFromDb, replaceBannersInDb } from '@/lib/banners-repository';

export const runtime = 'nodejs';

function normalizeBanner(raw: Partial<HomeBanner>): HomeBanner {
  return {
    id: String(raw.id ?? `banner_${Date.now()}`),
    alt: String(raw.alt ?? '').trim(),
    src: String(raw.src ?? '').trim(),
    href: raw.href ? String(raw.href).trim() : undefined,
    isActive: raw.isActive !== false,
    publishFrom: raw.publishFrom ? String(raw.publishFrom).trim() : undefined,
    publishTo: raw.publishTo ? String(raw.publishTo).trim() : undefined
  };
}

function validateBanners(banners: HomeBanner[]) {
  for (const banner of banners) {
    if (!banner.alt) {
      throw new Error('ALT текст банера є обовʼязковим.');
    }

    if (!banner.src) {
      throw new Error('SRC банера є обовʼязковим.');
    }

    if (banner.src.startsWith('data:image/')) {
      throw new Error('Збереження base64-зображень для банерів заборонено. Використайте серверний upload або URL.');
    }
  }
}

export async function GET() {
  try {
    const banners = await listBannersFromDb();
    return NextResponse.json({ ok: true, banners });
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
    const body = (await request.json()) as { banners?: Partial<HomeBanner>[] };
    const banners = Array.isArray(body?.banners) ? body.banners.map(normalizeBanner) : [];
    validateBanners(banners);

    const saved = await replaceBannersInDb(banners);

    return NextResponse.json({ ok: true, banners: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
