import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getUploadsDir } from '@/lib/uploads';
import { defaultOfferProductSettings, normalizeOfferProductSettings } from '@/lib/offer-product-settings';

function settingsPath() { return path.join(getUploadsDir(), 'cooperation', 'offer-product.json'); }
export async function getOfferProductSettings() {
  try { return normalizeOfferProductSettings(JSON.parse(await fs.readFile(settingsPath(), 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(defaultOfferProductSettings);
    throw error;
  }
}

let pending: Promise<unknown> = Promise.resolve();
export function saveOfferProductSettings(raw: unknown) {
  const settings = normalizeOfferProductSettings(raw);
  const save = pending.catch(() => {}).then(async () => {
    const target = settingsPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(settings, null, 2), 'utf8');
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
    return settings;
  });
  pending = save; return save;
}
