import type { InventoryUserRecord } from '@/lib/inventory-users-repository';

/** The meter workflow is being rolled out gradually. */
export function assertUtilityMeterTestAccess(user: InventoryUserRecord) {
  if (!['manager', 'store_manager', 'admin'].includes(user.role)) {
    throw new Error('Доступ до показників лічильників доступний менеджерам, керівникам магазинів і адміністраторам.');
  }

  if (!user.storeId) {
    throw new Error('До вашого облікового запису не прив’язано магазин.');
  }
}
