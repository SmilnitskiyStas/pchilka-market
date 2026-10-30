import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listVisualPages } from '@/lib/visual-pages-repository';
import { visualPageHref } from '@/lib/visual-pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try {
    const pages = (await listVisualPages()).flatMap((record) => record.published ? [{
      label: record.published.title,
      href: visualPageHref(record.published.slug)
    }] : []);
    return NextResponse.json({ ok: true, pages }, { headers });
  } catch {
    return NextResponse.json({ ok: false, error: 'Не вдалося завантажити створені сторінки.' }, { status: 500, headers });
  }
}
