import { NextResponse } from 'next/server';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { answerTrainingAttempt } from '@/lib/training-tests-repository';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; attemptId?: number; questionId?: number; selectedOptionIds?: number[] };
    const user = await resolveInventorySessionUserFromToken(String(body.token ?? ''));
    const selected = Array.isArray(body.selectedOptionIds) ? body.selectedOptionIds : [];
    return NextResponse.json({ ok: true, ...(await answerTrainingAttempt(user.id, Number(body.attemptId), Number(body.questionId), selected)) });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося зберегти відповідь.' }, { status: 400 }); }
}
