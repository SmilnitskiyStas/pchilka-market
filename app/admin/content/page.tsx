import type { Metadata } from 'next';

import AdminContentManager from '@/components/admin/admin-content-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Контент | Pchilka Market',
  description: 'Керування статтями та категоріями контенту у адмін-панелі Pchilka Market.'
};

export default function AdminContentPage() {
  return <AdminContentManager />;
}
