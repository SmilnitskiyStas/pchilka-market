import type { RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';
import {
  INVENTORY_REQUIRED_PRODUCT_BATCH_COLUMNS,
  INVENTORY_REQUIRED_TABLES,
  type InventoryReadiness
} from '@/lib/inventory-schema';

type ShowTablesRow = RowDataPacket & Record<string, string>;
type ShowColumnsRow = RowDataPacket & {
  Field: string;
};
type ShowIndexesRow = RowDataPacket & {
  Key_name: string;
};
type ReferentialConstraintRow = RowDataPacket & {
  CONSTRAINT_NAME: string;
};

function extractTableName(row: ShowTablesRow): string {
  const value = Object.values(row)[0];
  return typeof value === 'string' ? value : '';
}

export async function getInventoryReadinessFromDb(): Promise<InventoryReadiness> {
  const pool = getDbPool();
  const [tableRows] = await pool.query<ShowTablesRow[]>('SHOW TABLES');
  const existingTables = new Set(tableRows.map(extractTableName));

  const tables = INVENTORY_REQUIRED_TABLES.map((name) => ({
    name,
    exists: existingTables.has(name)
  }));

  const productBatchesExists = existingTables.has('product_batches');
  let missingColumns: string[] = [];

  if (productBatchesExists) {
    const [columnRows] = await pool.query<ShowColumnsRow[]>('SHOW COLUMNS FROM product_batches');
    const columnNames = new Set(columnRows.map((row) => row.Field));
    missingColumns = INVENTORY_REQUIRED_PRODUCT_BATCH_COLUMNS.filter((column) => !columnNames.has(column));
  }

  return {
    checkedAt: new Date().toISOString(),
    allRequiredTablesPresent: tables.every((table) => table.exists),
    tables,
    productBatches: {
      checked: productBatchesExists,
      missingColumns
    }
  };
}

async function listTableColumns(tableName: string): Promise<Set<string>> {
  const pool = getDbPool();
  const [rows] = await pool.query<ShowColumnsRow[]>(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
}

async function listTableIndexes(tableName: string): Promise<Set<string>> {
  const pool = getDbPool();
  const [rows] = await pool.query<ShowIndexesRow[]>(`SHOW INDEX FROM ${tableName}`);
  return new Set(rows.map((row) => row.Key_name));
}

async function listTableConstraints(tableName: string): Promise<Set<string>> {
  const pool = getDbPool();
  const [rows] = await pool.query<ReferentialConstraintRow[]>(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );
  return new Set(rows.map((row) => row.CONSTRAINT_NAME));
}

async function ensureProductBatchesWorkflowColumns() {
  const pool = getDbPool();
  const columns = await listTableColumns('product_batches');
  const indexes = await listTableIndexes('product_batches');
  const constraints = await listTableConstraints('product_batches');

  const statements: string[] = [];

  if (!columns.has('discussion_required')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN discussion_required TINYINT(1) NOT NULL DEFAULT 0 AFTER action_note');
  }
  if (!columns.has('responsible_user_id')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN responsible_user_id BIGINT UNSIGNED NULL AFTER action_note');
  }
  if (!columns.has('batch_code')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN batch_code VARCHAR(120) NULL AFTER store_id');
  }
  if (!columns.has('quantity_received')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN quantity_received INT NOT NULL DEFAULT 0 AFTER quantity');
  }
  if (!columns.has('quantity_current')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN quantity_current INT NOT NULL DEFAULT 0 AFTER quantity_received');
  }
  if (!columns.has('batch_status')) {
    statements.push("ALTER TABLE product_batches ADD COLUMN batch_status VARCHAR(40) NOT NULL DEFAULT 'active' AFTER quantity_current");
  }
  if (!columns.has('discussion_note')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN discussion_note TEXT NULL AFTER discussion_required');
  }
  if (!columns.has('discussion_requested_by_user_id')) {
    statements.push(
      'ALTER TABLE product_batches ADD COLUMN discussion_requested_by_user_id BIGINT UNSIGNED NULL AFTER discussion_note'
    );
  }
  if (!columns.has('discussion_requested_at')) {
    statements.push(
      'ALTER TABLE product_batches ADD COLUMN discussion_requested_at DATETIME NULL AFTER discussion_requested_by_user_id'
    );
  }
  if (!columns.has('admin_decision')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN admin_decision VARCHAR(50) NULL AFTER discussion_requested_at');
  }
  if (!columns.has('admin_decision_note')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN admin_decision_note TEXT NULL AFTER admin_decision');
  }
  if (!columns.has('admin_decision_by_user_id')) {
    statements.push(
      'ALTER TABLE product_batches ADD COLUMN admin_decision_by_user_id BIGINT UNSIGNED NULL AFTER admin_decision_note'
    );
  }
  if (!columns.has('admin_decision_at')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN admin_decision_at DATETIME NULL AFTER admin_decision_by_user_id');
  }

  for (const statement of statements) {
    await pool.query(statement);
  }

  const refreshedColumns = await listTableColumns('product_batches');
  if (refreshedColumns.has('quantity_received')) {
    await pool.query(`
      UPDATE product_batches
      SET quantity_received = CASE
        WHEN quantity_received <= 0 THEN quantity
        ELSE quantity_received
      END
    `);
  }
  if (refreshedColumns.has('quantity_current')) {
    await pool.query(`
      UPDATE product_batches
      SET quantity_current = CASE
        WHEN quantity_current < 0 THEN 0
        WHEN quantity_current = 0 AND quantity > 0 THEN quantity
        ELSE quantity_current
      END
    `);
  }
  if (refreshedColumns.has('quantity_current')) {
    await pool.query('UPDATE product_batches SET quantity = quantity_current WHERE quantity <> quantity_current');
  }

  const refreshedIndexes = await listTableIndexes('product_batches');
  const refreshedConstraints = await listTableConstraints('product_batches');

  if (!refreshedIndexes.has('idx_product_batches_discussion_required')) {
    await pool.query('ALTER TABLE product_batches ADD KEY idx_product_batches_discussion_required (discussion_required)');
  }
  if (!refreshedIndexes.has('idx_product_batches_batch_status')) {
    await pool.query('ALTER TABLE product_batches ADD KEY idx_product_batches_batch_status (batch_status)');
  }
  if (!refreshedIndexes.has('idx_product_batches_responsible_user')) {
    await pool.query('ALTER TABLE product_batches ADD KEY idx_product_batches_responsible_user (responsible_user_id)');
  }
  if (!refreshedIndexes.has('idx_product_batches_discussion_requested_by_user')) {
    await pool.query(
      'ALTER TABLE product_batches ADD KEY idx_product_batches_discussion_requested_by_user (discussion_requested_by_user_id)'
    );
  }
  if (!refreshedIndexes.has('idx_product_batches_admin_decision_by_user')) {
    await pool.query(
      'ALTER TABLE product_batches ADD KEY idx_product_batches_admin_decision_by_user (admin_decision_by_user_id)'
    );
  }

  if (!refreshedConstraints.has('fk_product_batches_discussion_requested_by_user')) {
    await pool.query(
      `
        ALTER TABLE product_batches
        ADD CONSTRAINT fk_product_batches_discussion_requested_by_user
        FOREIGN KEY (discussion_requested_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `
    );
  }
  if (!refreshedConstraints.has('fk_product_batches_responsible_user')) {
    await pool.query(
      `
        ALTER TABLE product_batches
        ADD CONSTRAINT fk_product_batches_responsible_user
        FOREIGN KEY (responsible_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `
    );
  }
  if (!refreshedConstraints.has('fk_product_batches_admin_decision_by_user')) {
    await pool.query(
      `
        ALTER TABLE product_batches
        ADD CONSTRAINT fk_product_batches_admin_decision_by_user
        FOREIGN KEY (admin_decision_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `
    );
  }
}

async function ensureBatchSalesTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_sales (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      sold_quantity INT NOT NULL DEFAULT 0,
      sale_source VARCHAR(80) NOT NULL DEFAULT 'manual',
      external_sale_id VARCHAR(120) NULL,
      sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_batch_sales_batch (batch_id),
      KEY idx_batch_sales_product (product_id),
      KEY idx_batch_sales_store (store_id),
      KEY idx_batch_sales_sold_at (sold_at),
      CONSTRAINT fk_batch_sales_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_sales_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_sales_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureBatchChecksTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_checks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(50) NOT NULL,
      counted_quantity INT NULL,
      item_condition VARCHAR(50) NULL,
      issue_reason VARCHAR(80) NULL,
      note TEXT NULL,
      photo_url VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_batch_checks_batch (batch_id),
      KEY idx_batch_checks_product (product_id),
      KEY idx_batch_checks_store (store_id),
      KEY idx_batch_checks_user (user_id),
      KEY idx_batch_checks_action_created_at (action, created_at),
      CONSTRAINT fk_batch_checks_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_checks_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_checks_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_checks_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureNotificationLogsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id BIGINT UNSIGNED NULL,
      product_id BIGINT UNSIGNED NULL,
      store_id BIGINT UNSIGNED NULL,
      user_id BIGINT UNSIGNED NULL,
      notification_type VARCHAR(80) NOT NULL,
      message_text TEXT NOT NULL,
      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notification_logs_batch (batch_id),
      KEY idx_notification_logs_product (product_id),
      KEY idx_notification_logs_store (store_id),
      KEY idx_notification_logs_user (user_id),
      KEY idx_notification_logs_type_sent_at (notification_type, sent_at),
      CONSTRAINT fk_notification_logs_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_notification_logs_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_notification_logs_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_notification_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureProductChangeLogsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_change_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id BIGINT UNSIGNED NOT NULL,
      field_name VARCHAR(80) NOT NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      change_source VARCHAR(80) NOT NULL,
      changed_by VARCHAR(120) NULL,
      change_note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_product_change_logs_product (product_id),
      KEY idx_product_change_logs_field (field_name),
      KEY idx_product_change_logs_source_created_at (change_source, created_at),
      CONSTRAINT fk_product_change_logs_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureProductImportReviewQueueTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_import_review_queue (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id BIGINT UNSIGNED NULL,
      article VARCHAR(120) NULL,
      product_name VARCHAR(255) NULL,
      existing_barcode VARCHAR(120) NULL,
      incoming_barcode VARCHAR(120) NULL,
      issue_type VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      note TEXT NULL,
      resolved_note TEXT NULL,
      resolved_by VARCHAR(120) NULL,
      resolved_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_product_import_review_status (status),
      KEY idx_product_import_review_product (product_id),
      KEY idx_product_import_review_issue (issue_type),
      CONSTRAINT fk_product_import_review_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureProductsDefaultNotifyColumn() {
  const pool = getDbPool();
  const columns = await listTableColumns('products');
  if (!columns.has('notified_days_default')) {
    await pool.query('ALTER TABLE products ADD COLUMN notified_days_default INT NOT NULL DEFAULT 7 AFTER category');
  }
}

async function ensureProductsDefaultUnitsColumn() {
  const pool = getDbPool();
  const columns = await listTableColumns('products');
  if (!columns.has('default_units_of_measurement')) {
    await pool.query(
      'ALTER TABLE products ADD COLUMN default_units_of_measurement VARCHAR(50) NULL AFTER category'
    );
  }
}

async function ensureProductBarcodesTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_barcodes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id BIGINT UNSIGNED NOT NULL,
      barcode VARCHAR(120) NOT NULL,
      units_of_measurement VARCHAR(50) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_product_barcodes_barcode (barcode),
      KEY idx_product_barcodes_product (product_id),
      CONSTRAINT fk_product_barcodes_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const columns = await listTableColumns('product_barcodes');
  if (!columns.has('units_of_measurement')) {
    await pool.query('ALTER TABLE product_barcodes ADD COLUMN units_of_measurement VARCHAR(50) NULL AFTER barcode');
  }

  const productColumns = await listTableColumns('products');
  const hasLegacyBarcodeColumn = productColumns.has('barcode');
  const hasLegacyUnitsColumn = productColumns.has('units_of_measurement');

  if (productColumns.has('default_units_of_measurement') && hasLegacyUnitsColumn) {
    await pool.query(`
      UPDATE products
      SET default_units_of_measurement = NULLIF(TRIM(COALESCE(units_of_measurement, '')), '')
      WHERE (default_units_of_measurement IS NULL OR TRIM(default_units_of_measurement) = '')
        AND TRIM(COALESCE(units_of_measurement, '')) <> ''
    `);
  }

  if (hasLegacyBarcodeColumn) {
    await pool.query(`
      INSERT INTO product_barcodes (product_id, barcode, units_of_measurement)
      SELECT
        p.id,
        TRIM(p.barcode),
        ${hasLegacyUnitsColumn ? "NULLIF(TRIM(COALESCE(p.units_of_measurement, '')), '')" : 'NULL'}
      FROM products p
      WHERE TRIM(COALESCE(p.barcode, '')) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM product_barcodes pb
          WHERE pb.barcode = TRIM(p.barcode)
        )
    `);
  }

  if (hasLegacyUnitsColumn) {
    await pool.query(`
      UPDATE product_barcodes pb
      INNER JOIN products p ON p.id = pb.product_id
      SET pb.units_of_measurement = NULLIF(TRIM(COALESCE(p.units_of_measurement, '')), '')
      WHERE pb.units_of_measurement IS NULL OR TRIM(pb.units_of_measurement) = ''
    `);
  }
}

async function ensureProductsBarcodeIndexes() {
  const pool = getDbPool();
  const indexes = await listTableIndexes('products');

  if (indexes.has('uq_products_barcode')) {
    await pool.query('ALTER TABLE products DROP INDEX uq_products_barcode');
  }

  if (indexes.has('uq_products_article')) {
    await pool.query('ALTER TABLE products DROP INDEX uq_products_article');
  }

  const columns = await listTableColumns('products');
  if (columns.has('units_of_measurement')) {
    await pool.query('ALTER TABLE products DROP COLUMN units_of_measurement');
  }
  if (columns.has('barcode')) {
    await pool.query('ALTER TABLE products DROP COLUMN barcode');
  }

  const refreshedIndexes = await listTableIndexes('products');
  if (!refreshedIndexes.has('idx_products_identity')) {
    await pool.query(
      'ALTER TABLE products ADD KEY idx_products_identity (article, product_name)'
    );
  }
}

async function ensureUsersPositionTitleColumn() {
  const pool = getDbPool();
  const columns = await listTableColumns('users');
  if (!columns.has('position_title')) {
    await pool.query('ALTER TABLE users ADD COLUMN position_title VARCHAR(120) NULL AFTER surname');
  }
}

async function ensureUsersRoleColumnSupportsInventoryRoles() {
  const pool = getDbPool();
  const columns = await listTableColumns('users');
  if (!columns.has('role')) {
    return;
  }

  await pool.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(40) NOT NULL DEFAULT 'staff'");
  await pool.query("UPDATE users SET role = 'staff' WHERE role = 'user' OR TRIM(COALESCE(role, '')) = ''");
  await pool.query("UPDATE users SET role = 'store_manager' WHERE role = 'manager'");
}

export async function applyInventorySchemaMigrations() {
  const pool = getDbPool();
  const [tableRows] = await pool.query<ShowTablesRow[]>('SHOW TABLES');
  const existingTables = new Set(tableRows.map(extractTableName));

  if (!existingTables.has('users') || !existingTables.has('products') || !existingTables.has('stores')) {
    throw new Error('Для inventory-міграції мають уже існувати таблиці users, products та stores.');
  }

  if (!existingTables.has('product_batches')) {
    throw new Error('Таблиця product_batches відсутня. Спочатку застосуйте базову міграцію створення product_batches.');
  }

  await ensureUsersPositionTitleColumn();
  await ensureUsersRoleColumnSupportsInventoryRoles();
  await ensureProductsDefaultNotifyColumn();
  await ensureProductsDefaultUnitsColumn();
  await ensureProductBarcodesTable();
  await ensureProductsBarcodeIndexes();
  await ensureProductBatchesWorkflowColumns();
  await ensureBatchSalesTable();
  await ensureBatchChecksTable();
  await ensureNotificationLogsTable();
  await ensureProductChangeLogsTable();
  await ensureProductImportReviewQueueTable();

  return getInventoryReadinessFromDb();
}
