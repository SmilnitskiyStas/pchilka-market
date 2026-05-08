import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Завдання | Інвентар | Pchilka Market',
  description: 'Активні та архівні inventory-завдання по працівниках.'
};

export default function AdminInventoryTasksPage() {
  return <AdminInventoryManager key="inventory-tasks" initialSubsection="employee-tasks" />;
}
