import { NextResponse } from 'next/server';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getPublicProductDisplaySettings, savePublicProductDisplaySettings, type PublicProductDisplaySettings } from '@/lib/public-product-display-settings';
export const runtime = 'nodejs';
export async function GET(request: Request) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); try { return NextResponse.json({ ok:true, settings:await getPublicProductDisplaySettings() }); } catch { return NextResponse.json({ ok:false, error:'Не вдалося завантажити налаштування.' },{status:500}); } }
export async function PUT(request: Request) { if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse(); try { const body=await request.json() as { settings?:Partial<PublicProductDisplaySettings> }; return NextResponse.json({ ok:true, settings:await savePublicProductDisplaySettings(body.settings??{}) }); } catch { return NextResponse.json({ ok:false, error:'Не вдалося зберегти налаштування.' },{status:500}); } }
