import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getSiteMenuSettings, saveSiteMenuSettings } from '@/lib/site-menu-repository';
import { normalizeSiteMenu } from '@/lib/site-menu';
import { getPopulatedMenuPaths } from '@/lib/public-menu';
import { contentPages } from '@/lib/menu-content';
import { getPromotionCatalogPages } from '@/lib/promotion-catalog-pages';
import { catalogPageHref } from '@/lib/promotion-catalog-page-types';
import { listVisualPages } from '@/lib/visual-pages-repository';
import { visualPageHref } from '@/lib/visual-pages';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const [settings, content, catalogs, visualPages] = await Promise.all([getSiteMenuSettings(), getPopulatedMenuPaths(), getPromotionCatalogPages(), listVisualPages()]);
    return NextResponse.json({ ok: true, settings, ...content, destinations: [...contentPages, ...catalogs.map((page) => ({ label: page.title, href: catalogPageHref(page) })), ...visualPages.flatMap((page) => page.published ? [{ label: page.published.title, href: visualPageHref(page.published.slug) }] : []), { label: 'Завантаження застосунку (QR)', href: '/qr-code/' }] });
  } catch { return NextResponse.json({ ok: false, error: 'Не вдалося завантажити меню.' }, { status: 500 }); }
}
export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  let settings;
  try { settings = normalizeSiteMenu((await request.json()).settings); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Перевірте меню.' }, { status: 400 }); }
  try { return NextResponse.json({ ok: true, settings: await saveSiteMenuSettings(settings) }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося зберегти меню.' }, { status: 500 }); }
}
