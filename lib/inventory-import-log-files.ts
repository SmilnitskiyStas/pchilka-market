import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import { buildMediaUrl, getUploadsDir } from '@/lib/uploads';
import type { InventoryProductImportSummary } from '@/lib/inventory-products-repository';

export type InventoryProductImportLogFile = {
  fileName: string;
  importedBy: string;
  storedAt: string;
  logFileName: string;
  logFileUrl: string;
  summary: InventoryProductImportSummary;
};

function sanitizeFileNamePart(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function buildImportLogsRoot() {
  return path.join(getUploadsDir(), 'admin', 'inventory', 'import-logs');
}

export async function writeInventoryProductImportLogFile(input: {
  fileName: string;
  importedBy: string;
  summary: InventoryProductImportSummary;
}): Promise<InventoryProductImportLogFile> {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const safeBaseName = sanitizeFileNamePart(input.fileName.replace(/\.[^.]+$/, ''), 'inventory-import');
  const logFileName = `${timestamp}_${safeBaseName}.json`;
  const relativeParts = ['admin', 'inventory', 'import-logs', year, month, logFileName];
  const absoluteDir = path.join(buildImportLogsRoot(), year, month);
  const absolutePath = path.join(absoluteDir, logFileName);
  const latestPath = path.join(buildImportLogsRoot(), 'latest.json');

  const payload: InventoryProductImportLogFile = {
    fileName: input.fileName,
    importedBy: input.importedBy.trim() || 'admin',
    storedAt: now.toISOString(),
    logFileName,
    logFileUrl: buildMediaUrl(relativeParts),
    summary: input.summary
  };

  await mkdir(absoluteDir, { recursive: true });
  await mkdir(buildImportLogsRoot(), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(payload, null, 2), 'utf8');
  await writeFile(latestPath, JSON.stringify(payload, null, 2), 'utf8');

  return payload;
}

export async function readLatestInventoryProductImportLogFile(): Promise<InventoryProductImportLogFile | null> {
  try {
    const latestPath = path.join(buildImportLogsRoot(), 'latest.json');
    const raw = await readFile(latestPath, 'utf8');
    const parsed = JSON.parse(raw) as InventoryProductImportLogFile | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.summary || typeof parsed.summary !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
