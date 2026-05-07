export type OwnBrandItem = {
  slug: string;
  title: string;
  description: string;
  contentFileName?: string;
  imageFileName?: string;
};

export const ownBrandItems: OwnBrandItem[] = [
  {
    slug: 'natural-smoking',
    title: 'Натуральне копчення',
    description:
      'Добірні продукти з натуральним копченням: акцент на смак, якість інгредієнтів і контроль технології приготування.',
    contentFileName: 'natural_smoking.txt'
  },
  {
    slug: 'fresh-meat-fish',
    title: "Свіже м'ясо та риба",
    description:
      "Щоденні свіжі позиції м'яса та риби з фокусом на стабільну якість, правильне зберігання та широкий вибір для різних страв.",
    contentFileName: 'fresh_meat_fish.txt',
    imageFileName: 'meat-min-1024x548.jpg'
  },
  {
    slug: 'pizza-coffeehouse',
    title: "Піца та кав'ярня",
    description:
      "Зона швидкого перекусу: свіжа піца, ароматна кава та супутні продукти для комфортного формату «взяти з собою» або на місці."
  },
  {
    slug: 'cooking',
    title: 'Кулінарія',
    description:
      'Готові страви та кулінарні рішення на щодень: зручний формат для тих, хто цінує швидкість і домашній смак.',
    contentFileName: 'cooking/cooking_text.txt',
    imageFileName: 'cooking/cooking_img.jpg'
  },
  {
    slug: 'bakery',
    title: 'Власна пекарня',
    description:
      'Випічка власного виробництва: хліб, булочні вироби та сезонні новинки з оновленням асортименту.',
    contentFileName: 'own_bakery/bakery_text.txt'
  },
  {
    slug: 'confectionery',
    title: 'Власна кондитерська',
    description:
      'Десерти та солодощі власного виробництва: від класичних позицій до святкових пропозицій.',
    contentFileName: 'pastry_shop/text.txt',
    imageFileName: 'pastry_shop/grand_gateau.webp'
  }
];

export function getOwnBrandItemBySlug(slug: string) {
  return ownBrandItems.find((item) => item.slug === slug);
}
