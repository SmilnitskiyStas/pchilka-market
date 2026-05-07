export type MenuItem = {
  label: string;
  href: string;
  children?: MenuItem[];
};

export const mainMenu: MenuItem[] = [
  {
    label: 'Головна',
    href: '/'
  },
  {
    label: 'Про мережу',
    href: '#',
    children: [
      { label: 'Наші магазини', href: '/about/stores' },
      { label: 'Чому Пчілка не Бджілка', href: '/about/why-pchilka-not-bdzhilka' },
      { label: 'Новини мережі', href: '/news' },
      { label: 'Благодійність', href: '/about/charity' },
      { label: 'Контакти', href: '/about/contacts' },
      { label: 'Звітність', href: '/about/reporting' }
    ]
  },
  {
    label: 'Акції',
    href: '/promotions',
    children: [
      { label: 'Каталог акційних товарів', href: '/promotions/catalog' },
      { label: 'Шок ціна', href: '/promotions/shock-price' },
      { label: 'Купуй Milka та вигравай', href: '/promotions/buy-milka-win' }
    ]
  },
  {
    label: 'Блог',
    href: '/blog'
  },
  {
    label: 'Програма лояльності',
    href: '#',
    children: [
      { label: 'Про програму', href: '/loyalty/about' },
      { label: 'Правила програми', href: '/loyalty/rules' },
      { label: 'Мобільний застосунок', href: '/loyalty/mobile-app' },
      { label: 'Знижка пенсіонерам', href: '/loyalty/senior-discount' }
    ]
  },
  {
    label: 'Співпраця',
    href: '#',
    children: [
      { label: 'Запропонувати обладнання', href: '/cooperation/offer-equipment' },
      { label: 'Запропонувати товар', href: '/cooperation/offer-product' },
      { label: 'Шукаємо приміщення', href: '/cooperation/search-room' },
      { label: 'Надаємо маркетингові послуги', href: '/cooperation/marketing-services' },
      { label: 'Пропонуємо в оренду', href: '/cooperation/rental' }
    ]
  },
  {
    label: "Кар'єра",
    href: '/career'
  },
  {
    label: 'Власне класне',
    href: '/own-brand',
    children: [
      { label: 'Натуральне копчення', href: '/own-brand/natural-smoking' },
      { label: "Свіже м'ясо та риба", href: '/own-brand/fresh-meat-fish' },
      { label: "Піца та кав'ярня", href: '/own-brand/pizza-coffeehouse' },
      { label: 'Кулінарія', href: '/own-brand/cooking' },
      { label: 'Власна пекарня', href: '/own-brand/bakery' },
      { label: 'Власна кондитерська', href: '/own-brand/confectionery' }
    ]
  }
];
