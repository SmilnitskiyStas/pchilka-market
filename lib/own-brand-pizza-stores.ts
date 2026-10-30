import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getUploadsDir } from '@/lib/uploads';
import { listStoresFromDb } from '@/lib/stores-repository';
import { groupPizzaStores, matchLegacyPizzaStores, normalizePizzaStoreIds, parseLegacyPizzaStores, type PizzaStoreOption } from '@/lib/pizza-store-selection';

function settingsPath() { return path.join(getUploadsDir(), 'own-brand', 'pizza-stores.json'); }

export async function readPizzaStoreIds(): Promise<string[] | null> {
  try {
    const value = JSON.parse(await fs.readFile(settingsPath(), 'utf8')) as { storeIds?: unknown };
    return normalizePizzaStoreIds(value.storeIds);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function readLegacyPizzaStores() {
  try {
    return parseLegacyPizzaStores(await fs.readFile(path.join(process.cwd(), 'public', 'img', 'own_brand', 'pizza_and_coffee', 'pizza_store.txt'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { title: 'Магазини з піцою', groups: [] };
    throw error;
  }
}

export async function listPizzaStoreOptions(): Promise<PizzaStoreOption[]> {
  return (await listStoresFromDb()).filter((store) => store.isActive && store.city.trim() && store.addressLine.trim())
    .map(({ id, name, city, addressLine, storeCode }) => ({ id, name, city, addressLine, storeCode }));
}

export async function getPizzaStoreEditorData() {
  const [stores, savedIds] = await Promise.all([listPizzaStoreOptions(), readPizzaStoreIds()]);
  if (savedIds === null) {
    const matched = matchLegacyPizzaStores(await readLegacyPizzaStores(), stores);
    return { stores, storeIds: matched.storeIds, legacyUnmatchedCount: matched.unmatchedCount, unavailableSelectedCount: 0 };
  }
  const available = new Set(stores.map((store) => store.id));
  return { stores, storeIds: savedIds.filter((id) => available.has(id)), legacyUnmatchedCount: 0, unavailableSelectedCount: savedIds.filter((id) => !available.has(id)).length };
}

let pending: Promise<unknown> = Promise.resolve();
export async function savePizzaStoreIds(storeIds: string[]) {
  const normalized = normalizePizzaStoreIds(storeIds);
  const save = pending.catch(() => {}).then(async () => {
    const target = settingsPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify({ storeIds: normalized }, null, 2)}\n`, 'utf8');
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
    return normalized;
  });
  pending = save;
  return save;
}

export async function getPublicPizzaStores() {
  const storeIds = await readPizzaStoreIds();
  if (storeIds === null) return readLegacyPizzaStores();
  // An explicitly empty choice must not bring the old addresses back.
  if (!storeIds.length) return { title: 'Магазини з піцою', groups: [] };
  return groupPizzaStores(await listPizzaStoreOptions(), storeIds);
}
