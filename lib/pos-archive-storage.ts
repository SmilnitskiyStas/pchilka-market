import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type PosArchiveOrder = {
  shopCode: string;
  workplaceId: string;
  orderCode: string;
  archiveDay: string;
  orderedAt: string;
  receiptAt: string | null;
  clientCode: string | null;
  userCode: string | null;
  receiptNumber: string | null;
  cashRegister: string | null;
  orderTotal: string | null;
  discountTotal: string | null;
  orderType: string | null;
  payload: string;
};

export type PosArchiveItem = {
  shopCode: string;
  workplaceId: string;
  orderCode: string;
  lineNumber: string;
  archiveDay: string;
  productCode: string | null;
  unitCode: string | null;
  barcode: string | null;
  quantity: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  discountTotal: string | null;
  returnedQuantity: string | null;
  returnedTotal: string | null;
  payload: string;
};

export type PosArchivePayment = {
  shopCode: string;
  workplaceId: string;
  orderCode: string;
  lineNumber: string;
  archiveDay: string;
  paymentType: string | null;
  currencyCode: string | null;
  paymentSum: string | null;
  baseSum: string | null;
  payload: string;
};

export type PosArchiveBatch = {
  action: 'batch';
  archiveDay: string;
  runId: string;
  orders: PosArchiveOrder[];
  items: PosArchiveItem[];
  payments: PosArchivePayment[];
};

export type PosArchiveCompletion = {
  action: 'complete';
  archiveDay: string;
  runId: string;
  orderCount: number;
  itemCount: number;
  paymentCount: number;
  batchCount: number;
};

let schemaPromise: Promise<void> | undefined;

export function ensurePosArchiveSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = getDbPool();
      await pool.query(`CREATE TABLE IF NOT EXISTS pos_archive_orders (
        source_shop_code INT NOT NULL, source_workplace_id INT NOT NULL, source_order_code BIGINT NOT NULL,
        archive_day DATE NOT NULL, ordered_at DATETIME(6) NOT NULL, receipt_at DATETIME(6) NULL,
        source_client_code BIGINT NULL, source_user_code BIGINT NULL, receipt_number BIGINT NULL,
        cash_register VARCHAR(120) NULL, order_total DECIMAL(20,4) NULL, discount_total DECIMAL(20,4) NULL,
        order_type SMALLINT NULL, source_payload JSON NOT NULL,
        archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (source_shop_code, source_workplace_id, source_order_code),
        KEY idx_pos_archive_orders_day (archive_day),
        KEY idx_pos_archive_orders_client_date (source_client_code, ordered_at),
        KEY idx_pos_archive_orders_ordered_at (ordered_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS pos_archive_order_items (
        source_shop_code INT NOT NULL, source_workplace_id INT NOT NULL, source_order_code BIGINT NOT NULL,
        line_number INT NOT NULL, archive_day DATE NOT NULL, source_product_code BIGINT NULL,
        source_unit_code BIGINT NULL, barcode VARCHAR(255) NULL, quantity DECIMAL(20,6) NULL,
        unit_price DECIMAL(20,4) NULL, line_total DECIMAL(20,4) NULL, discount_total DECIMAL(20,4) NULL,
        returned_quantity DECIMAL(20,6) NULL, returned_total DECIMAL(20,4) NULL, source_payload JSON NOT NULL,
        archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (source_shop_code, source_workplace_id, source_order_code, line_number),
        KEY idx_pos_archive_items_day (archive_day), KEY idx_pos_archive_items_product_day (source_product_code, archive_day),
        CONSTRAINT fk_pos_archive_items_order FOREIGN KEY (source_shop_code, source_workplace_id, source_order_code)
          REFERENCES pos_archive_orders (source_shop_code, source_workplace_id, source_order_code)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS pos_archive_order_payments (
        source_shop_code INT NOT NULL, source_workplace_id INT NOT NULL, source_order_code BIGINT NOT NULL,
        line_number INT NOT NULL, archive_day DATE NOT NULL, payment_type SMALLINT NULL, currency_code BIGINT NULL,
        payment_sum DECIMAL(20,4) NULL, base_sum DECIMAL(20,4) NULL, source_payload JSON NOT NULL,
        archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (source_shop_code, source_workplace_id, source_order_code, line_number),
        KEY idx_pos_archive_payments_day (archive_day),
        CONSTRAINT fk_pos_archive_payments_order FOREIGN KEY (source_shop_code, source_workplace_id, source_order_code)
          REFERENCES pos_archive_orders (source_shop_code, source_workplace_id, source_order_code)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS pos_archive_days (
        archive_day DATE NOT NULL, source_order_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        source_item_count BIGINT UNSIGNED NOT NULL DEFAULT 0, source_payment_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        batch_count INT UNSIGNED NOT NULL DEFAULT 0, run_id VARCHAR(80) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'complete', completed_at DATETIME(6) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (archive_day), KEY idx_pos_archive_days_status (status, archive_day)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function values<T>(rows: T[], mapper: (row: T) => unknown[]): unknown[][] {
  return rows.map(mapper);
}

async function replaceOrderChildren(connection: PoolConnection, batch: PosArchiveBatch) {
  const keys = batch.orders.map((order) => [order.shopCode, order.workplaceId, order.orderCode]);
  if (keys.length === 0) return;
  const placeholders = keys.map(() => '(?, ?, ?)').join(',');
  const params = keys.flat();
  await connection.query(
    `DELETE FROM pos_archive_order_items WHERE (source_shop_code, source_workplace_id, source_order_code) IN (${placeholders})`,
    params
  );
  await connection.query(
    `DELETE FROM pos_archive_order_payments WHERE (source_shop_code, source_workplace_id, source_order_code) IN (${placeholders})`,
    params
  );
}

export async function storePosArchiveBatch(batch: PosArchiveBatch) {
  await ensurePosArchiveSchema();
  const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction();
    if (batch.orders.length > 0) {
      await connection.query(
        `INSERT INTO pos_archive_orders
          (source_shop_code, source_workplace_id, source_order_code, archive_day, ordered_at, receipt_at,
           source_client_code, source_user_code, receipt_number, cash_register, order_total, discount_total,
           order_type, source_payload)
         VALUES ? AS incoming
         ON DUPLICATE KEY UPDATE archive_day=incoming.archive_day, ordered_at=incoming.ordered_at,
           receipt_at=incoming.receipt_at, source_client_code=incoming.source_client_code,
           source_user_code=incoming.source_user_code, receipt_number=incoming.receipt_number,
           cash_register=incoming.cash_register, order_total=incoming.order_total,
           discount_total=incoming.discount_total, order_type=incoming.order_type,
           source_payload=incoming.source_payload`,
        [values(batch.orders, (o) => [o.shopCode, o.workplaceId, o.orderCode, o.archiveDay, o.orderedAt, o.receiptAt,
          o.clientCode, o.userCode, o.receiptNumber, o.cashRegister, o.orderTotal, o.discountTotal, o.orderType, o.payload])]
      );
      await replaceOrderChildren(connection, batch);
    }
    if (batch.items.length > 0) {
      await connection.query(
        `INSERT INTO pos_archive_order_items
          (source_shop_code, source_workplace_id, source_order_code, line_number, archive_day,
           source_product_code, source_unit_code, barcode, quantity, unit_price, line_total, discount_total,
           returned_quantity, returned_total, source_payload) VALUES ?`,
        [values(batch.items, (i) => [i.shopCode, i.workplaceId, i.orderCode, i.lineNumber, i.archiveDay,
          i.productCode, i.unitCode, i.barcode, i.quantity, i.unitPrice, i.lineTotal, i.discountTotal,
          i.returnedQuantity, i.returnedTotal, i.payload])]
      );
    }
    if (batch.payments.length > 0) {
      await connection.query(
        `INSERT INTO pos_archive_order_payments
          (source_shop_code, source_workplace_id, source_order_code, line_number, archive_day,
           payment_type, currency_code, payment_sum, base_sum, source_payload) VALUES ?`,
        [values(batch.payments, (p) => [p.shopCode, p.workplaceId, p.orderCode, p.lineNumber, p.archiveDay,
          p.paymentType, p.currencyCode, p.paymentSum, p.baseSum, p.payload])]
      );
    }
    await connection.commit();
    return { orders: batch.orders.length, items: batch.items.length, payments: batch.payments.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function completePosArchiveDay(completion: PosArchiveCompletion) {
  await ensurePosArchiveSchema();
  const [result] = await getDbPool().execute<ResultSetHeader>(
    `INSERT INTO pos_archive_days
       (archive_day, source_order_count, source_item_count, source_payment_count, batch_count, run_id, status, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'complete', NOW(6)) AS incoming
     ON DUPLICATE KEY UPDATE source_order_count=incoming.source_order_count,
       source_item_count=incoming.source_item_count, source_payment_count=incoming.source_payment_count,
       batch_count=incoming.batch_count, run_id=incoming.run_id, status='complete', completed_at=NOW(6)`,
    [completion.archiveDay, completion.orderCount, completion.itemCount, completion.paymentCount,
      completion.batchCount, completion.runId]
  );
  return { affectedRows: result.affectedRows };
}
