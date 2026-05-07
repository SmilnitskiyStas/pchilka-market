import type { Metadata } from 'next';

import AdminIntegrationsManager from '@/components/admin/admin-integrations-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Інтеграції | Pchilka Market',
  description: 'Налаштування інтеграцій аналітики у адмін-панелі Pchilka Market.'
};

export default function AdminIntegrationsPage() {
  return <AdminIntegrationsManager />;
}
