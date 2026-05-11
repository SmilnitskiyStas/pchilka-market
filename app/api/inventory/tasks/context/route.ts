import { NextResponse } from 'next/server';

import { listInventoryExpiryTasksFromDb } from '@/lib/inventory-expiry-tasks-repository';
import { markInventoryNotificationOpenedInDb } from '@/lib/inventory-notification-logs-repository';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const notificationId = url.searchParams.get('notificationId') ?? '';

    const user = await resolveInventorySessionUserFromToken(token);

    if (notificationId) {
      await markInventoryNotificationOpenedInDb({
        notificationId,
        userId: user.id
      });
    }

    const [activeTasks, archivedTasks] = await Promise.all([
      listInventoryExpiryTasksFromDb({
        responsibleUserId: user.id,
        storeId: user.storeId,
        statusGroup: 'active',
        limit: 300
      }),
      listInventoryExpiryTasksFromDb({
        responsibleUserId: user.id,
        storeId: user.storeId,
        statusGroup: 'archived',
        limit: 100
      })
    ]);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        role: user.role,
        storeId: user.storeId
      },
      activeTasks,
      archivedTasks,
      summary: {
        active: activeTasks.length,
        archived: archivedTasks.length,
        critical: activeTasks.filter((task) => task.riskLevel === 'critical').length,
        high: activeTasks.filter((task) => task.riskLevel === 'high').length
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown tasks context error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
