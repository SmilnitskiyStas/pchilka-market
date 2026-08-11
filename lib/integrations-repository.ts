import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  ANALYTICS_SETTINGS_KEY,
  defaultIntegrationsSettings,
  isValidAiModel,
  normalizeIntegrationsSettings,
  type IntegrationsSettings
} from '@/lib/integrations-settings';

type SiteSettingRow = RowDataPacket & { setting_value: unknown };
type StoredIntegrationsSettings = Partial<IntegrationsSettings> & { aiApiKeyEncrypted?: string };

function encryptionKey() {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new Error('Для збереження AI-ключа задайте INTEGRATIONS_ENCRYPTION_KEY або ADMIN_SESSION_SECRET на сервері.');
  return createHash('sha256').update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new Error('Збережений AI-ключ має некоректний формат.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}

function parseStored(value: unknown): StoredIntegrationsSettings {
  if (!value) return {};
  if (typeof value !== 'string') return value as StoredIntegrationsSettings;
  try { return JSON.parse(value) as StoredIntegrationsSettings; } catch { return {}; }
}

async function getStoredSettings(): Promise<StoredIntegrationsSettings> {
  const pool = getDbPool();
  const [rows] = await pool.query<SiteSettingRow[]>('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', [ANALYTICS_SETTINGS_KEY]);
  return parseStored(rows[0]?.setting_value);
}

export async function getIntegrationsSettingsFromDb(): Promise<IntegrationsSettings> {
  const stored = await getStoredSettings();
  if (!Object.keys(stored).length) return defaultIntegrationsSettings;
  return normalizeIntegrationsSettings({ ...stored, aiApiKeyConfigured: Boolean(stored.aiApiKeyEncrypted) });
}

export async function saveIntegrationsSettingsToDb(settings: IntegrationsSettings, options?: { aiApiKey?: string; clearAiApiKey?: boolean }): Promise<IntegrationsSettings> {
  const normalized = normalizeIntegrationsSettings(settings);
  const existing = await getStoredSettings();
  const enteredKey = options?.aiApiKey?.trim();
  const aiApiKeyEncrypted = options?.clearAiApiKey ? undefined : enteredKey ? encrypt(enteredKey) : existing.aiApiKeyEncrypted;
  const stored: StoredIntegrationsSettings = { ...normalized, aiApiKeyEncrypted };
  const pool = getDbPool();
  await pool.query(
    `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [ANALYTICS_SETTINGS_KEY, JSON.stringify(stored)]
  );
  return normalizeIntegrationsSettings({ ...stored, aiApiKeyConfigured: Boolean(aiApiKeyEncrypted) });
}

export async function getRfmAiConnection(): Promise<{ enabled: boolean; apiKey: string; model: string }> {
  const stored = await getStoredSettings();
  const fallbackKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  const apiKey = stored.aiApiKeyEncrypted ? decrypt(stored.aiApiKeyEncrypted) : fallbackKey;
  const model = String(stored.aiModel ?? '').trim();
  return { enabled: stored.aiEnabled === true || Boolean(fallbackKey), apiKey, model: isValidAiModel(model) && model ? model : 'gpt-5.6-luna' };
}
