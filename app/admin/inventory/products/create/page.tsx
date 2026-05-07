import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

export const metadata: Metadata = {
  title: 'Створити товар | Інвентар | Pchilka Market',
  description: 'Створення товару та партії в inventory-модулі.'
};

export default function AdminInventoryProductsCreatePage() {
  return <AdminInventoryManager key="inventory-products-create" initialSubsection="product-create" />;
}
