import type { Metadata } from 'next';

import AdminInventorySalesImportPage from '@/components/admin/admin-inventory-sales-import-page';

export const metadata: Metadata = {
  title: 'FEFO-імпорт продажів | Інвентар | Pchilka Market',
  description: 'Dry-run і підтверджене FEFO-списання продажів з касового Excel-звіту.'
};

export default function AdminInventorySalesImportRoutePage() {
  return <AdminInventorySalesImportPage />;
}
