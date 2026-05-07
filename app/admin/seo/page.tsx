import type { Metadata } from 'next';

import AdminSeoManager from '@/components/admin/admin-seo-manager';

export const metadata: Metadata = {
  title: 'Адмінка: SEO | Pchilka Market',
  description: 'SEO-налаштування у адмін-панелі Pchilka Market.'
};

export default function AdminSeoPage() {
  return <AdminSeoManager />;
}
