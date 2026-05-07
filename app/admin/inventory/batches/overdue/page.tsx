import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Прострочені партії | Інвентар | Pchilka Market',
  description: 'Прострочені партії inventory-модуля.'
};

export default function AdminInventoryBatchesOverduePage() {
  return <AdminInventoryManager key="inventory-batches-overdue" initialSubsection="batches-list" initialBatchView="overdue" />;
}
