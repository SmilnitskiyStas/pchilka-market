import { randomBytes } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { isEngineeringEnabled, readEngineeringEnv, resolveEngineeringEnvPath } from '@/scripts/engineering-env.cjs';

export type EngineeringSettings = {
  enabled: boolean; mailHost: string; mailPort: number; mailUser: string; mailPassword: string;
  mailFolder: string; botToken: string; chatId: string; publicBaseUrl: string; webhookSecret: string; runSecret: string;
};
const keys: Record<keyof EngineeringSettings, string> = {
  enabled: 'ENABLED', mailHost: 'MAIL_HOST', mailPort: 'MAIL_PORT', mailUser: 'MAIL_USER', mailPassword: 'MAIL_PASSWORD',
  mailFolder: 'MAIL_FOLDER', botToken: 'BOT_TOKEN', chatId: 'CHAT_ID', publicBaseUrl: 'PUBLIC_BASE_URL', webhookSecret: 'WEBHOOK_SECRET', runSecret: 'RUN_SECRET'
};
export const engineeringEnvPath = resolveEngineeringEnvPath;
export class EngineeringSettingsStorageError extends Error {}
export async function readEngineeringSettings(): Promise<EngineeringSettings> {
  const { values } = await readEngineeringEnv();
  const get = (key: keyof EngineeringSettings, fallback = '') => String(values[keys[key]] ?? process.env[`ENGINEERING_${keys[key]}`] ?? fallback);
  return { enabled: isEngineeringEnabled(get('enabled')), mailHost: get('mailHost'), mailPort: Number(get('mailPort', '993')), mailUser: get('mailUser', 'engineer@legion2015.com'), mailPassword: get('mailPassword'), mailFolder: get('mailFolder', 'INBOX'), botToken: get('botToken'), chatId: get('chatId'), publicBaseUrl: get('publicBaseUrl'), webhookSecret: get('webhookSecret'), runSecret: get('runSecret') };
}
let saving = Promise.resolve();
export async function saveEngineeringSettings(input: Record<string, unknown>) {
  const operation = saving.then(async () => {
    const current = await readEngineeringSettings();
    const next = { ...current };
    for (const key of ['mailHost', 'mailUser', 'mailFolder', 'chatId', 'publicBaseUrl'] as const) {
      if (typeof input[key] === 'string') next[key] = input[key].trim();
    }
    for (const key of ['mailPassword', 'botToken'] as const) {
      if (typeof input[key] === 'string' && input[key]) next[key] = input[key];
    }
    if (typeof input.enabled === 'boolean') next.enabled = input.enabled;
    if (input.mailPort !== undefined) next.mailPort = Number(input.mailPort);
    next.publicBaseUrl = next.publicBaseUrl.replace(/\/+$/, '');
    next.webhookSecret ||= randomBytes(32).toString('hex');
    next.runSecret ||= randomBytes(32).toString('hex');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.mailUser) || !next.mailFolder || next.mailFolder.length > 200 || !Number.isInteger(next.mailPort) || next.mailPort < 1 || next.mailPort > 65535) throw new Error('Перевірте адресу пошти, папку та порт IMAP.');
    if (next.mailHost && !/^[a-zA-Z0-9.-]+$/.test(next.mailHost)) throw new Error('Вкажіть домен IMAP-сервера без протоколу.');
    if (next.botToken && !/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(next.botToken)) throw new Error('Некоректний токен бота.');
    if (next.chatId && !/^(?:-?\d{1,20}|@[a-zA-Z][a-zA-Z0-9_]{4,31})$/.test(next.chatId)) throw new Error('Некоректний ID групи або назва каналу.');
    if (next.publicBaseUrl && !/^https:\/\/[^\s/?#]+(?::\d+)?$/.test(next.publicBaseUrl)) throw new Error('Потрібна публічна HTTPS-адреса сайту без шляху.');
    if (next.enabled && (!next.mailHost || !next.mailPassword || !next.botToken || !next.publicBaseUrl)) throw new Error('Для увімкнення заповніть IMAP-сервер, пароль, токен і HTTPS-адресу сайту.');
    const target = engineeringEnvPath();
    await mkdir(path.dirname(target), { recursive: true });
    const original = await readFile(target, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return ''; throw error; });
    const names = new Set(Object.values(keys).map(key => `ENGINEERING_${key}`));
    const retained = original.split(/\r?\n/).filter(line => {
      const assignment = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=/);
      return !assignment || !names.has(assignment[1]);
    }).join('\n').trimEnd();
    const block = (Object.keys(keys) as Array<keyof EngineeringSettings>).map(key => `ENGINEERING_${keys[key]}=${JSON.stringify(String(next[key]))}`).join('\n');
    const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, `${retained}${retained ? '\n' : ''}${block}\n`, { mode: 0o600 });
    await rename(temporary, target);
    const verified = await readEngineeringSettings();
    if ((Object.keys(keys) as Array<keyof EngineeringSettings>).some(key => verified[key] !== next[key])) throw new EngineeringSettingsStorageError('Після запису .env прочитані значення відрізняються. Перевірте шлях до файлу та спільне сховище застосунку.');
    return verified;
  });
  saving = operation.then(() => {}, () => {});
  return operation;
}
export function publicEngineeringSettings(settings: EngineeringSettings) {
  const { mailPassword, botToken, webhookSecret, runSecret, ...visible } = settings;
  return { ...visible, passwordConfigured: Boolean(mailPassword), tokenConfigured: Boolean(botToken), passwordLast4: Array.from(mailPassword).slice(-4).join(''), tokenLast4: Array.from(botToken).slice(-4).join(''), botUsername: 'engineering_dep_pchilka_bot' };
}
export async function engineeringSettingsStorage() {
  const { filePath, sourcePath, exists } = await readEngineeringEnv();
  return { filePath, sourcePath, exists };
}
