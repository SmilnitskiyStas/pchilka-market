import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Список товарів | Інвентар | Pchilka Market',
  description: 'Список товарів inventory-модуля.'
};

export default function AdminInventoryProductsPage() {
  return <AdminInventoryManager key="inventory-products-list" initialSubsection="product-list" />;
}
