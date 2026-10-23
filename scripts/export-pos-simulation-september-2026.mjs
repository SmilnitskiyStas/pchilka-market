import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { to as copyTo } from 'pg-copy-streams';

const FROM = '2026-09-01';
const TO = '2026-10-01';
const OUTPUT_DIR = 'D:/PchilkaExports/pos_simulation_2026-09';

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function readConnection() {
  const source = fs.readFileSync(path.resolve('docs/підключення до бази.txt'), 'utf8');
  const hostPort = source.match(/Сервер\s+([^:\s]+):(\d+)/i);
  return {
    host: required(hostPort?.[1], 'Source host'),
    port: Number(required(hostPort?.[2], 'Source port')),
    user: required(source.match(/логін:\s*(\S+)/i)?.[1], 'Source user'),
    password: required(source.match(/пароль:\s*(\S+)/i)?.[1], 'Source password'),
    database: required(source.match(/база:\s*(\S+)/i)?.[1], 'Source database'),
  };
}

async function exportCsv(client, name, query) {
  const target = path.join(OUTPUT_DIR, name);
  console.log(`[export] ${name}...`);
  await pipeline(client.query(copyTo(query)), fs.createWriteStream(target, { encoding: 'utf8' }));
  const bytes = fs.statSync(target).size;
  console.log(`[export] ${name}: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  return { file: name, bytes };
}

const receiptId = "concat(o.code_shop, ':', o.id_workplace, ':', o.code_order)";

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const client = new pg.Client({
    ...readConnection(),
    application_name: 'pchilka_pos_simulation_export',
    connectionTimeoutMillis: 30_000,
    statement_timeout: 0,
    options: '-c default_transaction_read_only=on',
  });

  await client.connect();
  try {
    const files = [];
    files.push(await exportCsv(client, 'receipts.csv', `COPY (
      SELECT ${receiptId} AS receipt_id, o.code_shop AS shop_code, s.name_shop AS shop_name,
        o.id_workplace AS workplace_id, o.code_order AS order_code, o.number_receipt AS receipt_number,
        o.date_order AS ordered_at, o.date_receipt AS receipt_at, o.code_client AS loyalty_client_code,
        o.code_user AS cashier_user_code, o.number_cash_register AS cash_register_number,
        o.sum_order AS receipt_total, o.sum_discount AS receipt_discount_total, o.type_order AS order_type
      FROM pos.order_client o
      LEFT JOIN pos.shops s ON s.code_shop = o.code_shop
      WHERE o.date_order >= DATE '${FROM}' AND o.date_order < DATE '${TO}'
      ORDER BY o.date_order, o.code_shop, o.id_workplace, o.code_order
    ) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')`));

    files.push(await exportCsv(client, 'receipt_items.csv', `COPY (
      SELECT concat(w.code_shop, ':', w.id_workplace, ':', w.code_order) AS receipt_id,
        w.code_shop AS shop_code, w.id_workplace AS workplace_id, w.code_order AS order_code,
        w.num AS line_number, w.code_wares AS product_code, p.name_wares AS product_name,
        w.code_unit AS unit_code, w.barcode, w.quantity, w.price AS unit_price,
        w.sum_position AS line_total, w.sum_discount AS line_discount_total,
        w.quantity_ret AS returned_quantity, w.sum_ret AS returned_total
      FROM pos.wares_order w
      JOIN pos.order_client o USING (code_shop, id_workplace, code_order)
      LEFT JOIN pos.wares p ON p.code_wares = w.code_wares
      WHERE o.date_order >= DATE '${FROM}' AND o.date_order < DATE '${TO}'
      ORDER BY o.date_order, w.code_shop, w.id_workplace, w.code_order, w.num
    ) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')`));

    files.push(await exportCsv(client, 'receipt_payments.csv', `COPY (
      SELECT concat(p.code_shop, ':', p.id_workplace, ':', p.code_order) AS receipt_id,
        p.code_shop AS shop_code, p.id_workplace AS workplace_id, p.code_order AS order_code,
        p.num AS line_number, j.payload->>'type_payment' AS payment_type,
        COALESCE(j.payload->>'code_currency', j.payload->>'currency') AS currency_code,
        COALESCE(j.payload->>'sum_payment', j.payload->>'sum_pay', j.payload->>'sum') AS payment_sum,
        COALESCE(j.payload->>'sum_base', j.payload->>'sum_main') AS base_sum
      FROM pos.order_pay p
      CROSS JOIN LATERAL (SELECT to_jsonb(p) AS payload) j
      JOIN pos.order_client o USING (code_shop, id_workplace, code_order)
      WHERE o.date_order >= DATE '${FROM}' AND o.date_order < DATE '${TO}'
      ORDER BY o.date_order, p.code_shop, p.id_workplace, p.code_order, p.num
    ) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')`));

    files.push(await exportCsv(client, 'cash_events.csv', `COPY (
      SELECT concat(a.code_shop, ':', a.id_workplace, ':', a.id_record) AS event_id,
        CASE WHEN a.code_order > 0 THEN concat(a.code_shop, ':', a.id_workplace, ':', a.code_order) ELSE NULL END AS receipt_id,
        a.date_change AS event_at, a.code_shop AS shop_code, s.name_shop AS shop_name,
        a.id_workplace AS workplace_id, a.code_order AS order_code, a.number_receipt AS receipt_number,
        a.id_record AS source_record_id, a.code_event AS event_code, e.name AS event_name,
        a.add_message AS event_message, a.code_wares AS product_code, w.name_wares AS product_name,
        a.code_client AS loyalty_client_code, a.code_user AS cashier_user_code,
        a.quantity, a.code_unit AS unit_code, a.price, a.sum_order AS receipt_total,
        a.current_weight
      FROM pos.audit a
      LEFT JOIN pos.event e ON e.code_event = a.code_event
      LEFT JOIN pos.wares w ON w.code_wares = a.code_wares
      LEFT JOIN pos.shops s ON s.code_shop = a.code_shop
      WHERE date_trunc('day', a.date_change) >= DATE '${FROM}'
        AND date_trunc('day', a.date_change) < DATE '${TO}'
      ORDER BY a.date_change, a.code_shop, a.id_workplace, a.id_record
    ) TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')`));

    const manifest = {
      format: 'pchilka-pos-simulation-v1',
      period: { from: FROM, toExclusive: TO, timezone: 'Europe/Kyiv' },
      generatedAt: new Date().toISOString(),
      receiptId: 'shop_code:workplace_id:order_code',
      files,
      notes: [
        'receipts.csv is the receipt header table.',
        'receipt_items.csv and receipt_payments.csv link to receipts.csv through receipt_id.',
        'cash_events.csv contains the chronological audit trail of POS actions and can link to a receipt when order_code is available.',
      ],
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[export] complete: ${OUTPUT_DIR}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[export] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
