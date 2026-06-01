import { NextResponse } from 'next/server';

import { findInventoryExpiryTaskByIdInDb, takeInventoryExpiryTaskInDb } from '@/lib/inventory-expiry-tasks-repository';
import { canManageInventoryUsers } from '@/lib/inventory-user-roles';
import { resolveInventorySessionUserFromToken } from '@/lib/inventory-session-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      taskId?: string | number;
    };

    const token = String(body?.token ?? '');
    const taskId = Number(body?.taskId ?? 0);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json({ ok: false, error: 'Некоректне завдання.' }, { status: 400 });
    }

    const user = await resolveInventorySessionUserFromToken(token);
    const task = await findInventoryExpiryTaskByIdInDb(taskId);
    if (!task || Number(task.storeId) !== Number(user.storeId)) {
      return NextResponse.json({ ok: false, error: 'Завдання не знайдено для цього магазину.' }, { status: 404 });
    }

    if (task.taskAssignmentMode !== 'shared' && !canManageInventoryUsers(user.role)) {
      return NextResponse.json({ ok: false, error: 'Це завдання не потребує ручного взяття в роботу.' }, { status: 400 });
    }

    const updatedTask = await takeInventoryExpiryTaskInDb({ taskId, userId: user.id });
    if (!updatedTask) {
      return NextResponse.json({ ok: false, error: 'Не вдалося взяти задачу в роботу.' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, task: updatedTask });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося взяти задачу в роботу.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
