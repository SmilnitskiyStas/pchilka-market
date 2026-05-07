export type HomeBanner = {
  id: string;
  src: string;
  alt: string;
  href?: string;
  isActive: boolean;
  publishFrom?: string;
  publishTo?: string;
};

export const defaultHomeBanners: HomeBanner[] = [
  {
    id: 'milka-main',
    src: '/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20Milka%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg',
    alt: 'Головний банер Milka',
    href: '/promotions/buy-milka-win',
    isActive: true
  },
  {
    id: 'combat-bee-main',
    src: '/img/baners/%D0%B1%D0%B0%D0%BD%D0%BD%D0%B5%D1%80%20%D0%91%D0%BE%D0%B9%D0%BE%D0%B2%D0%B0%20%D0%BF%D1%87%D1%96%D0%BB%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D1%81%D0%B0%D0%B9%D1%82.jpg',
    alt: 'Головний банер Бойова Пчілка',
    isActive: true
  }
];
