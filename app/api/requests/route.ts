import { NextResponse } from 'next/server';

import { createIncomingRequestInDb } from '@/lib/incoming-requests-repository';
import { isIncomingRequestType, normalizeIncomingRequestInput, type IncomingRequestCreateInput } from '@/lib/incoming-requests';

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
    const validationError = validatePayload(body);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const created = await createIncomingRequestInDb(body);
    return NextResponse.json({ ok: true, request: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

