import { promises as fs } from 'fs';
import path from 'path';

import { getUploadsDir } from '@/lib/uploads';

export type PromotionCatalogMetadata = {
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
};

const METADATA_FILE_NAME = 'catalog-metadata.json';
const SETTINGS_FILE_NAME = 'catalog-settings.json';

export type PromotionCatalogSettings = {
  showArchive: boolean;
};

function metadataFilePath(): string {
  return path.join(getUploadsDir(), 'promotions', 'catalogs', METADATA_FILE_NAME);
}

function settingsFilePath(): string {
  return path.join(getUploadsDir(), 'promotions', 'catalogs', SETTINGS_FILE_NAME);
}

export async function getPromotionCatalogSettings(): Promise<PromotionCatalogSettings> {
  try {
    const raw = await fs.readFile(settingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PromotionCatalogSettings>;
    return { showArchive: parsed.showArchive === true };
  } catch {
    return { showArchive: false };
  }
}

export async function savePromotionCatalogSettings(
  settings: Partial<PromotionCatalogSettings>
): Promise<PromotionCatalogSettings> {
  const normalized = { showArchive: settings.showArchive === true };
  const filePath = settingsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function normalizeMetadata(value: Partial<PromotionCatalogMetadata>): PromotionCatalogMetadata {
  return {
    title: String(value.title ?? '').trim(),
    seoTitle: String(value.seoTitle ?? '').trim(),
    seoDescription: String(value.seoDescription ?? '').trim(),
    seoKeywords: String(value.seoKeywords ?? '').trim()
  };
}

export async function getPromotionCatalogMetadata(): Promise<Record<string, PromotionCatalogMetadata>> {
  try {
    const raw = await fs.readFile(metadataFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, Partial<PromotionCatalogMetadata>>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed).map(([id, metadata]) => [id, normalizeMetadata(metadata)]));
  } catch {
    return {};
  }
}

export async function savePromotionCatalogMetadata(
  id: string,
  metadata: Partial<PromotionCatalogMetadata>
): Promise<PromotionCatalogMetadata> {
  const allMetadata = await getPromotionCatalogMetadata();
  const normalized = normalizeMetadata(metadata);
  allMetadata[id] = normalized;

  const filePath = metadataFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(allMetadata, null, 2), 'utf8');
  return normalized;
}

export async function removePromotionCatalogMetadata(id: string): Promise<void> {
  const allMetadata = await getPromotionCatalogMetadata();
  if (!(id in allMetadata)) return;

  delete allMetadata[id];
  await fs.writeFile(metadataFilePath(), JSON.stringify(allMetadata, null, 2), 'utf8');
}
