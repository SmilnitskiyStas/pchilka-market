import type { Metadata } from 'next';

import AdminPlaceholder from '@/components/admin/admin-placeholder';

export const metadata: Metadata = {
  title: 'Адмінка: Власне класне | Pchilka Market',
  description: 'Керування контентом розділу "Власне класне".'
};

export default function AdminOwnBrandPage() {
  return (
    <AdminPlaceholder
      label="Admin / Власне класне"
      title='Керування розділом "Власне класне"'
      description="Розділ для редагування текстів, зображень і структурних блоків підрозділів власного виробництва."
      fields={['Підрозділ', 'Заголовок сторінки', 'Опис/контент', 'Зображення', 'Додаткові файли', 'Статус публікації']}
    />
  );
}
