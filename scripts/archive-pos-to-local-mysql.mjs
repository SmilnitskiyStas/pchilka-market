import fs from 'node:fs';
import pg from 'pg';
import mysql from 'mysql2/promise';

const ROOT = new URL('..', import.meta.url);
const DAY_MS = 86_400_000;
const BATCH_SIZE = 1_000;

function loadEnv(file) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}
function required(value, name) {
  if (!String(value ?? '').trim()) throw new Error(`${name} is required.`);
  return String(value).trim();
}
function sourceConfig() {
  const text = fs.readFileSync(new URL('../docs/підключення до бази.txt', import.meta.url), 'utf8');
  const hostPort = text.match(/Сервер\s+([^:\s]+):(\d+)/i);
  const user = text.match(/логін:\s*(\S+)/i);
  const password = text.match(/пароль:\s*(\S+)/i);
  const database = text.match(/база:\s*(\S+)/i);
  if (!hostPort || !user || !password || !database) throw new Error('Cannot parse source connection file.');
  return { host: hostPort[1], port: Number(hostPort[2]), user: user[1], password: password[1], database: database[1] };
}
function dateOnly(value) { return new Date(value).toISOString().slice(0, 10); }
function addDays(day, amount) { return dateOnly(new Date(`${day}T12:00:00Z`).getTime() + amount * DAY_MS); }
function args() {
  const from = process.argv.indexOf('--from'); const to = process.argv.indexOf('--to');
  if (from < 0 || to < 0) throw new Error('Use --from YYYY-MM-DD --to YYYY-MM-DD.');
  return { from: process.argv[from + 1], to: process.argv[to + 1] };
}
async function upsert(conn, table, columns, rows, keys) {
  if (!rows.length) return;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const part = rows.slice(offset, offset + BATCH_SIZE);
    const values = part.flatMap((row) => columns.map((column) => row[column] ?? null));
    const marks = part.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const update = columns.filter((column) => !keys.includes(column)).map((column) => `${column}=VALUES(${column})`).join(',');
    await conn.query(`${update ? 'INSERT' : 'INSERT IGNORE'} INTO ${table} (${columns.join(',')}) VALUES ${marks}${update ? ` ON DUPLICATE KEY UPDATE ${update}` : ''}`, values);
  }
}
async function copyReferences(source, target) {
  const references = [
    ['pos_shops', 'SELECT code_shop shop_code,name_shop shop_name,code_dealer dealer_code,sign_activity active FROM pos.shops', ['shop_code','shop_name','dealer_code','active'], ['shop_code']],
    ['pos_warehouses', 'SELECT code_warehouse warehouse_code,name_warehouse warehouse_name FROM pos.warehouse', ['warehouse_code','warehouse_name'], ['warehouse_code']],
    ['pos_shop_warehouses', 'SELECT code_shop shop_code,code_warehouse warehouse_code FROM pos.shop_warehouse', ['shop_code','warehouse_code'], ['shop_code','warehouse_code']],
    ['pos_units', 'SELECT code_unit unit_code,name_unit unit_name,abr_unit unit_abbr,sign_activity active FROM pos.unit_dimension', ['unit_code','unit_name','unit_abbr','active'], ['unit_code']],
    ['pos_product_groups', 'SELECT code_group_wares group_code,code_parent_group_wares parent_group_code,name group_name,sign_activity active FROM pos.group_wares', ['group_code','parent_group_code','group_name','active'], ['group_code']]
  ];
  for (const [table, sql, cols, keys] of references) {
    const result = await source.query(sql);
    await upsert(target, table, cols, result.rows, keys);
    console.log(`[local-pos] references ${table}: ${result.rowCount}`);
  }
  let last = 0;
  while (true) {
    const products = await source.query(`SELECT code_wares product_code,code_group group_code,name_wares product_name,name_wares_receipt receipt_name,artilce article,uktved uktzed,code_unit_basis basis_unit_code,code_default_unit default_unit_code,vat,sign_activity active FROM pos.wares WHERE code_wares > $1 ORDER BY code_wares LIMIT 10000`, [last]);
    if (!products.rowCount) break;
    last = products.rows.at(-1).product_code;
    await upsert(target, 'pos_products', ['product_code','group_code','product_name','receipt_name','article','uktzed','basis_unit_code','default_unit_code','vat','active'], products.rows, ['product_code']);
  }
  last = 0;
  while (true) {
    const barcodes = await source.query(`SELECT code_wares product_code,barcode,code_unit unit_code,sign_activity active FROM pos.barcode_wares WHERE code_wares > $1 ORDER BY code_wares LIMIT 10000`, [last]);
    if (!barcodes.rowCount) break;
    last = barcodes.rows.at(-1).product_code;
    await upsert(target, 'pos_product_barcodes', ['barcode','product_code','unit_code','active'], barcodes.rows, ['barcode','product_code']);
  }
  last = 0;
  while (true) {
    const prices = await source.query(`SELECT code_dealer dealer_code,code_wares product_code,price_dealer dealer_price,indicative_min_price,indicative_max_price,indicative_active,indicative_begin_date,indicative_end_date FROM pos.price_dealer WHERE code_wares > $1 ORDER BY code_wares LIMIT 10000`, [last]);
    if (!prices.rowCount) break;
    last = prices.rows.at(-1).product_code;
    await upsert(target, 'pos_dealer_prices', ['dealer_code','product_code','dealer_price','indicative_min_price','indicative_max_price','indicative_active','indicative_begin_date','indicative_end_date'], prices.rows, ['dealer_code','product_code']);
  }
}
async function copyDay(source, target, day) {
  const done = await target.query('SELECT 1 FROM pos_sync_days WHERE sync_day=?', [day]);
  if (done[0].length) { console.log(`[local-pos] ${day}: already complete`); return; }
  const orders = await source.query(`SELECT code_shop shop_code,id_workplace workplace_id,code_order order_code,date_order ordered_at,date_receipt receipt_at,code_client client_code,code_user user_code,number_receipt receipt_number,number_cash_register cash_register,sum_order order_total,sum_discount discount_total,type_order order_type FROM pos.order_client WHERE date_order >= $1::date AND date_order < $1::date + interval '1 day' ORDER BY code_shop,id_workplace,code_order`, [day]);
  const items = await source.query(`SELECT w.code_shop shop_code,w.id_workplace workplace_id,w.code_order order_code,w.num line_number,w.code_wares product_code,w.code_unit unit_code,w.barcode,w.quantity,w.price unit_price,w.sum_position line_total,w.sum_discount discount_total,w.quantity_ret returned_quantity,w.sum_ret returned_total FROM pos.wares_order w JOIN pos.order_client o USING(code_shop,id_workplace,code_order) WHERE o.date_order >= $1::date AND o.date_order < $1::date + interval '1 day' ORDER BY 1,2,3,4`, [day]);
  const payments = await source.query(`SELECT p.code_shop shop_code,p.id_workplace workplace_id,p.code_order order_code,p.num line_number,(to_jsonb(p)->>'type_payment')::smallint payment_type,(to_jsonb(p)->>'code_currency')::bigint currency_code,COALESCE(to_jsonb(p)->>'sum_payment',to_jsonb(p)->>'sum_pay',to_jsonb(p)->>'sum')::numeric payment_sum,COALESCE(to_jsonb(p)->>'sum_base',to_jsonb(p)->>'sum_main')::numeric base_sum FROM pos.order_pay p JOIN pos.order_client o USING(code_shop,id_workplace,code_order) WHERE o.date_order >= $1::date AND o.date_order < $1::date + interval '1 day' ORDER BY 1,2,3,4`, [day]);
  for (const row of orders.rows) row.order_day = day;
  for (const row of items.rows) row.order_day = day;
  for (const row of payments.rows) row.order_day = day;
  await target.beginTransaction();
  try {
    await upsert(target, 'pos_orders', ['shop_code','workplace_id','order_code','order_day','ordered_at','receipt_at','client_code','user_code','receipt_number','cash_register','order_total','discount_total','order_type'], orders.rows, ['shop_code','workplace_id','order_code']);
    await upsert(target, 'pos_order_items', ['shop_code','workplace_id','order_code','line_number','order_day','product_code','unit_code','barcode','quantity','unit_price','line_total','discount_total','returned_quantity','returned_total'], items.rows, ['shop_code','workplace_id','order_code','line_number']);
    await upsert(target, 'pos_order_payments', ['shop_code','workplace_id','order_code','line_number','order_day','payment_type','currency_code','payment_sum','base_sum'], payments.rows, ['shop_code','workplace_id','order_code','line_number']);
    await target.query('INSERT INTO pos_sync_days(sync_day,orders_count,items_count,payments_count,completed_at) VALUES(?,?,?,?,NOW(6)) ON DUPLICATE KEY UPDATE orders_count=VALUES(orders_count),items_count=VALUES(items_count),payments_count=VALUES(payments_count),completed_at=VALUES(completed_at)', [day, orders.rowCount, items.rowCount, payments.rowCount]);
    await target.commit();
  } catch (error) { await target.rollback(); throw error; }
  console.log(`[local-pos] ${day}: orders=${orders.rowCount}, items=${items.rowCount}, payments=${payments.rowCount}`);
}

loadEnv(new URL('../.env.local-pos-archive', import.meta.url));
const target = await mysql.createConnection({ host: process.env.LOCAL_POS_MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.LOCAL_POS_MYSQL_PORT ?? 3307), user: required(process.env.MYSQL_USER, 'MYSQL_USER'), password: required(process.env.MYSQL_PASSWORD, 'MYSQL_PASSWORD'), database: required(process.env.MYSQL_DATABASE, 'MYSQL_DATABASE'), multipleStatements: false });
const source = new pg.Client({ ...sourceConfig(), application_name: 'pchilka_local_pos_archive', connectionTimeoutMillis: 10_000, statement_timeout: 300_000, options: '-c default_transaction_read_only=on' });
const { from, to } = args();
await source.connect();
try {
  await copyReferences(source, target);
  for (let day = from; day <= to; day = addDays(day, 1)) await copyDay(source, target, day);
} finally { await source.end(); await target.end(); }
