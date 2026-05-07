import { NextResponse } from 'next/server';

import { createInventoryActivityLogInDb } from '@/lib/inventory-activity-logs-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { createInventoryProductInDb, findInventoryProductDuplicateInDb } from '@/lib/inventory-products-repository';
import { normalizeInventoryProductInput } from '@/lib/inventory-product-types';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      product?: Record<string, unknown>;
      note?: string;
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

    const normalized = normalizeInventoryProductInput(body?.product);
    const note = String(body?.note ?? '').trim();
    if (!normalized.article) {
      return NextResponse.json({ ok: false, error: 'Артикул є обовʼязковим.' }, { status: 400 });
    }
    if (!normalized.productName) {
      return NextResponse.json({ ok: false, error: 'Назва товару є обовʼязковою.' }, { status: 400 });
    }
    if (!normalized.unitsOfMeasurement) {
      return NextResponse.json({ ok: false, error: 'Одиниця виміру є обовʼязковою.' }, { status: 400 });
    }

    const duplicate = await findInventoryProductDuplicateInDb({
      article: normalized.article,
      barcode: normalized.barcode,
      productName: normalized.productName,
      unitsOfMeasurement: normalized.unitsOfMeasurement
    });
    if (duplicate) {
      return NextResponse.json(
        { ok: false, error: `Товар уже існує в базі: ${duplicate.productName}.` },
        { status: 409 }
      );
    }

    const product = await createInventoryProductInDb({
      ...normalized,
      isActive: true
    });

    const createdAt = new Date().toISOString();
    const auditComment = [
      `Створено працівником: ${user.surname} ${user.name}`.trim(),
      user.positionTitle ? `Посада: ${user.positionTitle}` : '',
      user.storeLabel ? `Магазин: ${user.storeLabel}` : '',
      `Дата: ${createdAt}`,
      note ? `Примітка: ${note}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    await createInventoryActivityLogInDb({
      userId: user.id,
      productId: Number(product.id),
      storeId: user.storeId,
      actionType: 'product_created_from_telegram_intake',
      comment: auditComment
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося створити новий товар.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
