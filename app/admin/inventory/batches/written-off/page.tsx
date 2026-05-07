import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Списані партії | Інвентар | Pchilka Market',
  description: 'Списані партії inventory-модуля.'
};

export default function AdminInventoryBatchesWrittenOffPage() {
  return <AdminInventoryManager key="inventory-batches-written-off" initialSubsection="batches-list" initialBatchView="written-off" />;
}
