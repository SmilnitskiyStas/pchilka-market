import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { readHomeLoyaltyImage, saveHomeLoyaltyImage } from '@/lib/home-loyalty-image-repository';
import { validateHomeLoyaltyImage } from '@/lib/home-loyalty-image-settings';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  try { return NextResponse.json({ ok: true, settings: await readHomeLoyaltyImage() }, { headers }); }
  catch { return NextResponse.json({ ok: false, error: 'Не вдалося завантажити зображення програми лояльності.' }, { status: 500, headers }); }
}
export async function PUT(request: Request) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  let settings;
  try { settings = validateHomeLoyaltyImage((await request.json())?.settings); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Перевірте зображення.' }, { status: 400, headers }); }
  try {
    const saved = await saveHomeLoyaltyImage(settings);
    revalidatePath('/');
    return NextResponse.json({ ok: true, settings: saved }, { headers });
  } catch { return NextResponse.json({ ok: false, error: 'Не вдалося зберегти зображення.' }, { status: 500, headers }); }
}
