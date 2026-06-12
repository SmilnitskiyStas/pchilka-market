export type AdminSection = {
  href: string;
  title: string;
  description: string;
};

export const adminSections: AdminSection[] = [
  {
    href: '/admin',
    title: 'Dashboard',
    description: 'Огляд стану проєкту та швидкі переходи до розділів керування.'
  },
  {
    href: '/admin/content',
    title: 'Контент',
    description: 'Статті та категорії: блог, новини мережі, благодійність.'
  },
  {
    href: '/admin/home-slides',
    title: 'Банери',
    description: 'Керування головними банерами та переходами на сторінки подій.'
  },
  {
    href: '/admin/promotions',
    title: 'Акції',
    description: 'Керування акційними блоками, промо-сторінками та PDF-каталогом.'
  },
  {
    href: '/admin/media',
    title: 'Медіафайли',
    description: 'Фото, відео, PDF, банери та бренд-матеріали в одному керованому сховищі.'
  },
  {
    href: '/admin/network',
    title: 'Мережа',
    description: 'Контакти, карта та список магазинів для публічних сторінок.'
  },
  {
    href: '/admin/messages',
    title: 'Повідомлення',
    description: 'Заявки з форм співпраці, карʼєри та зворотного зв’язку.'
  },
  {
    href: '/admin/own-brand',
    title: 'Власне класне',
    description: 'Керування контентом для підрозділів власного виробництва.'
  },
  {
    href: '/admin/seo',
    title: 'SEO',
    description: 'Title, description, canonical, а також контроль sitemap і robots.'
  },
  {
    href: '/admin/integrations',
    title: 'Інтеграції',
    description: 'Поля для налаштувань GA4, GTM та Meta Pixel.'
  },
  {
    href: '/admin/inventory',
    title: 'Інвентар',
    description: 'Облік партій, Telegram workflow, перевірки термінів і аналітика по магазинах.'
  },
  {
    href: '/admin/inventory/settings/schema',
    title: 'Налаштування схеми',
    description: 'Параметри inventory-схеми, готовності модуля та службових конфігурацій.'
  },
  {
    href: '/admin/inventory/settings/telegram',
    title: 'Налаштування Telegram',
    description: 'Webhook, бот, розсилка та інші параметри Telegram-інтеграції inventory.'
  },
  {
    href: '/admin/users',
    title: 'Користувачі',
    description: 'Керування користувачами, ролями та доступами до адмін-панелі.'
  }
];
