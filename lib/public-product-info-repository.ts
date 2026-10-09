import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

type PublicProductLookupRow = RowDataPacket & {
  article: string;
  name: string;
  barcode: string | null;
  ingredients: string | null;
  fruitContent: string | null;
  nutritionFat: string | null;
  nutritionSaturatedFat: string | null;
  nutritionCarbohydrates: string | null;
  nutritionSugars: string | null;
  nutritionProtein: string | null;
  nutritionSalt: string | null;
  nutritionEnergy: string | null;
  storageConditions: string | null;
  shelfLife: string | null;
  allergens: string | null;
  countryOfOrigin: string | null;
  manufacturer: string | null;
  importer: string | null;
  consumerClaims: string | null;
  isGmoFree: number;
};

export type PublicProductDetails = {
  ingredients: string;
  fruitContent: string;
  nutritionFat: string;
  nutritionSaturatedFat: string;
  nutritionCarbohydrates: string;
  nutritionSugars: string;
  nutritionProtein: string;
  nutritionSalt: string;
  nutritionEnergy: string;
  storageConditions: string;
  shelfLife: string;
  allergens: string;
  countryOfOrigin: string;
  manufacturer: string;
  importer: string;
  consumerClaims: string;
  isGmoFree: boolean;
};

export type PublicProductLookupResult = { article: string; name: string; barcode: string | null; details: PublicProductDetails | null };

function normalizeLookupCode(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/\.0+$/, '');
}

function valueOrEmpty(value: string | null) { return value ?? ''; }

export async function findPublicProductByCode(rawCode: string): Promise<PublicProductLookupResult | null> {
  const code = normalizeLookupCode(rawCode);
  if (!code || code.length > 120) return null;

  const db = getDbPool();
  const [rows] = await db.query<PublicProductLookupRow[]>(
    `SELECT p.article, p.product_name AS name, matched_barcode.barcode,
      info.ingredients, info.fruit_content AS fruitContent,
      info.nutrition_fat AS nutritionFat, info.nutrition_saturated_fat AS nutritionSaturatedFat,
      info.nutrition_carbohydrates AS nutritionCarbohydrates, info.nutrition_sugars AS nutritionSugars,
      info.nutrition_protein AS nutritionProtein, info.nutrition_salt AS nutritionSalt, info.nutrition_energy AS nutritionEnergy,
      info.storage_conditions AS storageConditions, info.shelf_life AS shelfLife, info.allergens,
      info.country_of_origin AS countryOfOrigin, info.manufacturer, info.importer, info.consumer_claims AS consumerClaims,
      COALESCE(info.is_gmo_free, 0) AS isGmoFree
    FROM products p
    LEFT JOIN product_barcodes AS matched_barcode ON matched_barcode.product_id = p.id
      AND REPLACE(TRIM(COALESCE(matched_barcode.barcode, '')), ' ', '') = ?
    LEFT JOIN public_product_info AS info ON info.product_id = p.id
    WHERE p.is_active = 1 AND (matched_barcode.id IS NOT NULL OR REPLACE(TRIM(COALESCE(p.article, '')), ' ', '') = ?)
    ORDER BY p.id ASC LIMIT 1`,
    [code, code]
  );
  const row = rows[0];
  if (!row) return null;
  const hasDetails = Boolean(row.ingredients || row.manufacturer || row.nutritionEnergy);
  return {
    article: row.article, name: row.name, barcode: row.barcode,
    details: hasDetails ? {
      ingredients: valueOrEmpty(row.ingredients), fruitContent: valueOrEmpty(row.fruitContent), nutritionFat: valueOrEmpty(row.nutritionFat),
      nutritionSaturatedFat: valueOrEmpty(row.nutritionSaturatedFat), nutritionCarbohydrates: valueOrEmpty(row.nutritionCarbohydrates),
      nutritionSugars: valueOrEmpty(row.nutritionSugars), nutritionProtein: valueOrEmpty(row.nutritionProtein), nutritionSalt: valueOrEmpty(row.nutritionSalt), nutritionEnergy: valueOrEmpty(row.nutritionEnergy),
      storageConditions: valueOrEmpty(row.storageConditions), shelfLife: valueOrEmpty(row.shelfLife), allergens: valueOrEmpty(row.allergens),
      countryOfOrigin: valueOrEmpty(row.countryOfOrigin), manufacturer: valueOrEmpty(row.manufacturer), importer: valueOrEmpty(row.importer),
      consumerClaims: valueOrEmpty(row.consumerClaims), isGmoFree: Boolean(row.isGmoFree)
    } : null
  };
}
