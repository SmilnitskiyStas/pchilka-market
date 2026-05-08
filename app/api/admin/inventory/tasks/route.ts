import { NextResponse } from 'next/server';

import { isAdminRequestAuthorized, unauthorizedAdminResponse } from '@/lib/admin-auth';
import { listInventoryExpiryTasksFromDb, syncInventoryExpiryTasksInDb } from '@/lib/inventory-expiry-tasks-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const url = new URL(request.url);
    const responsibleUserId = url.searchParams.get('responsibleUserId');
    const storeId = url.searchParams.get('storeId');
    const limit = Number(url.searchParams.get('limit') ?? 250);

    await syncInventoryExpiryTasksInDb();

    const [activeTasks, archivedTasks] = await Promise.all([
      listInventoryExpiryTasksFromDb({
        responsibleUserId,
        storeId,
        statusGroup: 'active',
        limit
      }),
      listInventoryExpiryTasksFromDb({
        responsibleUserId,
        storeId,
        statusGroup: 'archived',
        limit
      })
    ]);

    return NextResponse.json({
      ok: true,
      activeTasks,
      archivedTasks,
      summary: {
        active: activeTasks.length,
        archived: archivedTasks.length
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося завантажити задачі inventory.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
