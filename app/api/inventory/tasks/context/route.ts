import { NextResponse } from 'next/server';

import { findInventoryExpiryTaskByIdInDb, listInventoryExpiryTasksFromDb } from '@/lib/inventory-expiry-tasks-repository';
import { findInventoryNotificationLogByIdInDb, markInventoryNotificationOpenedInDb } from '@/lib/inventory-notification-logs-repository';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';
import { findStoreByIdInDb } from '@/lib/stores-repository';
import type { InventoryTaskAssignmentMode } from '@/lib/store-types';

export const runtime = 'nodejs';

type RouteTaskView = Awaited<ReturnType<typeof listInventoryExpiryTasksFromDb>>[number];

function isTaskVisibleForUser(task: RouteTaskView, userId: number, role: string, mode: InventoryTaskAssignmentMode) {
  if (role !== 'staff') {
    return true;
  }

  const effectiveAssigneeId = Number(task.assignedUserId ?? task.responsibleUserId ?? 0);
  const isPersonalTaskForUser = effectiveAssigneeId > 0 && effectiveAssigneeId === userId;

  if (mode === 'shared') {
    return task.taskAssignmentMode === 'shared';
  }

  if (mode === 'hybrid') {
    return task.taskAssignmentMode === 'shared' || isPersonalTaskForUser;
  }

  return isPersonalTaskForUser;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const notificationId = url.searchParams.get('notificationId') ?? '';

    const user = await resolveInventorySessionUserFromToken(token);
    const store = user.storeId ? await findStoreByIdInDb(user.storeId) : null;
    const taskAssignmentMode = store?.taskAssignmentMode ?? 'personal';

    if (notificationId) {
      await markInventoryNotificationOpenedInDb({
        notificationId,
        userId: user.id
      });
    }

    let [activeTasks, archivedTasks] = await Promise.all([
      listInventoryExpiryTasksFromDb({
        storeId: user.storeId,
        statusGroup: 'active',
        limit: 300
      }),
      listInventoryExpiryTasksFromDb({
        storeId: user.storeId,
        statusGroup: 'archived',
        limit: 100
      })
    ]);

    activeTasks = activeTasks.filter((task) => isTaskVisibleForUser(task, user.id, user.role, taskAssignmentMode));
    archivedTasks = archivedTasks.filter((task) => isTaskVisibleForUser(task, user.id, user.role, taskAssignmentMode));

    if (notificationId) {
      const notification = await findInventoryNotificationLogByIdInDb(notificationId);
      if (notification?.task_id && Number(notification.user_id) === Number(user.id)) {
        const linkedTask = await findInventoryExpiryTaskByIdInDb(notification.task_id);
        if (
          linkedTask &&
          Number(linkedTask.storeId) === Number(user.storeId) &&
          isTaskVisibleForUser(linkedTask, user.id, user.role, taskAssignmentMode)
        ) {
          const targetList =
            linkedTask.status === 'completed' || linkedTask.status === 'cancelled' ? archivedTasks : activeTasks;
          const exists = targetList.some((task) => Number(task.id) === Number(linkedTask.id));
          if (!exists) {
            targetList.unshift(linkedTask);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        role: user.role,
        storeId: user.storeId,
        taskAssignmentMode
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
