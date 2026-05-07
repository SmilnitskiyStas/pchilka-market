import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Потребують дії | Інвентар | Pchilka Market',
  description: 'Партії inventory-модуля, які потребують реакції.'
};

export default function AdminInventoryBatchesActionRequiredPage() {
  return <AdminInventoryManager key="inventory-batches-action-required" initialSubsection="batches-list" initialBatchView="action-required" />;
}
