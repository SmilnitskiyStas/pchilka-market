import type { Metadata } from 'next';

import AdminNetworkManager from '@/components/admin/admin-network-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Мережа | Pchilka Market',
  description: 'Керування контактами, картою та списком магазинів у адмін-панелі Pchilka Market.'
};

export default function AdminNetworkPage() {
  return <AdminNetworkManager />;
}

