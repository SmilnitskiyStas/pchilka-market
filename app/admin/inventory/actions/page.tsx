import type { Metadata } from 'next';

import AdminInventoryActionsPage from '@/components/admin/admin-inventory-actions-page';

export const metadata: Metadata = {
  title: 'Дії працівників | Інвентар | Pchilka Market',
  description: 'Моніторинг дій працівників по партіях та обговореннях товарів.'
};

export default function AdminInventoryActionsRoutePage() {
  return <AdminInventoryActionsPage />;
}
