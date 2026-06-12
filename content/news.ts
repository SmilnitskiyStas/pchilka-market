import { buildSiteImageProxyUrl } from '@/lib/site-image-proxy';

export type NewsPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  thumbnailImage: string;
  coverImage: string;
  content: string[];
};

export const newsPosts: NewsPost[] = [
  {
    slug: 'vidkryttia-onovlenoho-mahazynu-u-lvivskii-oblasti',
    title: 'Відкриття оновленого магазину у Львівській області',
    excerpt: 'Мережа Pchilka Market розширює присутність та запускає оновлений формат магазину для мешканців громади.',
    publishedAt: '2026-02-16',
    thumbnailImage: buildSiteImageProxyUrl(
      '/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20%D0%91%D0%BE%D0%B9%D0%BE%D0%B2%D0%B0%20%D0%BF%D1%87%D1%96%D0%BB%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg',
      'news-combat-1'
    ),
    coverImage: buildSiteImageProxyUrl(
      '/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20%D0%91%D0%BE%D0%B9%D0%BE%D0%B2%D0%B0%20%D0%BF%D1%87%D1%96%D0%BB%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg',
      'news-combat-1'
    ),
    content: [
      'У лютому 2026 року мережа Pchilka Market відкрила оновлений магазин у Львівській області. Локацію модернізовано з акцентом на зручний маршрут покупця, ширші проходи та швидший сервіс на касах.',
      'В асортименті посилено категорії товарів щоденного попиту, локальних виробників та сезонних пропозицій. Окрему увагу приділено акційним зонам і навігації, щоб покупці швидко знаходили потрібні товари.',
      'У найближчі тижні в магазині триватимуть промоактивності для нових відвідувачів. Актуальні деталі щодо акцій і графіка роботи публікуватимуться у розділі новин мережі.'
    ]
  },
  {
    slug: 'onovlennia-pravyl-programy-loialnosti',
    title: 'Оновлення правил програми лояльності',
    excerpt: 'Оновили умови нарахування бонусів та порядок використання кешбеку у мобільному застосунку.',
    publishedAt: '2026-02-15',
    thumbnailImage: buildSiteImageProxyUrl('/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20Milka%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg', 'news-milka-1'),
    coverImage: buildSiteImageProxyUrl('/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20Milka%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg', 'news-milka-1'),
    content: [
      'Команда Pchilka Market оновила правила програми лояльності для більш прозорого нарахування бонусів. Зміни стосуються активації персональних пропозицій та термінів дії окремих бонусних категорій.',
      'Покупцям рекомендується перевіряти умови пропозицій у застосунку перед оплатою. Це допомагає коректно активувати участь у механіках та отримувати очікуваний кешбек.',
      'Оновлена редакція правил діє з дати публікації. Повний текст змін буде додатково винесено в розділ довідкової інформації після запуску адмін-панелі.'
    ]
  },
  {
    slug: 'zvit-pro-blahodiini-initsiatyvy-merezhi',
    title: 'Звіт про благодійні ініціативи мережі',
    excerpt: 'Публікуємо короткий звіт про реалізовані благодійні активності та підтримані проєкти.',
    publishedAt: '2026-02-14',
    thumbnailImage: buildSiteImageProxyUrl(
      '/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20%D0%91%D0%BE%D0%B9%D0%BE%D0%B2%D0%B0%20%D0%BF%D1%87%D1%96%D0%BB%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg',
      'news-combat-2'
    ),
    coverImage: buildSiteImageProxyUrl(
      '/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20%D0%91%D0%BE%D0%B9%D0%BE%D0%B2%D0%B0%20%D0%BF%D1%87%D1%96%D0%BB%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg',
      'news-combat-2'
    ),
    content: [
      'За останній період мережа Pchilka Market підтримала низку локальних ініціатив у партнерстві з громадами та благодійними організаціями. Основні напрями допомоги: продуктові набори та адресна підтримка.',
      'Ми продовжуємо системний підхід до соціальної відповідальності та плануємо розширення співпраці з регіональними партнерами. Ключовий пріоритет - прозора звітність і зрозуміла комунікація результатів.',
      'Надалі у розділі "Новини мережі" будуть публікуватися регулярні підсумки виконаних ініціатив із короткими цифрами та оновленнями.'
    ]
  }
];

export function getNewsPostBySlug(slug: string) {
  return newsPosts.find((post) => post.slug === slug);
}
