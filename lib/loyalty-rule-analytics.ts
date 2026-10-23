import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export type RuleDiscountLine = { ruleCode:number; shopCode:string; shopName:string|null; workplaceId:string; orderCode:string; lineNumber:string; orderedAt:string; receiptAt:string|null; productCode:string; productName:string|null; barcode:string|null; quantity:string; unitPrice:string; lineTotal:string; discountTotal:string };
let schema: Promise<void> | undefined;

export function ensureLoyaltyRuleAnalyticsSchema() {
  if (!schema) schema = getDbPool().query(`CREATE TABLE IF NOT EXISTS loyalty_rule_discount_lines (
    rule_code INT NOT NULL, shop_code INT NOT NULL, workplace_id INT NOT NULL, order_code BIGINT NOT NULL, line_number INT NOT NULL,
    ordered_at DATETIME(6) NOT NULL, receipt_at DATETIME(6) NULL, shop_name VARCHAR(255) NULL, product_code BIGINT NOT NULL,
    product_name VARCHAR(500) NULL, barcode VARCHAR(255) NULL, quantity DECIMAL(20,6) NOT NULL, unit_price DECIMAL(20,4) NOT NULL,
    line_total DECIMAL(20,4) NOT NULL, discount_total DECIMAL(20,4) NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(rule_code,shop_code,workplace_id,order_code,line_number), KEY idx_rule_date_store(rule_code,ordered_at,shop_code), KEY idx_rule_product(rule_code,product_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).then(() => undefined).catch(e => { schema=undefined; throw e; });
  return schema;
}

export async function ingestRuleDiscountLines(rows: RuleDiscountLine[]) {
  await ensureLoyaltyRuleAnalyticsSchema(); if (!rows.length) return 0;
  const values=rows.map(r=>[r.ruleCode,r.shopCode,r.workplaceId,r.orderCode,r.lineNumber,r.orderedAt,r.receiptAt,r.shopName,r.productCode,r.productName,r.barcode,r.quantity,r.unitPrice,r.lineTotal,r.discountTotal]);
  await getDbPool().query(`INSERT INTO loyalty_rule_discount_lines (rule_code,shop_code,workplace_id,order_code,line_number,ordered_at,receipt_at,shop_name,product_code,product_name,barcode,quantity,unit_price,line_total,discount_total) VALUES ? ON DUPLICATE KEY UPDATE ordered_at=VALUES(ordered_at),receipt_at=VALUES(receipt_at),shop_name=VALUES(shop_name),product_name=VALUES(product_name),barcode=VALUES(barcode),quantity=VALUES(quantity),unit_price=VALUES(unit_price),line_total=VALUES(line_total),discount_total=VALUES(discount_total)`,[values]);
  return rows.length;
}

const date=(v: unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';
export async function ruleAnalytics(ruleCode:number, from?:string|null, to?:string|null, store?:string|null) {
  await ensureLoyaltyRuleAnalyticsSchema(); const f=date(from),t=date(to),shop=Number(store); const where=['rule_code=?']; const p: unknown[]=[ruleCode]; if(f){where.push('ordered_at>=?');p.push(`${f} 00:00:00`)} if(t){where.push('ordered_at<?');p.push(`${t} 23:59:59.999999`)} if(Number.isInteger(shop)&&shop>0){where.push('shop_code=?');p.push(shop)} const w=where.join(' AND ');
  const pool=getDbPool(); const [summary,stores,products,days]=await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT COUNT(DISTINCT CONCAT(shop_code,':',workplace_id,':',order_code)) orders,COUNT(*) lineCount,SUM(quantity) units,SUM(discount_total) discountTotal,MIN(ordered_at) firstAt,MAX(ordered_at) lastAt FROM loyalty_rule_discount_lines WHERE ${w}`,p),
    pool.query<RowDataPacket[]>(`SELECT shop_code shopCode,MAX(shop_name) shopName,COUNT(DISTINCT CONCAT(workplace_id,':',order_code)) orders,COUNT(*) lineCount,SUM(quantity) units,SUM(discount_total) discountTotal FROM loyalty_rule_discount_lines WHERE ${w} GROUP BY shop_code ORDER BY discountTotal DESC`,p),
    pool.query<RowDataPacket[]>(`SELECT product_code productCode,MAX(product_name) productName,MAX(barcode) barcode,COUNT(*) lineCount,SUM(quantity) units,SUM(discount_total) discountTotal FROM loyalty_rule_discount_lines WHERE ${w} GROUP BY product_code ORDER BY discountTotal DESC LIMIT 100`,p),
    pool.query<RowDataPacket[]>(`SELECT DATE(ordered_at) day,COUNT(DISTINCT CONCAT(shop_code,':',workplace_id,':',order_code)) orders,SUM(discount_total) discountTotal FROM loyalty_rule_discount_lines WHERE ${w} GROUP BY DATE(ordered_at) ORDER BY day DESC`,p)
  ]); return {summary:summary[0][0],stores:stores[0],products:products[0],days:days[0]};
}
