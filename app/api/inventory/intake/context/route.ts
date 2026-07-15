import { NextResponse } from 'next/server';

import {
  generateNextInventoryBatchCodeForStoreInDb,
  listOpenInventoryBatchCodesForStoreInDb
} from '@/lib/inventory-batches-repository';
import { writeInventoryAuthDebugLog } from '@/lib/inventory-auth-debug';
import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';
import { listStoresFromDb } from '@/lib/stores-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const tokenPreview = token ? `${token.slice(0, 8)}...${token.slice(-6)}` : '';

  try {
    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);

    if (!payload) {
      await writeInventoryAuthDebugLog({
        actionType: 'inventory_intake_context_invalid_token',
        meta: {
          tokenPreview,
          reason: 'token_invalid_or_expired'
        }
      });
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user) {
      await writeInventoryAuthDebugLog({
        actionType: 'inventory_intake_context_user_not_found',
        meta: {
          chatId: payload.chatId,
          tokenPreview
        }
      });
      return NextResponse.json({ ok: false, error: 'Користувач не знайдений. Спочатку завершіть реєстрацію.' }, { status: 404 });
    }
    if (!user.isActive) {
      await writeInventoryAuthDebugLog({
        actionType: 'inventory_intake_context_user_inactive',
        userId: user.id,
        storeId: user.storeId,
        meta: {
          chatId: payload.chatId,
          tokenPreview
        }
      });
      return NextResponse.json({ ok: false, error: 'Обліковий запис деактивовано.' }, { status: 403 });
    }
    if (!user.storeId) {
      await writeInventoryAuthDebugLog({
        actionType: 'inventory_intake_context_user_missing_store',
        userId: user.id,
        meta: {
          chatId: payload.chatId,
          tokenPreview
        }
      });
      return NextResponse.json({ ok: false, error: 'Для користувача не прив’язано магазин.' }, { status: 400 });
    }

    const [stores, openBatchCodes, nextBatchCode] = await Promise.all([
      listStoresFromDb(),
      listOpenInventoryBatchCodesForStoreInDb(user.storeId),
      generateNextInventoryBatchCodeForStoreInDb(user.storeId)
    ]);
    const lastBatchCode = String(openBatchCodes[0]?.batchCode ?? '').trim();
    const store = stores.find((item) => item.id === String(user.storeId) && item.isActive);

    if (!store) {
      await writeInventoryAuthDebugLog({
        actionType: 'inventory_intake_context_store_not_found',
        userId: user.id,
        storeId: user.storeId,
        meta: {
          chatId: payload.chatId,
          tokenPreview
        }
      });
      return NextResponse.json({ ok: false, error: 'Активний магазин користувача не знайдено.' }, { status: 404 });
    }

    await writeInventoryAuthDebugLog({
      actionType: 'inventory_intake_context_access_granted',
      userId: user.id,
      storeId: user.storeId,
      meta: {
        chatId: payload.chatId,
        tokenPreview,
        storeLabel: [store.storeCode, store.city, store.addressLine].filter(Boolean).join(' | ')
      }
    });

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
      products: [],
      lastBatchCode,
      openBatchCodes,
      nextBatchCode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown DB error';
    await writeInventoryAuthDebugLog({
      actionType: 'inventory_intake_context_unexpected_error',
      meta: {
        tokenPreview,
        message
      }
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
