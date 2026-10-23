const { loadEnvConfig } = require('@next/env');
const fs = require('node:fs');
const path = require('node:path');

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

const defaultConnectionFile = path.join(process.cwd(), 'docs', 'підключення до бази.txt');
if (!process.env.MARKETING_SOURCE_CONNECTION_FILE && fs.existsSync(defaultConnectionFile)) {
  process.env.MARKETING_SOURCE_CONNECTION_FILE = defaultConnectionFile;
}
if (!process.env.POS_ARCHIVE_API_URL) {
  process.env.POS_ARCHIVE_API_URL = 'https://test.pchilka-market.ua/api/analytics/pos-archive/ingest';
}
if (!process.env.POS_ARCHIVE_INGEST_SECRET) {
  const dockerEnvPath = path.join(process.cwd(), '.env.docker');
  if (fs.existsSync(dockerEnvPath)) {
    const dockerEnv = fs.readFileSync(dockerEnvPath, 'utf8');
    const secret = dockerEnv.match(/^POS_ARCHIVE_INGEST_SECRET=(.+)$/m)?.[1]
      || dockerEnv.match(/^INVENTORY_NOTIFY_SECRET=(.+)$/m)?.[1];
    if (secret) process.env.POS_ARCHIVE_INGEST_SECRET = secret.trim();
  }
}

import('./scripts/archive-marketing-pos.mjs')
  .then(({ main }) => main())
  .catch((error) => {
    console.error('[pos-archive] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
