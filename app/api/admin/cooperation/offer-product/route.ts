import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getOfferProductSettings, saveOfferProductSettings } from '@/lib/offer-product-repository';
import { normalizeOfferProductSettings } from '@/lib/offer-product-settings';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { return NextResponse.json({ ok: true, settings: await getOfferProductSettings() }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося завантажити налаштування сторінки.' }, { status: 500 }); }
}
export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  let settings;
  try { settings = normalizeOfferProductSettings((await request.json()).settings); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Перевірте налаштування.' }, { status: 400 }); }
  try { return NextResponse.json({ ok: true, settings: await saveOfferProductSettings(settings) }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося зберегти налаштування. Спробуйте ще раз.' }, { status: 500 }); }
}
