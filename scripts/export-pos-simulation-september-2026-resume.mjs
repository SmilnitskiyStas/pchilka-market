import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { to as copyTo } from 'pg-copy-streams';

const OUTPUT_DIR = 'D:/PchilkaExports/pos_simulation_2026-09';
const DAYS = Array.from({ length: 30 }, (_, index) => {
  const day = String(index + 1).padStart(2, '0');
  const next = index === 29 ? '2026-10-01' : `2026-09-${String(index + 2).padStart(2, '0')}`;
  return [`2026-09-${day}`, next];
});

function required(value, name) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

function readConnection() {
  const source = fs.readFileSync(path.resolve('docs/підключення до бази.txt'), 'utf8');
  const hostPort = source.match(/Сервер\s+([^:\s]+):(\d+)/i);
  return {
    host: required(hostPort?.[1], 'Source host'), port: Number(required(hostPort?.[2], 'Source port')),
    user: required(source.match(/логін:\s*(\S+)/i)?.[1], 'Source user'),
    password: required(source.match(/пароль:\s*(\S+)/i)?.[1], 'Source password'),
    database: required(source.match(/база:\s*(\S+)/i)?.[1], 'Source database'),
  };
}

async function exportByDay(client, fileName, makeQuery) {
  const target = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(target, '');
  for (let index = 0; index < DAYS.length; index += 1) {
    const [from, to] = DAYS[index];
    console.log(`[export] ${fileName}: ${from}`);
    await pipeline(client.query(copyTo(makeQuery(from, to, index === 0))), fs.createWriteStream(target, { flags: 'a' }));
  }
  const bytes = fs.statSync(target).size;
  console.log(`[export] ${fileName}: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  return { file: fileName, bytes };
}

const options = (header) => `TO STDOUT WITH (FORMAT csv, HEADER ${header ? 'true' : 'false'}, ENCODING 'UTF8')`;

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = new pg.Client({ ...readConnection(), application_name: 'pchilka_pos_simulation_export', connectionTimeoutMillis: 30_000, statement_timeout: 0, options: '-c default_transaction_read_only=on' });
  await client.connect();
  try {
    const files = [{ file: 'receipts.csv', bytes: fs.existsSync(path.join(OUTPUT_DIR, 'receipts.csv')) ? fs.statSync(path.join(OUTPUT_DIR, 'receipts.csv')).size : 0 }];
    files.push(await exportByDay(client, 'receipt_items.csv', (from, to, header) => `COPY (
      SELECT concat(w.code_shop, ':', w.id_workplace, ':', w.code_order) AS receipt_id,
        w.code_shop AS shop_code, w.id_workplace AS workplace_id, w.code_order AS order_code,
        w.num AS line_number, w.code_wares AS product_code, p.name_wares AS product_name,
        w.code_unit AS unit_code, w.barcode, w.quantity, w.price AS unit_price,
        w.sum_position AS line_total, w.sum_discount AS line_discount_total,
        w.quantity_ret AS returned_quantity, w.sum_ret AS returned_total
      FROM pos.wares_order w
      JOIN pos.order_client o USING (code_shop, id_workplace, code_order)
      LEFT JOIN pos.wares p ON p.code_wares = w.code_wares
      WHERE o.date_order >= DATE '${from}' AND o.date_order < DATE '${to}'
      ORDER BY o.date_order, w.code_shop, w.id_workplace, w.code_order, w.num
    ) ${options(header)}`));

    files.push(await exportByDay(client, 'receipt_payments.csv', (from, to, header) => `COPY (
      SELECT concat(p.code_shop, ':', p.id_workplace, ':', p.code_order) AS receipt_id,
        p.code_shop AS shop_code, p.id_workplace AS workplace_id, p.code_order AS order_code,
        p.num AS line_number, j.payload->>'type_payment' AS payment_type,
        COALESCE(j.payload->>'code_currency', j.payload->>'currency') AS currency_code,
        COALESCE(j.payload->>'sum_payment', j.payload->>'sum_pay', j.payload->>'sum') AS payment_sum,
        COALESCE(j.payload->>'sum_base', j.payload->>'sum_main') AS base_sum
      FROM pos.order_pay p
      CROSS JOIN LATERAL (SELECT to_jsonb(p) AS payload) j
      JOIN pos.order_client o USING (code_shop, id_workplace, code_order)
      WHERE o.date_order >= DATE '${from}' AND o.date_order < DATE '${to}'
      ORDER BY o.date_order, p.code_shop, p.id_workplace, p.code_order, p.num
    ) ${options(header)}`));

    files.push(await exportByDay(client, 'cash_events.csv', (from, to, header) => `COPY (
      SELECT concat(a.code_shop, ':', a.id_workplace, ':', a.id_record) AS event_id,
        CASE WHEN a.code_order > 0 THEN concat(a.code_shop, ':', a.id_workplace, ':', a.code_order) ELSE NULL END AS receipt_id,
        a.date_change AS event_at, a.code_shop AS shop_code, s.name_shop AS shop_name,
        a.id_workplace AS workplace_id, a.code_order AS order_code, a.number_receipt AS receipt_number,
        a.id_record AS source_record_id, a.code_event AS event_code, e.name AS event_name,
        a.add_message AS event_message, a.code_wares AS product_code, w.name_wares AS product_name,
        a.code_client AS loyalty_client_code, a.code_user AS cashier_user_code,
        a.quantity, a.code_unit AS unit_code, a.price, a.sum_order AS receipt_total, a.current_weight
      FROM pos.audit a
      LEFT JOIN pos.event e ON e.code_event = a.code_event
      LEFT JOIN pos.wares w ON w.code_wares = a.code_wares
      LEFT JOIN pos.shops s ON s.code_shop = a.code_shop
      WHERE date_trunc('day', a.date_change) >= DATE '${from}' AND date_trunc('day', a.date_change) < DATE '${to}'
      ORDER BY a.date_change, a.code_shop, a.id_workplace, a.id_record
    ) ${options(header)}`));

    fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({ format: 'pchilka-pos-simulation-v1', period: { from: '2026-09-01', toExclusive: '2026-10-01', timezone: 'Europe/Kyiv' }, receiptId: 'shop_code:workplace_id:order_code', files, generatedAt: new Date().toISOString() }, null, 2)}\n`);
    console.log(`[export] complete: ${OUTPUT_DIR}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(`[export] failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
