import type { Metadata } from 'next';

import AdminOwnBrandManager from '@/components/admin/admin-own-brand-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Власне класне | Pchilka Market',
  description: 'Керування піцами для розділу "Власне класне" у адмін-панелі Pchilka Market.'
};

export default function AdminOwnBrandPage() {
  return <AdminOwnBrandManager />;
}
