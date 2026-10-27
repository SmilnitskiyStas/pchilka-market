import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getPromotionCatalogPages, hasCatalogsAssignedToPage, normalizeCatalogPage, updatePromotionCatalogPages } from '@/lib/promotion-catalog-pages';
import type { PromotionCatalogPage } from '@/lib/promotion-catalog-page-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { return NextResponse.json({ ok: true, pages: await getPromotionCatalogPages() }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося завантажити сторінки каталогів.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as Partial<PromotionCatalogPage>;
    const page = normalizeCatalogPage({ ...body, id: randomUUID() });
    const pages = await updatePromotionCatalogPages((items) => [...items, page]);
    return NextResponse.json({ ok: true, pages, page }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as Partial<PromotionCatalogPage>;
    const page = normalizeCatalogPage(body);
    const pages = await updatePromotionCatalogPages((items) => {
      if (!items.some((item) => item.id === page.id)) throw new Error('Сторінку не знайдено.');
      return items.map((item) => item.id === page.id ? page : item);
    });
    return NextResponse.json({ ok: true, pages });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const { id } = await request.json() as { id?: string };
    if (!id) throw new Error('Оберіть сторінку.');
    if (await hasCatalogsAssignedToPage(id)) {
      return NextResponse.json({ ok: false, error: 'На цій сторінці є PDF-каталоги. Спочатку перенесіть їх на іншу сторінку або видаліть.' }, { status: 409 });
    }
    const pages = await updatePromotionCatalogPages((items) => {
      if (!items.some((item) => item.id === id)) throw new Error('Сторінку не знайдено.');
      return items.filter((item) => item.id !== id);
    });
    return NextResponse.json({ ok: true, pages });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося зберегти сторінку.' }, { status: 400 });
}
