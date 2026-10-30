import { NextResponse } from 'next/server';

import { createIncomingRequestInDb, IncomingRequestReplayError, isValidSubmissionKey } from '@/lib/incoming-requests-repository';
import { isIncomingRequestType, normalizeIncomingRequestInput, type IncomingRequestCreateInput } from '@/lib/incoming-requests';
import { getCareerTelegramSettings } from '@/lib/career-telegram-settings-repository';

export const runtime = 'nodejs';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validatePayload(payload: IncomingRequestCreateInput): string | null {
  if (!isIncomingRequestType(payload.requestType)) {
    return 'Invalid request type.';
  }

  const normalized = normalizeIncomingRequestInput(payload);

  if (normalized.phone && !isValidPhone(normalized.phone)) {
    return 'Invalid phone number.';
  }

  if (normalized.email && !isValidEmail(normalized.email)) {
    return 'Invalid email.';
  }

  if (!normalized.message || normalized.message.length < 10) {
    return 'Message must be at least 10 characters.';
  }

  const hasAnyContact = Boolean(
    normalized.fullName ||
      normalized.contactPerson ||
      normalized.companyName ||
      normalized.phone ||
      normalized.email
  );

  if (!hasAnyContact) {
    return 'Request must contain at least one contact field.';
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IncomingRequestCreateInput;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    const validationError = validatePayload(body);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const submissionKey = request.headers.get('Idempotency-Key')?.trim();
    if (submissionKey !== undefined && !isValidSubmissionKey(submissionKey)) return NextResponse.json({ ok: false, error: 'Некоректний ключ відправлення.' }, { status: 400 });
    let input = body;
    if (body.requestType === 'career_application') {
      const normalized = normalizeIncomingRequestInput(body);
      const age = Number(normalized.metadata?.age);
      if (!normalized.fullName || !normalized.city || !isValidPhone(normalized.phone || '') || !isValidEmail(normalized.email || '') || !Number.isInteger(age) || age < 14 || age > 100) {
        return NextResponse.json({ ok: false, error: 'Укажіть ПІБ, місто, коректний телефон, email і вік від 14 до 100 років.' }, { status: 400 });
      }
      const { vacancies } = await getCareerTelegramSettings();
      if (!vacancies.includes(normalized.vacancy || '')) {
        return NextResponse.json({ ok: false, error: 'Ця вакансія вже недоступна. Оновіть сторінку й оберіть актуальну посаду.' }, { status: 409 });
      }
      // Website clients cannot mark applications as Telegram or attach a bot chat.
      input = {
        ...normalized,
        sourcePage: '/career',
        metadata: {
          channel: 'website',
          age,
          resumeLink: typeof normalized.metadata?.resumeLink === 'string' ? normalized.metadata.resumeLink.slice(0, 300) : '',
          attachment: normalized.metadata?.attachment ?? null
        }
      };
    }
    const created = await createIncomingRequestInDb(input, submissionKey);
    return NextResponse.json({ ok: true, request: created });
  } catch (error) {
    if (error instanceof IncomingRequestReplayError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status, ...(error.status === 503 ? { headers: { 'Retry-After': '1' } } : {}) });
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

