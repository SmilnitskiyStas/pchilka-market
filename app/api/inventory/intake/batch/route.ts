import { NextResponse } from 'next/server';

import {
  createInventoryBatchInDb,
  findInventoryDuplicateBatchInDb,
  mergeInventoryBatchQuantityInDb
} from '@/lib/inventory-batches-repository';
import { normalizeInventoryBatchInput } from '@/lib/inventory-batch-types';
import { getSuspiciousInventoryExpiryDate } from '@/lib/inventory-expiry-date-rules';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryProductByIdInDb } from '@/lib/inventory-products-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      batch?: Record<string, unknown>;
      duplicateAction?: 'merge' | 'create_anyway';
      confirmSuspiciousExpiryDate?: boolean;
    };

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(String(body?.token ?? ''), settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено. Спочатку завершіть реєстрацію.' }, { status: 404 });
    }
    if (!user.isActive) {
      return NextResponse.json({ ok: false, error: 'Обліковий запис деактивовано.' }, { status: 403 });
    }
    if (!user.storeId) {
      return NextResponse.json({ ok: false, error: "Для користувача не прив'язано магазин." }, { status: 400 });
    }

    const normalized = normalizeInventoryBatchInput({
      ...(body?.batch ?? {}),
      storeId: String(user.storeId)
    });

    if (!normalized.productId) {
      return NextResponse.json({ ok: false, error: 'Оберіть товар.' }, { status: 400 });
    }
    if (!normalized.expiryDate) {
      return NextResponse.json({ ok: false, error: 'Вкажіть термін придатності.' }, { status: 400 });
    }
    if (normalized.quantity <= 0) {
      return NextResponse.json({ ok: false, error: 'Кількість має бути більшою за 0.' }, { status: 400 });
    }

    const suspiciousExpiryDate = getSuspiciousInventoryExpiryDate({
      expiryDate: normalized.expiryDate,
      deliveryDate: normalized.deliveryDate
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

    const product = await findInventoryProductByIdInDb(normalized.productId);
    if (!product) {
      return NextResponse.json({ ok: false, error: 'Товар не знайдено.' }, { status: 404 });
    }
    if (!product.isActive) {
      return NextResponse.json({ ok: false, error: 'Товар знайдено, але він неактивний.' }, { status: 400 });
    }

    const duplicateBatch = await findInventoryDuplicateBatchInDb({
      storeId: normalized.storeId,
      productId: normalized.productId,
      expiryDate: normalized.expiryDate
    });

    if (duplicateBatch && body?.duplicateAction !== 'merge' && body?.duplicateAction !== 'create_anyway') {
      return NextResponse.json(
        {
          ok: false,
          error: 'У цьому магазині вже є така партія з цим самим терміном придатності.',
          duplicateBatch
        },
        { status: 409 }
      );
    }

    if (duplicateBatch && body?.duplicateAction === 'merge') {
      const batch = await mergeInventoryBatchQuantityInDb(
        {
          batchId: duplicateBatch.id,
          quantity: normalized.quantity,
          batchCode: normalized.batchCode,
          deliveryDate: normalized.deliveryDate,
          notifiedDays: normalized.notifiedDays
        },
        undefined,
        {
          updatedByUserId: user.id,
          responsibleUserId: user.id
        }
      );

      return NextResponse.json({ ok: true, batch, resolution: 'merged' });
    }

    const batch = await createInventoryBatchInDb(normalized, undefined, {
      createdByUserId: user.id,
      updatedByUserId: user.id,
      responsibleUserId: user.id
    });

    return NextResponse.json({ ok: true, batch, resolution: 'created' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити партію.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
