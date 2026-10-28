import { NextResponse } from 'next/server';
import { getPublicSiteMenu } from '@/lib/public-menu';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json(await getPublicSiteMenu()); }
  catch { return NextResponse.json({ error: 'Не вдалося завантажити меню.' }, { status: 500 }); }
}
