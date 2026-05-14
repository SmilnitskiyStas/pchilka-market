import { NextResponse } from 'next/server';

import { createInventoryActivityLogInDb } from '@/lib/inventory-activity-logs-repository';
import { createInventoryBatchExpiryCorrectionInDb } from '@/lib/inventory-batch-expiry-corrections-repository';
import {
  findInventoryBatchByIdInDb,
  updateInventoryBatchExpiryDateInDb
} from '@/lib/inventory-batches-repository';
import { getSuspiciousInventoryExpiryDate } from '@/lib/inventory-expiry-date-rules';
import { syncInventoryExpiryTasksInDb } from '@/lib/inventory-expiry-tasks-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { canEditInventoryBatchExpiry } from '@/lib/inventory-user-roles';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      batchId?: string | number;
      newExpiryDate?: string;
      reason?: string;
      comment?: string;
      photoUrl?: string;
      confirmSuspiciousExpiryDate?: boolean;
    };

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(String(body?.token ?? ''), settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const actingUser = await findInventoryUserByChatId(payload.chatId);
    if (!actingUser || !actingUser.isActive || !actingUser.storeId) {
      return NextResponse.json(
        { ok: false, error: 'Користувача не знайдено або його обліковий запис недоступний.' },
        { status: 403 }
      );
    }
    if (!canEditInventoryBatchExpiry(actingUser.role)) {
      return NextResponse.json(
        { ok: false, error: 'Змінювати термін придатності може лише керівник магазину або адміністратор.' },
        { status: 403 }
      );
    }

    const batchId = String(body?.batchId ?? '').trim();
    const newExpiryDate = String(body?.newExpiryDate ?? '').trim();
    const reason = String(body?.reason ?? '').trim();
    const comment = String(body?.comment ?? '').trim();
    const photoUrl = String(body?.photoUrl ?? '').trim();

    if (!batchId) {
      return NextResponse.json({ ok: false, error: 'Не вибрано партію.' }, { status: 400 });
    }
    if (!newExpiryDate) {
      return NextResponse.json({ ok: false, error: 'Вкажіть новий термін придатності.' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ ok: false, error: 'Вкажіть причину зміни терміну придатності.' }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json({ ok: false, error: 'Додайте коментар до зміни терміну придатності.' }, { status: 400 });
    }
    if (!photoUrl) {
      return NextResponse.json({ ok: false, error: 'Додайте фото товару як підтвердження зміни.' }, { status: 400 });
    }

    const batch = await findInventoryBatchByIdInDb(batchId);
    if (!batch || String(batch.storeId) !== String(actingUser.storeId)) {
      return NextResponse.json({ ok: false, error: 'Партію цього магазину не знайдено.' }, { status: 404 });
    }
    if (batch.expiryDate === newExpiryDate) {
      return NextResponse.json({ ok: false, error: 'Нова дата збігається з поточним терміном придатності.' }, { status: 400 });
    }

    const suspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
      expiryDate: newExpiryDate,
      deliveryDate: batch.deliveryDate
    });
    if (suspiciousExpiryDate.isSuspicious && body?.confirmSuspiciousExpiryDate !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: suspiciousExpiryDate.message,
          suspiciousExpiryDate
        },
        { status: 428 }
      );
    }

    const updatedBatch = await updateInventoryBatchExpiryDateInDb({
      batchId,
      storeId: actingUser.storeId,
      expiryDate: newExpiryDate,
      updatedByUserId: actingUser.id
    });

    const correction = await createInventoryBatchExpiryCorrectionInDb({
      batchId: Number(updatedBatch.id),
      productId: Number(updatedBatch.productId),
      storeId: Number(updatedBatch.storeId),
      oldExpiryDate: batch.expiryDate,
      newExpiryDate,
      reason,
      comment,
      photoUrl,
      changedByUserId: actingUser.id
    });

    await createInventoryActivityLogInDb({
      userId: actingUser.id,
      batchId: Number(updatedBatch.id),
      productId: Number(updatedBatch.productId),
      storeId: Number(updatedBatch.storeId),
      actionType: 'batch_expiry_date_corrected',
      comment: [`Причина: ${reason}`, comment, `Фото: ${photoUrl}`].filter(Boolean).join('\n'),
      oldExpiryDate: batch.expiryDate,
      newExpiryDate
    });

    await syncInventoryExpiryTasksInDb();

    return NextResponse.json({
      ok: true,
      batch: updatedBatch,
      correction
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося змінити термін придатності.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
