import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getUploadsDir } from '@/lib/uploads';
import { defaultSiteMenu, normalizeSiteMenu } from '@/lib/site-menu';

function filePath() { return path.join(getUploadsDir(), 'navigation', 'menu.json'); }
export async function getSiteMenuSettings() {
  try { return normalizeSiteMenu(JSON.parse(await fs.readFile(filePath(), 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(defaultSiteMenu); throw error; }
}
let pending: Promise<unknown> = Promise.resolve();
export function saveSiteMenuSettings(raw: unknown) {
  const settings = normalizeSiteMenu(raw);
  const save = pending.catch(() => {}).then(async () => {
    const target = filePath(); await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, JSON.stringify(settings, null, 2), 'utf8'); await fs.rename(temporary, target); }
    finally { await fs.rm(temporary, { force: true }); }
    return settings;
  });
  pending = save; return save;
}
