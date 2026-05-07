import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Працівники | Інвентар | Pchilka Market',
  description: 'Працівники inventory-модуля по магазинах.'
};

export default function AdminInventoryEmployeesPage() {
  return <AdminInventoryManager key="inventory-employees" initialSubsection="registered-employees" />;
}
