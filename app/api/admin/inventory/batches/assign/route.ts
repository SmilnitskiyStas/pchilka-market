import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { reassignInventoryBatchResponsibleInDb } from '@/lib/inventory-batches-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = (await request.json()) as {
      batchId?: string | number;
      responsibleUserId?: string | number | null;
    };

    const batch = await reassignInventoryBatchResponsibleInDb({
      batchId: body?.batchId ?? '',
      responsibleUserId: body?.responsibleUserId ?? null
    });

    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося переназначити відповідального.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
