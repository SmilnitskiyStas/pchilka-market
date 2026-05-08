import { parseInventoryRegistrationToken } from '@/lib/inventory-registration-token';
import { getInventoryTelegramSettingsFromDb } from '@/lib/inventory-telegram-settings-repository';
import { findInventoryUserByChatId, type InventoryUserRecord } from '@/lib/inventory-users-repository';

export async function resolveInventorySessionUserFromToken(token: string): Promise<InventoryUserRecord> {
  const settings = await getInventoryTelegramSettingsFromDb();
  const payload = parseInventoryRegistrationToken(String(token ?? ''), settings.webhookSecret);

  if (!payload) {
    throw new Error('Недійсний або прострочений токен доступу.');
  }

  const user = await findInventoryUserByChatId(payload.chatId);
  if (!user || !user.isActive || !user.storeId) {
    throw new Error('Користувача не знайдено або його обліковий запис недоступний.');
  }

  return user;
}
