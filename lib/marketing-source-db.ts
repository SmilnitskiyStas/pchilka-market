import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

type MarketingSourceConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Не налаштовано ${name} для локального маркетингового аналізу.`);
  return normalized;
}

function readConnectionFile(): Partial<MarketingSourceConfig> {
  const connectionFile = process.env.MARKETING_SOURCE_CONNECTION_FILE
    ?? path.join(process.cwd(), 'docs', 'підключення до бази.txt');
  if (!fs.existsSync(connectionFile)) return {};

  const text = fs.readFileSync(connectionFile, 'utf8');
  const hostPort = text.match(/Сервер\s+([^:\s]+):(\d+)/i);
  return {
    host: hostPort?.[1],
    port: hostPort?.[2] ? Number(hostPort[2]) : undefined,
    user: text.match(/логін:\s*(\S+)/i)?.[1],
    password: text.match(/пароль:\s*(\S+)/i)?.[1],
    database: text.match(/база:\s*(\S+)/i)?.[1]
  };
}

export function getMarketingSourceConfig(): MarketingSourceConfig {
  const fileConfig = readConnectionFile();
  return {
    host: required(process.env.MARKETING_SOURCE_DB_HOST ?? fileConfig.host, 'MARKETING_SOURCE_DB_HOST'),
    port: Number(process.env.MARKETING_SOURCE_DB_PORT ?? fileConfig.port ?? 5432),
    user: required(process.env.MARKETING_SOURCE_DB_USER ?? fileConfig.user, 'MARKETING_SOURCE_DB_USER'),
    password: required(process.env.MARKETING_SOURCE_DB_PASSWORD ?? fileConfig.password, 'MARKETING_SOURCE_DB_PASSWORD'),
    database: required(process.env.MARKETING_SOURCE_DB_NAME ?? fileConfig.database, 'MARKETING_SOURCE_DB_NAME')
  };
}

export async function withMarketingSource<T>(callback: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    ...getMarketingSourceConfig(),
    application_name: 'pchilka_marketing_rfm',
    connectionTimeoutMillis: Number(process.env.MARKETING_SOURCE_CONNECT_TIMEOUT_MS ?? 10_000),
    statement_timeout: Number(process.env.MARKETING_SOURCE_STATEMENT_TIMEOUT_MS ?? 180_000),
    options: '-c default_transaction_read_only=on'
  });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}
