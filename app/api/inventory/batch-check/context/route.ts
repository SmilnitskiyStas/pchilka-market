import { NextResponse } from 'next/server';

import { listInventoryBatchChecksForBatchInDb } from '@/lib/inventory-batch-checks-repository';
import { findInventoryBatchByIdInDb } from '@/lib/inventory-batches-repository';
import {
  findInventoryExpiryTaskByIdInDb,
  markInventoryExpiryTaskStartedInDb,
  takeInventoryExpiryTaskInDb
} from '@/lib/inventory-expiry-tasks-repository';
import { canManageInventoryUsers } from '@/lib/inventory-user-roles';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const batchId = url.searchParams.get('batchId') ?? '';
    const taskId = url.searchParams.get('taskId') ?? '';
    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);

    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user || !user.isActive || !user.storeId) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено або обліковий запис недоступний.' }, { status: 403 });
    }

    const batch = await findInventoryBatchByIdInDb(batchId);
    if (!batch) {
      return NextResponse.json({ ok: false, error: 'Партію не знайдено.' }, { status: 404 });
    }
    if (String(user.storeId) !== batch.storeId) {
      return NextResponse.json({ ok: false, error: 'Немає доступу до партії іншого магазину.' }, { status: 403 });
    }

    if (taskId) {
      let task = await findInventoryExpiryTaskByIdInDb(taskId);
      if (!task || String(task.batchId) !== String(batch.id) || Number(task.storeId) !== Number(user.storeId)) {
        return NextResponse.json({ ok: false, error: 'Завдання не знайдено або воно не відповідає цій партії.' }, { status: 404 });
      }

      if (!canManageInventoryUsers(user.role)) {
        if (task.taskAssignmentMode === 'shared') {
          if (task.assignedUserId && Number(task.assignedUserId) !== Number(user.id)) {
            return NextResponse.json({ ok: false, error: 'Цю задачу вже взяв у роботу інший працівник.' }, { status: 409 });
          }

          if (!task.assignedUserId) {
            const takenTask = await takeInventoryExpiryTaskInDb({ taskId: task.id, userId: user.id });
            if (!takenTask) {
              return NextResponse.json({ ok: false, error: 'Не вдалося взяти задачу в роботу.' }, { status: 409 });
            }
            task = takenTask;
          }
        } else {
          const effectiveAssigneeId = Number(task.assignedUserId ?? task.responsibleUserId ?? 0);
          if (effectiveAssigneeId > 0 && effectiveAssigneeId !== Number(user.id)) {
            return NextResponse.json({ ok: false, error: 'У вас немає доступу до цієї задачі.' }, { status: 403 });
          }
        }
      }

      await markInventoryExpiryTaskStartedInDb(task.id);
    }

    const checks = await listInventoryBatchChecksForBatchInDb(batchId, 10);

    return NextResponse.json({ ok: true, user, batch, checks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
