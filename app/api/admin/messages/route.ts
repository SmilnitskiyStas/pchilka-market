import { NextResponse } from 'next/server';

import {
  countIncomingRequestsInDb,
  listIncomingRequestsFromDb,
  updateIncomingRequestStatusInDb
} from '@/lib/incoming-requests-repository';
import {
  isIncomingRequestStatus,
  isIncomingRequestType,
  type IncomingRequestStatus,
  type IncomingRequestType
} from '@/lib/incoming-requests';
import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  const url = new URL(request.url);
  const statusRaw = url.searchParams.get('status');
  const typeRaw = url.searchParams.get('type');
  const query = (url.searchParams.get('q') ?? '').trim();
  const limitRaw = Number(url.searchParams.get('limit') ?? 300);

  const status = statusRaw && isIncomingRequestStatus(statusRaw) ? (statusRaw as IncomingRequestStatus) : undefined;
  const requestType = typeRaw && isIncomingRequestType(typeRaw) ? (typeRaw as IncomingRequestType) : undefined;
  const limit = Number.isFinite(limitRaw) ? limitRaw : 300;

  try {
    const [requests, unprocessedCount] = await Promise.all([
      listIncomingRequestsFromDb({
        status,
        requestType,
        query,
        limit
      }),
      countIncomingRequestsInDb('new')
    ]);

    return NextResponse.json({ ok: true, requests, unprocessedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as { id?: number; status?: IncomingRequestStatus };
    const id = Number(body.id);
    const status = body.status;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid id.' }, { status: 400 });
    }
    if (!isIncomingRequestStatus(status)) {
      return NextResponse.json({ ok: false, error: 'Invalid status.' }, { status: 400 });
    }

    const updated = await updateIncomingRequestStatusInDb(id, status);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Request not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
