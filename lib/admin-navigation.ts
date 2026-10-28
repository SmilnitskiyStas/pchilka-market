import { hasAdminPermission, resourceForAdminPath, type AdminPermission } from '@/lib/admin-permissions';

export type AdminNavItem = {
  id?: string;
  href?: string;
  label: string;
  description?: string;
  children?: AdminNavItem[];
  badge?: number | string;
};

const link = (href: string, label: string, description?: string): AdminNavItem => ({ href, label, description });

// Shared by the sidebar and dashboard. Each destination has one owner.
export const adminNavigation: AdminNavItem[] = [
  link('/admin', 'Панель керування', 'Огляд розділів та швидкі переходи.'),
  { id: 'site', label: 'Сайт і контент', description: 'Сторінки, публікації, оформлення та навігація сайту.', children: [
    link('/admin/pages', 'Сторінки та шаблони', 'Візуальний редактор, чернетки, публікація та історія версій.'),
    link('/admin/content', 'Статті та категорії', 'Блог, новини мережі, благодійність і раніше створені тексти.'),
    link('/admin/menu', 'Меню сайту', 'Структура публічного меню та порядок пунктів.'),
    link('/admin/home-slides', 'Банери головної', 'Зображення, відео та посилання головних банерів.'),
    link('/admin/media', 'Медіабібліотека', 'Спільні зображення, відео та файли сайту.'),
    { id: 'special-pages', label: 'Спеціальні розділи', children: [
      link('/admin/own-brand', 'Власне виробництво', 'Сторінки розділу «Власне класне».'),
      link('/admin/cooperation/offer-product', 'Співпраця: запропонувати товар', 'Відділи, контакти та налаштування форми пропозиції товару.')
    ] },
    link('/admin/seo', 'SEO сайту', 'Пошукові налаштування, canonical, sitemap та robots.')
  ] },
  { id: 'marketing', label: 'Маркетинг і лояльність', description: 'Акційні пропозиції, коди партнерів та аналітика лояльності.', children: [
    link('/admin/promotions', 'Акції та каталоги', 'Акційні блоки, PDF-каталоги та промо-сторінки.'),
    link('/admin/marketing/loyalty-rule-analytics', 'Аналітика лояльності', 'Результати правил програми лояльності.'),
    link('/admin/marketing/megogo-codes', 'Коди MEGOGO', 'Керування партнерськими кодами.')
  ] },
  { id: 'network', label: 'Мережа та звернення', description: 'Інформація про магазини й отримані заявки.', children: [
    link('/admin/network', 'Магазини та контакти', 'Адреси, карта магазинів і контакти мережі.'),
    link('/admin/messages', 'Заявки та повідомлення', 'Звернення з форм співпраці, кар’єри та зворотного зв’язку.')
  ] },
  { id: 'people', label: 'Працівники та найм', description: 'Навчання працівників і приймання заявок на вакансії.', children: [
    link('/admin/training', 'Навчання та тести', 'Тести, категорії й статистика навчання.'),
    link('/admin/career-telegram', 'Бот вакансій', 'Анкета кандидата, QR-посилання та HR-чат.')
  ] },
  { id: 'inventory', label: 'Інвентар', description: 'Товари, партії, терміни придатності та робочі завдання.', children: [
    link('/admin/inventory', 'Огляд інвентарю'),
    { id: 'products', label: 'Товари', children: [
      link('/admin/inventory/products', 'Список товарів'),
      link('/admin/inventory/products/create', 'Створити товар'),
      link('/admin/inventory/products/import', 'Імпорт товарів'),
      link('/admin/inventory/products/product-info', 'Дані імпортних товарів')
    ] },
    { id: 'batches', label: 'Партії та терміни', children: [
      link('/admin/inventory/batches', 'Усі партії'),
      link('/admin/inventory/batches/expiring', 'Закінчується термін'),
      link('/admin/inventory/batches/overdue', 'Прострочені'),
      link('/admin/inventory/batches/action-required', 'Потребують дії'),
      link('/admin/inventory/batches/written-off', 'Списані')
    ] },
    link('/admin/inventory/tasks', 'Завдання інвентарю'),
    link('/admin/inventory/employees', 'Відповідальні працівники'),
    link('/admin/inventory/actions', 'Дії працівників'),
    link('/admin/inventory/notifications', 'Сповіщення інвентарю'),
    link('/admin/inventory/analytics', 'Аналітика запасів'),
    { id: 'inventory-settings', label: 'Налаштування інвентарю', children: [
      link('/admin/inventory/settings/schema', 'Схема та конфігурація'),
      link('/admin/inventory/settings/telegram', 'Бот інвентарю')
    ] }
  ] },
  { id: 'utility', label: 'Комунальні нарахування', description: 'Лічильники, показники, тарифи та документи на оплату.', children: [
    link('/admin/utility-meters', 'Лічильники та показники'),
    link('/admin/utility-meters/missing', 'Не внесені показники'),
    link('/admin/utility-meters/missing-rates', 'Не внесені тарифи'),
    link('/admin/utility-meters/rates', 'Тарифи'),
    link('/admin/utility-meters/document', 'Документ на оплату')
  ] },
  { id: 'system', label: 'Система', description: 'Облікові записи, зовнішні інтеграції та службові інструменти.', children: [
    link('/admin/users', 'Облікові записи та доступи', 'Користувачі адмінки, ролі та права.'),
    link('/admin/integrations', 'Інтеграції та аналітичні сервіси', 'GA4, GTM, Meta Pixel та інші підключення.'),
    link('/admin/fun-telegram', 'Тестовий Telegram-бот', 'Службові перевірки тестового бота.')
  ] }
];

export function flattenAdminNavigation(items: AdminNavItem[]): AdminNavItem[] {
  return items.flatMap((item) => [...(item.href ? [item] : []), ...flattenAdminNavigation(item.children ?? [])]);
}

export function filterAdminNavigation(items: AdminNavItem[], role: 'admin' | 'editor', permissions: readonly AdminPermission[]): AdminNavItem[] {
  return items.flatMap((item) => {
    if (item.href) return hasAdminPermission(role, permissions, resourceForAdminPath(item.href)) ? [{ ...item }] : [];
    const children = filterAdminNavigation(item.children ?? [], role, permissions);
    return children.length ? [{ ...item, children }] : [];
  });
}

export function getAdminNavigation(role: 'admin' | 'editor', permissions: readonly AdminPermission[], messages = 0): AdminNavItem[] {
  function withBadges(items: AdminNavItem[]): AdminNavItem[] {
    return items.map((item) => ({ ...item, ...(item.href === '/admin/messages' && messages > 0 ? { badge: messages } : {}), ...(item.children ? { children: withBadges(item.children) } : {}) }));
  }
  return withBadges(filterAdminNavigation(adminNavigation, role, permissions));
}
