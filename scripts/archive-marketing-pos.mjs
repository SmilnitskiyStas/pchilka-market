import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const DAY_MS = 86_400_000;

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function parseConnectionFile(filePath) {
  if (!filePath) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  const hostPort = text.match(/Сервер\s+([^:\s]+):(\d+)/i);
  return {
    host: hostPort?.[1], port: hostPort?.[2],
    user: text.match(/логін:\s*(\S+)/i)?.[1],
    password: text.match(/пароль:\s*(\S+)/i)?.[1],
    database: text.match(/база:\s*(\S+)/i)?.[1]
  };
}

function dateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(day, amount) {
  return dateOnly(new Date(`${day}T12:00:00Z`).getTime() + amount * DAY_MS);
}

function validateDay(day, name) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`${name} must use YYYY-MM-DD.`);
  return day;
}

function resolveDays() {
  const explicitDate = argValue('--date');
  const timezone = process.env.POS_ARCHIVE_TIMEZONE ?? 'Europe/Kiev';
  const localToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const yesterday = addDays(localToday, -1);
  if (explicitDate) return [validateDay(explicitDate, '--date')];

  const from = argValue('--from');
  const to = argValue('--to');
  const backfillDays = Number(argValue('--backfill-days') ?? 0);
  let first;
  let last;
  if (backfillDays > 0) {
    if (!Number.isSafeInteger(backfillDays) || backfillDays > 4000) throw new Error('--backfill-days must be between 1 and 4000.');
    first = addDays(yesterday, -(backfillDays - 1));
    last = yesterday;
  } else if (from || to) {
    first = validateDay(required(from, '--from'), '--from');
    last = validateDay(required(to, '--to'), '--to');
  } else {
    const retentionDays = Number(process.env.POS_ARCHIVE_SOURCE_RETENTION_DAYS ?? 365);
    const safetyDays = Number(process.env.POS_ARCHIVE_SAFETY_DAYS ?? 7);
    if (!Number.isSafeInteger(retentionDays) || retentionDays < 2) {
      throw new Error('POS_ARCHIVE_SOURCE_RETENTION_DAYS must be at least 2.');
    }
    if (!Number.isSafeInteger(safetyDays) || safetyDays < 1 || safetyDays >= retentionDays) {
      throw new Error('POS_ARCHIVE_SAFETY_DAYS must be between 1 and the retention period.');
    }
    first = addDays(localToday, -(retentionDays - safetyDays));
    last = first;
  }
  if (first > last) throw new Error('--from cannot be after --to.');
  const days = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

function normalizeRow(row, kind, archiveDay) {
  const base = {
    shopCode: row.shop_code,
    workplaceId: row.workplace_id,
    orderCode: row.order_code,
    archiveDay,
    payload: row.payload
  };
  if (kind === 'order') return {
    ...base, orderedAt: row.ordered_at, receiptAt: row.receipt_at,
    clientCode: row.client_code, userCode: row.user_code, receiptNumber: row.receipt_number,
    cashRegister: row.cash_register, orderTotal: row.order_total,
    discountTotal: row.discount_total, orderType: row.order_type
  };
  if (kind === 'item') return {
    ...base, lineNumber: row.line_number, productCode: row.product_code, unitCode: row.unit_code,
    barcode: row.barcode, quantity: row.quantity, unitPrice: row.unit_price, lineTotal: row.line_total,
    discountTotal: row.discount_total, returnedQuantity: row.returned_quantity,
    returnedTotal: row.returned_total
  };
  return {
    ...base, lineNumber: row.line_number, paymentType: row.payment_type,
    currencyCode: row.currency_code, paymentSum: row.payment_sum, baseSum: row.base_sum
  };
}

async function readDay(client, archiveDay) {
  const orders = await client.query(`
    SELECT code_shop::text shop_code, id_workplace::text workplace_id, code_order::text order_code,
      to_char(date_order, 'YYYY-MM-DD HH24:MI:SS.US') ordered_at,
      CASE WHEN date_receipt IS NULL THEN NULL ELSE to_char(date_receipt, 'YYYY-MM-DD HH24:MI:SS.US') END receipt_at,
      code_client::text client_code, code_user::text user_code, number_receipt::text receipt_number,
      number_cash_register cash_register, sum_order::text order_total, sum_discount::text discount_total,
      type_order::text order_type, to_jsonb(o)::text payload
    FROM pos.order_client o
    WHERE date_order >= $1::date AND date_order < $1::date + interval '1 day'
    ORDER BY code_shop, id_workplace, code_order
  `, [archiveDay]);
  const items = await client.query(`
    SELECT w.code_shop::text shop_code, w.id_workplace::text workplace_id, w.code_order::text order_code,
      w.num::text line_number, w.code_wares::text product_code, w.code_unit::text unit_code,
      w.barcode, w.quantity::text quantity, w.price::text unit_price, w.sum_position::text line_total,
      w.sum_discount::text discount_total, w.quantity_ret::text returned_quantity, w.sum_ret::text returned_total,
      to_jsonb(w)::text payload
    FROM pos.wares_order w
    JOIN pos.order_client o USING (code_shop, id_workplace, code_order)
    WHERE o.date_order >= $1::date AND o.date_order < $1::date + interval '1 day'
    ORDER BY w.code_shop, w.id_workplace, w.code_order, w.num
  `, [archiveDay]);
  const payments = await client.query(`
    SELECT p.code_shop::text shop_code, p.id_workplace::text workplace_id, p.code_order::text order_code,
      p.num::text line_number, j.payload->>'type_payment' payment_type,
      COALESCE(j.payload->>'code_currency', j.payload->>'currency') currency_code,
      COALESCE(j.payload->>'sum_payment', j.payload->>'sum_pay', j.payload->>'sum') payment_sum,
      COALESCE(j.payload->>'sum_base', j.payload->>'sum_main') base_sum,
      j.payload::text payload
    FROM pos.order_pay p
    CROSS JOIN LATERAL (SELECT to_jsonb(p) payload) j
    JOIN pos.order_client o USING (code_shop, id_workplace, code_order)
    WHERE o.date_order >= $1::date AND o.date_order < $1::date + interval '1 day'
    ORDER BY p.code_shop, p.id_workplace, p.code_order, p.num
  `, [archiveDay]);
  return {
    orders: orders.rows.map((row) => normalizeRow(row, 'order', archiveDay)),
    items: items.rows.map((row) => normalizeRow(row, 'item', archiveDay)),
    payments: payments.rows.map((row) => normalizeRow(row, 'payment', archiveDay))
  };
}

function orderKey(row) {
  return `${row.shopCode}:${row.workplaceId}:${row.orderCode}`;
}

function groupByOrder(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = orderKey(row);
    const group = grouped.get(key);
    if (group) group.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
}

async function send(apiUrl, secret, payload) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pos-archive-secret': secret },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(Number(process.env.POS_ARCHIVE_HTTP_TIMEOUT_MS ?? 120_000))
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.error || `Archive API returned HTTP ${response.status}.`);
  return result;
}

async function archiveDay(client, config, archiveDay) {
  console.log(`[pos-archive] reading ${archiveDay}...`);
  const data = await readDay(client, archiveDay);
  console.log(`[pos-archive] ${archiveDay}: orders=${data.orders.length}, items=${data.items.length}, payments=${data.payments.length}`);
  if (config.dryRun) return;

  const runId = crypto.randomUUID();
  const batchSize = Number(process.env.POS_ARCHIVE_BATCH_SIZE ?? 100);
  const itemMap = groupByOrder(data.items);
  const paymentMap = groupByOrder(data.payments);
  let batchCount = 0;
  for (let offset = 0; offset < data.orders.length; offset += batchSize) {
    const orders = data.orders.slice(offset, offset + batchSize);
    const keys = orders.map(orderKey);
    await send(config.apiUrl, config.secret, {
      action: 'batch', archiveDay, runId, orders,
      items: keys.flatMap((key) => itemMap.get(key) ?? []),
      payments: keys.flatMap((key) => paymentMap.get(key) ?? [])
    });
    batchCount += 1;
    console.log(`[pos-archive] ${archiveDay}: uploaded batch ${batchCount}/${Math.ceil(data.orders.length / batchSize)}`);
  }
  await send(config.apiUrl, config.secret, {
    action: 'complete', archiveDay, runId,
    orderCount: data.orders.length, itemCount: data.items.length,
    paymentCount: data.payments.length, batchCount
  });
  console.log(`[pos-archive] ${archiveDay}: complete.`);
}

export async function main() {
  const fileConfig = parseConnectionFile(process.env.MARKETING_SOURCE_CONNECTION_FILE);
  const source = {
    host: required(process.env.MARKETING_SOURCE_DB_HOST ?? fileConfig.host, 'MARKETING_SOURCE_DB_HOST'),
    port: Number(process.env.MARKETING_SOURCE_DB_PORT ?? fileConfig.port ?? 5432),
    user: required(process.env.MARKETING_SOURCE_DB_USER ?? fileConfig.user, 'MARKETING_SOURCE_DB_USER'),
    password: required(process.env.MARKETING_SOURCE_DB_PASSWORD ?? fileConfig.password, 'MARKETING_SOURCE_DB_PASSWORD'),
    database: required(process.env.MARKETING_SOURCE_DB_NAME ?? fileConfig.database, 'MARKETING_SOURCE_DB_NAME')
  };
  const dryRun = process.argv.includes('--dry-run');
  const config = {
    dryRun,
    apiUrl: dryRun ? '' : required(process.env.POS_ARCHIVE_API_URL, 'POS_ARCHIVE_API_URL'),
    secret: dryRun ? '' : required(process.env.POS_ARCHIVE_INGEST_SECRET, 'POS_ARCHIVE_INGEST_SECRET')
  };
  const client = new pg.Client({
    ...source,
    application_name: 'pchilka_pos_archive',
    connectionTimeoutMillis: Number(process.env.MARKETING_SOURCE_CONNECT_TIMEOUT_MS ?? 10_000),
    statement_timeout: Number(process.env.MARKETING_SOURCE_STATEMENT_TIMEOUT_MS ?? 300_000),
    options: '-c default_transaction_read_only=on'
  });
  await client.connect();
  try {
    for (const day of resolveDays()) await archiveDay(client, config, day);
  } finally {
    await client.end();
  }
}
