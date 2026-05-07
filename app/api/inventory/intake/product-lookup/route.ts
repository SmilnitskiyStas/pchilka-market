import { NextResponse } from 'next/server';

import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryProductByBarcodeInDb, listInventoryProductsFromDb } from '@/lib/inventory-products-repository';
import { normalizeInventoryBarcode } from '@/lib/inventory-product-types';
import { findInventoryUserByChatId } from '@/lib/inventory-users-repository';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') ?? '';
    const barcode = normalizeInventoryBarcode(url.searchParams.get('barcode') ?? '');
    const query = String(url.searchParams.get('q') ?? '').trim();

    if (!barcode && !query) {
      return NextResponse.json({ ok: false, error: 'Пошуковий запит не передано.' }, { status: 400 });
    }

    const settings = await getInventoryTelegramSettingsFromDb();
    const payload = parseInventoryRegistrationToken(token, settings.webhookSecret);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Недійсний або прострочений токен доступу.' }, { status: 400 });
    }

    const user = await findInventoryUserByChatId(payload.chatId);
    if (!user || !user.isActive) {
      return NextResponse.json({ ok: false, error: 'Користувача не знайдено або обліковий запис деактивовано.' }, { status: 403 });
    }

    if (barcode) {
      const product = await findInventoryProductByBarcodeInDb(barcode);
      return NextResponse.json({ ok: true, product });
    }

    const products = (await listInventoryProductsFromDb(query, 30, 0)).filter((item) => item.isActive);
    return NextResponse.json({ ok: true, products });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не вдалося виконати пошук товару.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
