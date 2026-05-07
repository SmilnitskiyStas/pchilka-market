import type { Metadata } from 'next';

import AdminPromotionsManager from '@/components/admin/admin-promotions-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Акції | Pchilka Market',
  description: 'Керування акціями у адмін-панелі Pchilka Market.'
};

export default function AdminPromotionsPage() {
  return <AdminPromotionsManager />;
}
