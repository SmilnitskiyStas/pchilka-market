import { NextResponse } from 'next/server';

import {
  findLatestInventoryBatchCodeForStoreInDb,
  generateNextInventoryBatchCodeForStoreInDb,
  listOpenInventoryBatchCodesForStoreInDb
} from '@/lib/inventory-batches-repository';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { listInventoryProductsFromDb } from '@/lib/inventory-products-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);

    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Користувач не знайдений. Спочатку завершіть реєстрацію.' }, { status: 404 });
    }
    if (!user.isActive) {
      return NextResponse.json({ ok: false, error: 'Обліковий запис деактивовано.' }, { status: 403 });
    }
    if (!user.storeId) {
      return NextResponse.json({ ok: false, error: 'Для користувача не прив’язано магазин.' }, { status: 400 });
    }

    const [products, stores, lastBatchCode, openBatchCodes, nextBatchCode] = await Promise.all([
      listInventoryProductsFromDb('', 500),
      listStoresFromDb(),
      findLatestInventoryBatchCodeForStoreInDb(user.storeId),
      listOpenInventoryBatchCodesForStoreInDb(user.storeId),
      generateNextInventoryBatchCodeForStoreInDb(user.storeId)
    ]);
    const store = stores.find((item) => item.id === String(user.storeId) && item.isActive);

    if (!store) {
      return NextResponse.json({ ok: false, error: 'Активний магазин користувача не знайдено.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        positionTitle: user.positionTitle,
        role: user.role,
        storeId: String(user.storeId),
        storeLabel: user.storeLabel
      },
      store,
      products: products.filter((item) => item.isActive),
      lastBatchCode,
      openBatchCodes,
      nextBatchCode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
