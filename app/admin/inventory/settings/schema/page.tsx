import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Схема | Інвентар | Pchilka Market',
  description: 'Стан схеми inventory-модуля.'
};

export default function AdminInventorySettingsSchemaPage() {
  return <AdminInventoryManager key="inventory-settings-schema" initialSubsection="settings-schema" />;
}
