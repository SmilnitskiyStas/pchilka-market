export const INVENTORY_POSITION_SETTINGS_KEY = 'inventory_position_titles';

export const defaultInventoryPositionTitles = [
  'Керуючий магазином',
  'Заступник керуючого магазином',
  'Приймальник товару',
  'Оператор-приймальник',
  'Оператор 1С',
  'Вантажник',
  'Фасувальник'
];

function buildPositionKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA');
}

export function normalizeInventoryPositionTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeInventoryPositionTitles(input: unknown): string[] {
  const source = Array.isArray(input) ? input : defaultInventoryPositionTitles;
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const item of source) {
    if (typeof item !== 'string') continue;

    const normalized = normalizeInventoryPositionTitle(item);
    if (!normalized) continue;

    const key = buildPositionKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    titles.push(normalized);
  }

  return titles.sort((left, right) => left.localeCompare(right, 'uk-UA'));
}

export function findMatchingInventoryPositionTitle(positionTitles: string[], value: string) {
  const normalized = normalizeInventoryPositionTitle(value);
  if (!normalized) return '';

  const targetKey = buildPositionKey(normalized);
  return positionTitles.find((item) => buildPositionKey(item) === targetKey) ?? '';
}
