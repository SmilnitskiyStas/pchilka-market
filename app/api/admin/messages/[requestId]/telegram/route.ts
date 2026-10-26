import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { getIncomingRequestByIdFromDb } from '@/lib/incoming-requests-repository';
import { listCareerTelegramMessages } from '@/lib/career-telegram-messages-repository';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  if (!isAdminRequestAuthorized(request)) return unauthorizedAdminResponse();
  const { requestId } = await params;
  const id = Number(requestId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: 'Некоректний номер заявки.' }, { status: 400 });
  try {
    const incomingRequest = await getIncomingRequestByIdFromDb(id);
    if (incomingRequest?.requestType !== 'career_application' || incomingRequest.sourcePage !== 'telegram://career-bot') {
      return NextResponse.json({ ok: false, error: 'Для цієї заявки немає Telegram-діалогу.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, messages: await listCareerTelegramMessages(id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Не вдалося завантажити діалог.' }, { status: 500 });
  }
}
