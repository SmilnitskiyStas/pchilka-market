import { promises as fs } from 'fs';
import path from 'path';

type CatalogFile = { url: string; addedAt: number };

// Uploaded filenames carry Date.now(): preserve their original upload order even
// after copies/restores change filesystem timestamps. Legacy files use mtime.
export async function listMediaFiles(root: string, extensions: ReadonlySet<string>, toUrl: (relative: string) => string, excludedNames: readonly string[] = []): Promise<CatalogFile[]> {
  async function walk(directory: string): Promise<CatalogFile[]> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: CatalogFile[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || excludedNames.includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) { files.push(...await walk(absolute)); continue; }
      if (!entry.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
      const timestamp = entry.name.match(/^(\d{13})-/);
      let modifiedAt: number;
      try { modifiedAt = (await fs.stat(absolute)).mtimeMs; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      files.push({ url: toUrl(path.relative(root, absolute).replace(/\\/g, '/')), addedAt: timestamp ? Number(timestamp[1]) : modifiedAt });
    }
    return files;
  }
  return (await walk(root)).sort((a, b) => b.addedAt - a.addedAt || a.url.localeCompare(b.url));
}
