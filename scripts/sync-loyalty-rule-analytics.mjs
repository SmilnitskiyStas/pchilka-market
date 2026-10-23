import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..');
const defaultConfigPath = path.join(root, 'config', 'loyalty-rule-sync.local.json');
const SQL = `SELECT w.code_rule rule_code,w.code_shop shop_code,s.name_shop shop_name,w.id_workplace workplace_id,w.code_order order_code,w.num line_number,to_char(o.date_order,'YYYY-MM-DD HH24:MI:SS.US') ordered_at,CASE WHEN o.date_receipt IS NULL THEN NULL ELSE to_char(o.date_receipt,'YYYY-MM-DD HH24:MI:SS.US') END receipt_at,w.code_wares product_code,p.name_wares product_name,w.barcode,w.quantity,w.price unit_price,w.sum_position line_total,w.sum_discount discount_total FROM pos.wares_order w JOIN pos.order_client o USING(code_shop,id_workplace,code_order) LEFT JOIN pos.wares p ON p.code_wares=w.code_wares LEFT JOIN pos.shops s ON s.code_shop=w.code_shop WHERE w.code_rule=$1 AND o.date_order >= $2::date AND o.date_order < $3::date + interval '1 day' ORDER BY w.code_shop,w.id_workplace,w.code_order,w.num`;

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateBeforeToday(days) {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function mapRow(row) {
  return {
    ruleCode: row.rule_code,
    shopCode: row.shop_code,
    shopName: row.shop_name,
    workplaceId: row.workplace_id,
    orderCode: row.order_code,
    lineNumber: row.line_number,
    orderedAt: row.ordered_at,
    receiptAt: row.receipt_at,
    productCode: row.product_code,
    productName: row.product_name,
    barcode: row.barcode,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    discountTotal: row.discount_total
  };
}

async function appendLog(message) {
  const folder = path.join(root, 'logs');
  await fs.mkdir(folder, { recursive: true });
  await fs.appendFile(path.join(folder, 'loyalty-rule-sync.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
}

async function readConfig(configPath) {
  let raw;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch {
    throw Error(`Не знайдено конфігураційний файл: ${configPath}. Скопіюйте config\\loyalty-rule-sync.json.example як loyalty-rule-sync.local.json і заповніть його.`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Error('Конфігураційний файл містить некоректний JSON.');
  }
}

async function upload(target, rows, batchSize, dryRun) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    if (dryRun) continue;
    const response = await fetch(target.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-loyalty-rule-analytics-secret': target.secret },
      body: JSON.stringify({ rows: batch }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw Error(`Сервер повернув HTTP ${response.status} для пакета ${offset + 1}–${offset + batch.length}.`);
    const result = await response.json().catch(() => null);
    if (!result?.ok) throw Error(`Сервер не підтвердив збереження пакета ${offset + 1}–${offset + batch.length}.`);
  }
}

const configPath = path.resolve(option('--config') || defaultConfigPath);
const dryRun = process.argv.includes('--dry-run');
const config = await readConfig(configPath);
const source = config.sourceDatabase;
const target = config.target;
const rules = option('--rule') ? [Number(option('--rule'))] : config.sync?.rules;
const lookbackDays = Number(config.sync?.lookbackDays ?? 7);
const from = option('--from') || dateBeforeToday(lookbackDays);
const to = option('--to') || dateBeforeToday(0);
const batchSize = Number(config.sync?.batchSize ?? 1000);

if (!source?.host || !source?.user || !source?.database || !target?.url || !target?.secret) throw Error('У конфігурації потрібно вказати sourceDatabase та target.url/target.secret.');
if (!Array.isArray(rules) || !rules.every((rule) => Number.isInteger(rule) && rule > 0)) throw Error('sync.rules має містити номери правил, наприклад [836].');
if (!isDate(from) || !isDate(to)) throw Error('Дати мають бути у форматі YYYY-MM-DD.');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2000) throw Error('sync.batchSize має бути від 1 до 2000.');

const client = new pg.Client({
  host: source.host,
  port: Number(source.port || 5432),
  user: source.user,
  password: source.password,
  database: source.database,
  options: '-c default_transaction_read_only=on'
});

try {
  await client.connect();
  for (const rule of rules) {
    const result = await client.query(SQL, [rule, from, to]);
    const rows = result.rows.map(mapRow);
    await upload(target, rows, batchSize, dryRun);
    const message = `${dryRun ? 'CHECKED' : 'SYNCED'} rule=${rule} period=${from}..${to} lines=${rows.length}`;
    console.log(message);
    await appendLog(message);
  }
} catch (error) {
  const message = `FAILED ${error instanceof Error ? error.message : String(error)}`;
  await appendLog(message).catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
