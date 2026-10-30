export type PizzaStoreOption = { id: string; name: string; city: string; addressLine: string; storeCode: string };
export type PizzaStoreGroup = { city: string; addresses: string[] };
export type PizzaStoreContent = { title: string; groups: PizzaStoreGroup[] };

export function normalizePizzaStoreIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 2000 || value.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))) {
    throw new Error('Передайте список ідентифікаторів магазинів.');
  }
  return [...new Set(value as string[])];
}

export function parseLegacyPizzaStores(raw: string): PizzaStoreContent {
  const [title = 'Магазини з піцою', ...lines] = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const groups: PizzaStoreGroup[] = [];
  let current: PizzaStoreGroup | undefined;
  for (const line of lines) {
    if (/^(м\.|с\.|с-ще|смт\.)/i.test(line)) {
      current = { city: line, addresses: [] };
      groups.push(current);
    } else if (current) current.addresses.push(line);
  }
  return { title, groups };
}

function locationKey(city: string, address: string) {
  const clean = (text: string) => text.normalize('NFKC').toLocaleLowerCase('uk').replace(/[’'ʼ]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${clean(city).replace(/^(м|с|с-ще|смт|місто)\s+/, '')}|${clean(address).replace(/^(вул|вулиця)\s+/, '')}`;
}

export function matchLegacyPizzaStores(content: PizzaStoreContent, stores: PizzaStoreOption[]) {
  const selected = new Set<string>();
  let unmatchedCount = 0;
  for (const group of content.groups) for (const address of group.addresses) {
    const matches = stores.filter((store) => locationKey(store.city, store.addressLine) === locationKey(group.city, address));
    if (matches.length) matches.forEach((store) => selected.add(store.id));
    else unmatchedCount++;
  }
  return { storeIds: [...selected], unmatchedCount };
}

export function groupPizzaStores(stores: PizzaStoreOption[], storeIds: string[]): PizzaStoreContent {
  const selected = new Set(storeIds);
  const cities = new Map<string, Set<string>>();
  for (const store of stores) if (selected.has(store.id)) {
    if (!cities.has(store.city)) cities.set(store.city, new Set());
    cities.get(store.city)!.add(store.addressLine);
  }
  return { title: 'Магазини з піцою', groups: [...cities].map(([city, addresses]) => ({ city, addresses: [...addresses] })) };
}
