import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Інвентар | Pchilka Market',
  description: 'Початковий модуль inventory і Telegram workflow для Pchilka Market.'
};

export default function AdminInventoryPage() {
  return <AdminInventoryManager key="inventory-overview" />;
}
