import { NextResponse } from 'next/server';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { startTrainingAttempt } from '@/lib/training-tests-repository';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; testId?: number };
    const user = await resolveInventorySessionUserFromToken(String(body.token ?? ''));
    return NextResponse.json({ ok: true, ...(await startTrainingAttempt(user.id, Number(body.testId))) });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося почати тест.' }, { status: 400 }); }
}
