import type { Metadata } from 'next';

import AdminBannersManager from '@/components/admin/admin-banners-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Банери | Pchilka Market',
  description: 'Керування банерами в адмін-панелі Pchilka Market.'
};

export default function AdminBannersPage() {
  return <AdminBannersManager />;
}
