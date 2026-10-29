import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { readEngineeringSettings } from '@/lib/engineering-settings';
import { runEngineeringMail } from '@/lib/engineering-mail';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { runSecret } = await readEngineeringSettings();
    const actual = request.headers.get('x-engineering-secret') || '';
    if (!runSecret || Buffer.byteLength(actual) !== Buffer.byteLength(runSecret) || !timingSafeEqual(Buffer.from(actual), Buffer.from(runSecret))) return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.json({ ok: true, result: await runEngineeringMail() });
  } catch { return NextResponse.json({ ok: false, error: 'Не вдалося перевірити інженерну пошту або доставити повідомлення.' }, { status: 500 }); }
}
