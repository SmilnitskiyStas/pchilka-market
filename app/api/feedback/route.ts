import { NextResponse } from 'next/server';

import { getDbPool } from '@/lib/db';
import { createIncomingRequestInDb } from '@/lib/incoming-requests-repository';

export const runtime = 'nodejs';

type FeedbackPayload = {
  fullName?: string;
  phone?: string;
  email?: string;
  message?: string;
  sourcePage?: string;
  attachment?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    lastModified?: number;
    url?: string;
  } | null;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackPayload;

    const fullName = String(body.fullName ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const email = String(body.email ?? '').trim();
    const baseMessage = String(body.message ?? '').trim();
    const sourcePage = String(body.sourcePage ?? '').trim();

    if (!fullName || !isValidPhone(phone) || !isValidEmail(email) || baseMessage.length < 10) {
      return NextResponse.json({ ok: false, error: 'Некоректні дані форми.' }, { status: 400 });
    }

    const attachment = body.attachment;
    const attachmentText = attachment?.fileName
      ? `\n\n[attachment] ${attachment.fileName} (${Math.max(1, Math.round(Number(attachment.fileSize ?? 0) / 1024))} KB, ${String(
          attachment.fileType ?? 'unknown'
        )})`
      : '';
    const message = `${baseMessage}${attachmentText}`.slice(0, 5000);

    const pool = getDbPool();
    await pool.query(
      `
        INSERT INTO feedback_requests (full_name, phone, email, subject, message, status, source_page)
        VALUES (?, ?, ?, ?, ?, 'new', ?)
      `,
      [fullName.slice(0, 255), phone.slice(0, 60), email.slice(0, 255), 'header_feedback', message, sourcePage.slice(0, 255)]
    );

    await createIncomingRequestInDb({
      requestType: 'header_feedback',
      fullName: fullName.slice(0, 255),
      phone: phone.slice(0, 60),
      email: email.slice(0, 255),
      subject: 'header_feedback',
      message,
      sourcePage: sourcePage.slice(0, 255),
      metadata: attachment?.fileName
        ? {
            attachment: {
              fileName: String(attachment.fileName),
              fileSize: Number(attachment.fileSize ?? 0),
              fileType: String(attachment.fileType ?? ''),
              lastModified: Number(attachment.lastModified ?? 0),
              url: typeof attachment.url === 'string' ? attachment.url : ''
            }
          }
        : null
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
