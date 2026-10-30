import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getUploadsDir } from '@/lib/uploads';
import { defaultHomeLoyaltyImage, validateHomeLoyaltyImage, type HomeLoyaltyImageSettings } from '@/lib/home-loyalty-image-settings';

const settingsPath = () => path.join(getUploadsDir(), 'home', 'loyalty-image.json');
export async function readHomeLoyaltyImage(): Promise<HomeLoyaltyImageSettings> {
  try { return validateHomeLoyaltyImage(JSON.parse(await fs.readFile(settingsPath(), 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaultHomeLoyaltyImage };
    throw error;
  }
}
let pending: Promise<unknown> = Promise.resolve();
export function saveHomeLoyaltyImage(raw: unknown): Promise<HomeLoyaltyImageSettings> {
  const settings = validateHomeLoyaltyImage(raw);
  const save = pending.catch(() => {}).then(async () => {
    const target = settingsPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
    return settings;
  });
  pending = save;
  return save;
}
