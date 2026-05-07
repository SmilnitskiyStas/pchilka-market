import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Імпорт товарів | Інвентар | Pchilka Market',
  description: 'Імпорт товарів в inventory-модуль.'
};

export default function AdminInventoryProductsImportPage() {
  return <AdminInventoryManager key="inventory-products-import" initialSubsection="product-import" />;
}
