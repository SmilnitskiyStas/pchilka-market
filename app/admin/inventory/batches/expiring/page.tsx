import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Закінчується термін | Інвентар | Pchilka Market',
  description: 'Партії inventory-модуля, для яких скоро спливає термін придатності.'
};

export default function AdminInventoryBatchesExpiringPage() {
  return <AdminInventoryManager key="inventory-batches-expiring" initialSubsection="batches-list" initialBatchView="expiring" />;
}
