import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Telegram | Інвентар | Pchilka Market',
  description: 'Налаштування Telegram inventory-модуля.'
};

export default function AdminInventorySettingsTelegramPage() {
  return <AdminInventoryManager key="inventory-settings-telegram" initialSubsection="settings-telegram" />;
}
