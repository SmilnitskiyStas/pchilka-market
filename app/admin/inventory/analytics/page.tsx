import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Аналітика | Інвентар | Pchilka Market',
  description: 'Аналітика по партіях, ризиках, магазинах і працівниках inventory-модуля.'
};

export default function AdminInventoryAnalyticsPage() {
  return <AdminInventoryManager key="inventory-analytics" initialSubsection="analytics" />;
}
