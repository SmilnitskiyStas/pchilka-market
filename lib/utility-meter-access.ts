import type { InventoryUserRecord } from '@/lib/inventory-users-repository';

/** The meter workflow is being rolled out gradually. */
export function assertUtilityMeterTestAccess(user: InventoryUserRecord) {
  if (user.role !== 'store_manager') {
    throw new Error('Доступ до показників лічильників поки що відкритий лише для керівників магазинів.');
  }

  if (!user.storeId) {
    throw new Error('До вашого облікового запису не прив’язано магазин.');
  }
}
