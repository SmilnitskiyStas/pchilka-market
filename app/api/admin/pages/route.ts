import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listVisualPages, saveVisualPage, getVisualPage, renameVisualPage, PageConflictError } from '@/lib/visual-pages-repository';
import { validateVisualPage, type PageSaveAction } from '@/lib/visual-pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { return NextResponse.json({ ok: true, pages: await listVisualPages() }, { headers: privateHeaders }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося завантажити сторінки.' }, { status: 500, headers: privateHeaders }); }
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  let payload;
  try {
    payload = await request.json();
    if (!payload || typeof payload.slug !== 'string' || !Number.isSafeInteger(payload.revision) || payload.revision < 1 || !['rename', 'restore'].includes(payload.action)) throw new Error();
    if (payload.action === 'rename' && (typeof payload.newSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.newSlug) || payload.newSlug.length > 100 || payload.slug === payload.newSlug || payload.slug === 'rental-intro' || payload.newSlug === 'rental-intro')) throw new Error();
    if (payload.action === 'restore' && !Number.isSafeInteger(payload.restoreRevision)) throw new Error();
  } catch { return NextResponse.json({ ok: false, error: 'Перевірте дію, версію та нову адресу сторінки.' }, { status: 400 }); }
  try {
    let page;
    if (payload.action === 'rename') page = await renameVisualPage(payload.slug, payload.newSlug, payload.revision);
    else {
      const current = await getVisualPage(payload.slug);
      if (!current || current.revision !== payload.revision || current.draft.slug !== payload.slug) throw new PageConflictError();
      const snapshot = current.history?.find((item) => item.revision === payload.restoreRevision);
      if (!snapshot) return NextResponse.json({ ok: false, error: 'Версія вже недоступна в історії.' }, { status: 404 });
      page = await saveVisualPage({ ...snapshot.draft, slug: current.draft.slug }, current.revision, 'save');
    }
    return NextResponse.json({ ok: true, page }, { headers: privateHeaders });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof PageConflictError ? error.message : 'Не вдалося виконати дію зі сторінкою.' }, { status: error instanceof PageConflictError ? 409 : 500 }); }
}
export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  let page, revision: number, action: PageSaveAction;
  try {
    const payload = await request.json();
    if (!['save', 'publish', 'unpublish'].includes(payload.action)) throw new Error('Оберіть дію зі сторінкою.');
    action = payload.action;
    revision = payload.revision;
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Невірна версія сторінки.');
    page = validateVisualPage(payload.page, action === 'publish');
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Перевірте дані сторінки.' }, { status: 400 });
  }
  try { return NextResponse.json({ ok: true, page: await saveVisualPage(page, revision, action) }, { headers: privateHeaders }); }
  catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof PageConflictError ? error.message : 'Не вдалося зберегти сторінку. Введені дані залишилися в редакторі.' }, { status: error instanceof PageConflictError ? 409 : 500 });
  }
}
