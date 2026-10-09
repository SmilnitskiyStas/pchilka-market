CREATE TABLE IF NOT EXISTS public_product_info (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  ingredients TEXT NULL,
  fruit_content TEXT NULL,
  nutrition_fat VARCHAR(40) NULL,
  nutrition_saturated_fat VARCHAR(40) NULL,
  nutrition_carbohydrates VARCHAR(40) NULL,
  nutrition_sugars VARCHAR(40) NULL,
  nutrition_protein VARCHAR(40) NULL,
  nutrition_salt VARCHAR(40) NULL,
  nutrition_energy VARCHAR(80) NULL,
  storage_conditions TEXT NULL,
  shelf_life TEXT NULL,
  allergens TEXT NULL,
  country_of_origin VARCHAR(120) NULL,
  manufacturer TEXT NULL,
  importer TEXT NULL,
  consumer_claims TEXT NULL,
  is_gmo_free TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_public_product_info_product (product_id),
  CONSTRAINT fk_public_product_info_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO public_product_info (
  product_id, ingredients, fruit_content,
  nutrition_fat, nutrition_saturated_fat, nutrition_carbohydrates, nutrition_sugars, nutrition_protein, nutrition_salt, nutrition_energy,
  storage_conditions, shelf_life, allergens, country_of_origin, manufacturer, importer, consumer_claims, is_gmo_free
)
SELECT
  p.id,
  'вода питна, сік ананасовий з концентрату 25%, цукор, сік яблучний з концентрату 5%, кислота: кислота лимонна, аромат ананаса, концентрат фарбувальних трав (шафран фарбувальний).',
  'Виготовляється з концентратів. Вміст фруктів — 30%.',
  '0,1 г', '0 г', '10,0 г', '9,8 г', '0,1 г', '<0,05 г', '170 кДж / 40 ккал',
  'Зберігайте у сухому та прохолодному місці. Після відкриття охолодити і спожити протягом 48 годин.',
  '12 місяців з дати виробництва. Кінцеву дату споживання «Вжити до» див. на верхній частині упаковки.',
  'Продукт не містить алергенів, згаданих у Регламенті (ЄС) 1169/2011.',
  'Чехія',
  'LINEA NIVNICE, a.s., u Dvora 190, 687 51 Nivnice, Czech Republic.',
  'ТОВ «Легіон 2015», Україна, 08139, Київська обл., Бучанський р-н, с. Білогородка, вул. Аграрна, буд. 1. Тел.: +38 (044) 486-99-63.',
  'Претензії від споживачів приймає імпортер.',
  1
FROM products p
WHERE p.article = '51429'
  AND EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode = '8590014818507')
ON DUPLICATE KEY UPDATE
  ingredients = VALUES(ingredients),
  fruit_content = VALUES(fruit_content),
  nutrition_fat = VALUES(nutrition_fat),
  nutrition_saturated_fat = VALUES(nutrition_saturated_fat),
  nutrition_carbohydrates = VALUES(nutrition_carbohydrates),
  nutrition_sugars = VALUES(nutrition_sugars),
  nutrition_protein = VALUES(nutrition_protein),
  nutrition_salt = VALUES(nutrition_salt),
  nutrition_energy = VALUES(nutrition_energy),
  storage_conditions = VALUES(storage_conditions),
  shelf_life = VALUES(shelf_life),
  allergens = VALUES(allergens),
  country_of_origin = VALUES(country_of_origin),
  manufacturer = VALUES(manufacturer),
  importer = VALUES(importer),
  consumer_claims = VALUES(consumer_claims),
  is_gmo_free = VALUES(is_gmo_free);
