import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Сповіщення | Інвентар | Pchilka Market',
  description: 'Telegram-сповіщення inventory-модуля.'
};

export default function AdminInventoryNotificationsPage() {
  return <AdminInventoryManager key="inventory-notifications" initialSubsection="settings-telegram" />;
}
