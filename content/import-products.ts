export type ImportProduct = {
  slug: string;
  name: string;
  countryOfOrigin: string;
  ingredients: string;
  fruitContent: string;
  nutrition: { fat: string; saturatedFat: string; carbohydrates: string; sugars: string; protein: string; salt: string; energy: string };
  storage: string;
  shelfLife: string;
  allergens: string;
  manufacturer: string;
  importer: string;
  consumerClaims: string;
  gmo: string;
  barcode?: string;
  productCode?: string;
};

export const importProducts: ImportProduct[] = [{
  slug: 'hello-viva-frukt-ananas-1l',
  name: 'Напій Hello Viva Фрукт. Ананас 1 л',
  countryOfOrigin: 'Чехія',
  ingredients: 'вода питна, сік ананасовий з концентрату 25%, цукор, сік яблучний з концентрату 5%, кислота: кислота лимонна, аромат ананаса, концентрат фарбувальних трав (шафран фарбувальний).',
  fruitContent: 'Виготовляється з концентратів. Вміст фруктів — 30%.',
  nutrition: { fat: '0,1 г', saturatedFat: '0 г', carbohydrates: '10,0 г', sugars: '9,8 г', protein: '0,1 г', salt: '<0,05 г', energy: '170 кДж / 40 ккал' },
  storage: 'Зберігайте у сухому та прохолодному місці. Після відкриття охолодити і спожити протягом 48 годин.',
  shelfLife: '12 місяців з дати виробництва. Кінцеву дату споживання «Вжити до» див. на верхній частині упаковки.',
  allergens: 'Продукт не містить алергенів, згаданих у Регламенті (ЄС) 1169/2011.',
  manufacturer: 'LINEA NIVNICE, a.s., u Dvora 190, 687 51 Nivnice, Czech Republic.',
  importer: 'ТОВ «Легіон 2015», Україна, 08139, Київська обл., Бучанський р-н, с. Білогородка, вул. Аграрна, буд. 1. Тел.: +38 (044) 486-99-63.',
  consumerClaims: 'Претензії від споживачів приймає імпортер.',
  gmo: 'Без ГМО.'
}];

export function getImportProductBySlug(slug: string): ImportProduct | undefined {
  return importProducts.find((product) => product.slug === slug);
}


