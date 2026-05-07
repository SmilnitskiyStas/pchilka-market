import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import InventoryPlaceholderPage from '@/components/admin/inventory-placeholder-page';

const inventoryRoutes: Record<string, { title: string; description: string }> = {
  'products': { title: 'Товари', description: 'Поки тут буде список товарів, фільтри та робота з довідником.' },
  'products/create': { title: 'Створити товар', description: 'Тут згодом буде форма створення нового товару.' },
  'products/import': { title: 'Імпорт товарів', description: 'Тут буде окремий екран для завантаження товарів з файлу.' },
  'batches': { title: 'Партії', description: 'Поки тут буде огляд усіх партій по магазинах.' },
  'batches/expiring': { title: 'Закінчується термін', description: 'Тут зберемо партії, яким скоро потрібна увага.' },
  'batches/overdue': { title: 'Прострочені', description: 'Тут буде список прострочених партій.' },
  'batches/action-required': { title: 'Потребують дії', description: 'Тут будуть партії без реакції або з відкритим контролем.' },
  'batches/written-off': { title: 'Списані', description: 'Тут буде архів списаних партій.' },
  'tasks': { title: 'Завдання', description: 'Тут буде окремий розділ для задач inventory.' },
  'employees': { title: 'Працівники', description: 'Тут буде список працівників та їх прив’язки до магазинів.' },
  'actions': { title: 'Дії працівників', description: 'Тут буде журнал дій працівників по inventory.' },
  'notifications': { title: 'Сповіщення', description: 'Тут буде історія та керування сповіщеннями.' },
  'stores': { title: 'Магазини', description: 'Тут буде окремий огляд мережі магазинів.' },
  'analytics': { title: 'Аналітика', description: 'Тут буде аналітика по партіях, реакції та руху товарів.' },
  'settings/schema': { title: 'Налаштування інвентарю', description: 'Тут буде окремий екран налаштувань схеми.' },
  'settings/telegram': { title: 'Telegram', description: 'Тут буде окремий екран налаштувань Telegram-інтеграції.' }
};

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const key = resolvedParams.slug.join('/');
  const meta = inventoryRoutes[key];

  return {
    title: meta ? `${meta.title} | Pchilka Market` : 'Інвентар | Pchilka Market',
    description: meta?.description ?? 'Проміжна сторінка inventory-модуля.'
  };
}

export default async function InventoryCatchAllPage({ params }: PageProps) {
  const resolvedParams = await params;
  const key = resolvedParams.slug.join('/');
  const meta = inventoryRoutes[key];

  if (!meta) {
    notFound();
  }

  return <InventoryPlaceholderPage title={meta.title} description={meta.description} path={`/admin/inventory/${key}`} />;
}
