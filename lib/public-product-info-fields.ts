export const PRODUCT_INFO_FIELDS = [
  ['originalName', 'original_name', 'Назва мовою оригіналу', 'text'],
  ['category', 'category', 'Категорія', 'text'],
  ['unit', 'unit', 'Одиниця вимірювання', 'text'],
  ['netQuantity', 'net_quantity', 'Маса нетто / об’єм / кількість в упаковці', 'text'],
  ['netWeightWithoutGlaze', 'net_weight_without_glaze', 'Маса нетто без урахування глазурі', 'text'],
  ['alcoholContent', 'alcohol_content', 'Фактичний вміст алкоголю', 'text'],
  ['ingredients', 'ingredients', 'Перелік інгредієнтів', 'textarea'],
  ['allergens', 'allergens', 'Алергени', 'textarea'],
  ['mandatoryWarnings', 'mandatory_warnings', 'Обов’язкові застереження', 'textarea'],
  ['freezingStatus', 'freezing_status', 'Статус заморожування / розморожування', 'text'],
  ['additionalCharacteristics', 'additional_characteristics', 'Інші обов’язкові відомості', 'textarea'],
  ['preparationMethod', 'preparation_method', 'Спосіб приготування', 'textarea'],
  ['nutritionEnergy', 'nutrition_energy', 'Енергетична цінність', 'text'],
  ['nutritionFat', 'nutrition_fat', 'Жири', 'text'],
  ['nutritionSaturatedFat', 'nutrition_saturated_fat', 'Насичені жири', 'text'],
  ['nutritionCarbohydrates', 'nutrition_carbohydrates', 'Вуглеводи', 'text'],
  ['nutritionSugars', 'nutrition_sugars', 'Цукри', 'text'],
  ['nutritionProtein', 'nutrition_protein', 'Білок', 'text'],
  ['nutritionSalt', 'nutrition_salt', 'Сіль', 'text'],
  ['vitamins', 'vitamins', 'Вітаміни', 'text'],
  ['shelfLife', 'shelf_life', 'Мінімальний термін придатності', 'textarea'],
  ['storageBeforeOpening', 'storage_before_opening', 'Умови зберігання до відкриття', 'textarea'],
  ['storageAfterOpening', 'storage_after_opening', 'Умови зберігання після відкриття', 'textarea'],
  ['consumptionPeriodAfterOpening', 'consumption_period_after_opening', 'Строк споживання після відкриття', 'textarea'],
  ['countryOfOrigin', 'country_of_origin', 'Країна походження, адреса, e-mail', 'textarea'],
  ['manufacturer', 'manufacturer', 'Повне найменування виробника', 'textarea'],
  ['importer', 'importer', 'Повне найменування імпортера', 'textarea'],
  ['importerContact', 'importer_contact', 'Адреса, телефон, e-mail, код імпортера', 'textarea'],
  ['supplier', 'supplier', 'Повне найменування постачальника', 'textarea'],
  ['supplierContact', 'supplier_contact', 'Адреса, телефон, e-mail, код постачальника', 'textarea'],
  ['consumerClaims', 'consumer_claims', 'Приймає претензії від споживачів', 'textarea'],
] as const;

export type ProductInfoField = (typeof PRODUCT_INFO_FIELDS)[number][0];
export type ProductInfoDetails = Record<ProductInfoField, string> & { isGmoFree: boolean };

export const PRODUCT_INFO_FIELD_KEYS = PRODUCT_INFO_FIELDS.map(([key]) => key) as ProductInfoField[];
export const PRODUCT_INFO_DB_COLUMNS = PRODUCT_INFO_FIELDS.map(([, column]) => column);
export const emptyProductInfoDetails = (): ProductInfoDetails => ({ ...Object.fromEntries(PRODUCT_INFO_FIELD_KEYS.map((key) => [key, ''])), isGmoFree: false }) as ProductInfoDetails;
