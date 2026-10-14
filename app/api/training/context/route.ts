import { NextResponse } from 'next/server';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { listTrainingAttemptsForUser, listTrainingCatalogForUser } from '@/lib/training-tests-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const user = await resolveInventorySessionUserFromToken(token);
    const [catalog, attempts] = await Promise.all([listTrainingCatalogForUser(user.id), listTrainingAttemptsForUser(user.id)]);
    return NextResponse.json({ ok: true, user: { name: user.name, surname: user.surname }, catalog, attempts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити тести.' }, { status: 401 });
  }
}
