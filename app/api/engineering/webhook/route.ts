import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { readEngineeringSettings } from '@/lib/engineering-settings';
import { ensureEngineeringSchema } from '@/lib/engineering-repository';
import { processEngineeringUpdate } from '@/lib/engineering-telegram';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { webhookSecret } = await readEngineeringSettings();
    const actual = request.headers.get('x-telegram-bot-api-secret-token') || '';
    if (!webhookSecret || Buffer.byteLength(actual) !== Buffer.byteLength(webhookSecret) || !timingSafeEqual(Buffer.from(actual), Buffer.from(webhookSecret))) return NextResponse.json({ ok: false }, { status: 401 });
    await ensureEngineeringSchema();
    await processEngineeringUpdate(await request.json());
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false, error: 'Помилка обробки Telegram.' }, { status: 500 }); }
}
