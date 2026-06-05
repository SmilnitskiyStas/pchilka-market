import { NextResponse } from 'next/server';

import { createInventoryActivityLogInDb } from '@/lib/inventory-activity-logs-repository';
import { createInventoryBatchCheckInDb } from '@/lib/inventory-batch-checks-repository';
import { findInventoryBatchByIdInDb, updateInventoryBatchCheckActionInDb } from '@/lib/inventory-batches-repository';
import { notifyInventoryDiscussionCreated } from '@/lib/inventory-discussion-telegram';
import { completeInventoryExpiryTaskInDb, findInventoryExpiryTaskByIdInDb } from '@/lib/inventory-expiry-tasks-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

type CheckedFollowupAction = 'left_on_shelf' | 'removed_from_shelf' | 'other';

type ActionPayload = {
  token?: string;
  batchId?: string;
  taskId?: string;
  action?: 'checked' | 'writeoff' | 'discussion_required';
  countedQuantity?: number | null;
  itemCondition?: string;
  issueReason?: string;
  note?: string;
  checkedFollowupAction?: CheckedFollowupAction;
  photoUrl?: string;
};

const ALLOWED_ACTIONS = new Set<ActionPayload['action']>(['checked', 'writeoff', 'discussion_required']);
const ALLOWED_FOLLOWUP_ACTIONS = new Set<CheckedFollowupAction>(['left_on_shelf', 'removed_from_shelf', 'other']);

function normalizeCheckedFollowupAction(value: string): CheckedFollowupAction | null {
  if (!ALLOWED_FOLLOWUP_ACTIONS.has(value as CheckedFollowupAction)) {
    return null;
  }

  return value as CheckedFollowupAction;
}

function formatCheckedFollowupAction(value: CheckedFollowupAction | null) {
  switch (value) {
    case 'left_on_shelf':
      return 'залишив на полиці';
    case 'removed_from_shelf':
      return 'прибрав з полиці';
    case 'other':
      return 'інша дія';
    default:
      return '';
  }
}

function buildSnapshotNote(input: {
  countedQuantity?: number | null;
  itemCondition?: string;
  issueReason?: string;
  note?: string;
  checkedFollowupAction?: CheckedFollowupAction | null;
}) {
  const segments = [
    input.countedQuantity != null ? `Факт. кількість: ${input.countedQuantity}` : '',
    input.itemCondition ? `Стан: ${input.itemCondition}` : '',
    input.checkedFollowupAction
      ? `Дія після перевірки: ${formatCheckedFollowupAction(input.checkedFollowupAction)}`
      : '',
    input.issueReason ? `Причина: ${input.issueReason}` : '',
    input.note ? `Коментар: ${input.note}` : ''
  ].filter(Boolean);

  return segments.join(' | ');
}

function validatePayload(input: {
  action: 'checked' | 'writeoff' | 'discussion_required';
  countedQuantity: number | null;
  itemCondition: string;
  issueReason: string;
  checkedFollowupAction: CheckedFollowupAction | null;
  note: string;
}) {
  if (input.countedQuantity == null || !Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) {
    throw new Error('Вкажіть фактичну кількість товару.');
  }
  if (!input.itemCondition) {
    throw new Error('Вкажіть стан товару.');
  }
  if (input.action === 'checked' && !input.checkedFollowupAction) {
    throw new Error('Оберіть, що ви зробили з товаром після перевірки.');
  }
  if (input.action === 'checked' && input.checkedFollowupAction === 'other' && !input.note) {
    throw new Error('Для варіанту "Інша дія" додайте коментар.');
  }
  if ((input.action === 'writeoff' || input.action === 'discussion_required') && !input.issueReason) {
    throw new Error('Для цієї дії потрібно вказати причину проблеми.');
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ActionPayload;
    const token = String(body.token ?? '').trim();
    const batchId = String(body.batchId ?? '').trim();
    const taskId = String(body.taskId ?? '').trim();
    const action = body.action;
    const note = String(body.note ?? '').trim();
    const itemCondition = String(body.itemCondition ?? '').trim();
    const issueReason = String(body.issueReason ?? '').trim();
    const photoUrl = String(body.photoUrl ?? '').trim();
    const checkedFollowupAction = normalizeCheckedFollowupAction(String(body.checkedFollowupAction ?? '').trim());
    const countedQuantityRaw = body.countedQuantity;
    const countedQuantity =
      countedQuantityRaw == null
        ? null
        : Math.max(Math.round(Number(countedQuantityRaw)), 0);

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: 'Некоректна дія для партії.' }, { status: 400 });
    }

    const safeAction = action as 'checked' | 'writeoff' | 'discussion_required';
    validatePayload({
      action: safeAction,
      countedQuantity,
      itemCondition,
      issueReason,
      checkedFollowupAction,
      note
    });

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user || !user.isActive || !user.storeId) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено або обліковий запис недоступний.' }, { status: 403 });
    }

    const existingBatch = await findInventoryBatchByIdInDb(batchId);
    if (!existingBatch) {
      return NextResponse.json({ ok: false, error: 'Партію не знайдено.' }, { status: 404 });
    }
    if (String(user.storeId) !== existingBatch.storeId) {
      return NextResponse.json({ ok: false, error: 'Немає доступу до партії іншого магазину.' }, { status: 403 });
    }

    if (taskId) {
      const task = await findInventoryExpiryTaskByIdInDb(taskId);
      if (!task || String(task.batchId) !== String(existingBatch.id) || Number(task.storeId) !== Number(user.storeId)) {
        return NextResponse.json({ ok: false, error: 'Завдання не знайдено або воно не відповідає цій партії.' }, { status: 404 });
      }
    }

    const snapshotNote = buildSnapshotNote({
      countedQuantity,
      itemCondition,
      issueReason,
      note,
      checkedFollowupAction
    });

    const batch = await updateInventoryBatchCheckActionInDb({
      batchId,
      userId: user.id,
      storeId: user.storeId,
      action: safeAction,
      note: snapshotNote,
      checkedFollowupAction
    });

    await createInventoryBatchCheckInDb({
      batchId: Number(batch.id),
      taskId: taskId ? Number(taskId) : null,
      productId: Number(batch.productId),
      storeId: Number(batch.storeId),
      userId: user.id,
      action: safeAction,
      countedQuantity,
      itemCondition,
      issueReason,
      note,
      checkedFollowupAction,
      photoUrl
    });

    await createInventoryActivityLogInDb({
      userId: user.id,
      batchId: Number(batch.id),
      productId: Number(batch.productId),
      storeId: Number(batch.storeId),
      actionType: `batch_check_${safeAction}`,
      comment: snapshotNote || null,
      oldQuantity: batch.quantityCurrent,
      newQuantity: countedQuantity
    });

    if (safeAction === 'discussion_required') {
      await notifyInventoryDiscussionCreated({
        taskId: taskId ? Number(taskId) : null,
        batchId: Number(batch.id),
        productId: Number(batch.productId),
        storeId: Number(batch.storeId),
        requesterUserId: user.id,
        requesterRole: user.role,
        requesterName: user.name,
        requesterSurname: user.surname,
        snapshotNote: snapshotNote || note || 'Потрібне обговорення по товару.'
      });
    }

    if (taskId && (safeAction !== 'checked' || checkedFollowupAction === 'removed_from_shelf')) {
      const taskOutcome =
        safeAction === 'writeoff'
          ? 'writeoff_required'
          : safeAction === 'discussion_required'
            ? 'manager_review'
            : issueReason === 'quantity_mismatch'
              ? 'quantity_mismatch'
              : 'checked_ok';

      await completeInventoryExpiryTaskInDb({
        taskId,
        completedByUserId: user.id,
        outcome: taskOutcome,
        resolutionNote: snapshotNote || null
      });
    }

    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown batch action error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
