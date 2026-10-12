import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export const PUBLIC_PRODUCT_DISPLAY_FIELDS = [
  ['ingredients', 'Склад'], ['fruitContent', 'Вміст фруктів / примітка'], ['preparationMethod', 'Спосіб приготування'], ['nutrition', 'Поживна цінність'], ['storageConditions', 'Зберігання'], ['shelfLife', 'Термін реалізації'], ['allergens', 'Алергени'], ['countryOfOrigin', 'Країна походження'], ['manufacturer', 'Виробник'], ['importer', 'Імпортер'], ['consumerClaims', 'Претензії споживачів'], ['gmoFree', 'Позначка «Без ГМО»']
] as const;
export type PublicProductDisplayField = (typeof PUBLIC_PRODUCT_DISPLAY_FIELDS)[number][0];
export type PublicProductDisplaySettings = Record<PublicProductDisplayField, boolean>;

export function defaultPublicProductDisplaySettings(): PublicProductDisplaySettings {
  return Object.fromEntries(PUBLIC_PRODUCT_DISPLAY_FIELDS.map(([key]) => [key, true])) as PublicProductDisplaySettings;
}

export async function getPublicProductDisplaySettings(): Promise<PublicProductDisplaySettings> {
  const defaults = defaultPublicProductDisplaySettings();
  const [rows] = await getDbPool().query<Array<RowDataPacket & { field_key: PublicProductDisplayField; is_visible: number }>>('SELECT field_key, is_visible FROM public_product_info_display_settings');
  rows.forEach((row) => { if (row.field_key in defaults) defaults[row.field_key] = Boolean(row.is_visible); });
  return defaults;
}

export async function savePublicProductDisplaySettings(input: Partial<PublicProductDisplaySettings>) {
  const settings = { ...defaultPublicProductDisplaySettings(), ...input };
  await Promise.all(PUBLIC_PRODUCT_DISPLAY_FIELDS.map(([key]) => getDbPool().query('INSERT INTO public_product_info_display_settings (field_key, is_visible) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_visible=VALUES(is_visible)', [key, settings[key] ? 1 : 0])));
  return settings;
}
