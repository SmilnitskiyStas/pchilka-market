import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Усі партії | Інвентар | Pchilka Market',
  description: 'Список партій inventory-модуля.'
};

export default function AdminInventoryBatchesPage() {
  return <AdminInventoryManager key="inventory-batches-all" initialSubsection="batches-list" />;
}
