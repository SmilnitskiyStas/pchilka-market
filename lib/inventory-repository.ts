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
  if (!columns.has('checked_followup_action')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN checked_followup_action VARCHAR(40) NULL AFTER action_note');
  }
  if (!columns.has('do_not_track')) {
    statements.push("ALTER TABLE product_batches ADD COLUMN do_not_track TINYINT(1) NOT NULL DEFAULT 0 AFTER checked_followup_action");
  }
  if (!columns.has('do_not_track_reason')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN do_not_track_reason VARCHAR(80) NULL AFTER do_not_track');
  }
  if (!columns.has('responsible_user_id')) {
    statements.push('ALTER TABLE product_batches ADD COLUMN responsible_user_id BIGINT UNSIGNED NULL AFTER do_not_track_reason');
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
  if (!refreshedIndexes.has('idx_product_batches_checked_followup_action')) {
    await pool.query(
      'ALTER TABLE product_batches ADD KEY idx_product_batches_checked_followup_action (checked_followup_action)'
    );
  }
  if (!refreshedIndexes.has('idx_product_batches_do_not_track')) {
    await pool.query('ALTER TABLE product_batches ADD KEY idx_product_batches_do_not_track (do_not_track)');
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
      sold_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
      sale_source VARCHAR(80) NOT NULL DEFAULT 'manual',
      external_sale_id VARCHAR(255) NULL,
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

  const columns = await listTableColumns('batch_sales');
  if (columns.has('sold_quantity')) {
    await pool.query('ALTER TABLE batch_sales MODIFY COLUMN sold_quantity DECIMAL(12,3) NOT NULL DEFAULT 0');
  }
  if (columns.has('external_sale_id')) {
    await pool.query('ALTER TABLE batch_sales MODIFY COLUMN external_sale_id VARCHAR(255) NULL');
  }
}

async function ensureInventoryQuantityPrecision() {
  const pool = getDbPool();
  const batchColumns = await listTableColumns('product_batches');

  if (batchColumns.has('quantity')) {
    await pool.query('ALTER TABLE product_batches MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0');
  }
  if (batchColumns.has('quantity_received')) {
    await pool.query('ALTER TABLE product_batches MODIFY COLUMN quantity_received DECIMAL(12,3) NOT NULL DEFAULT 0');
  }
  if (batchColumns.has('quantity_current')) {
    await pool.query('ALTER TABLE product_batches MODIFY COLUMN quantity_current DECIMAL(12,3) NOT NULL DEFAULT 0');
  }
}

async function ensureInventorySaleImportRowsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_sale_import_rows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sale_source VARCHAR(80) NOT NULL DEFAULT 'pos-xlsx',
      external_sale_id VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NULL,
      row_number INT NOT NULL DEFAULT 0,
      store_label VARCHAR(255) NULL,
      cash_register VARCHAR(80) NULL,
      receipt_number VARCHAR(80) NULL,
      article VARCHAR(120) NULL,
      product_name VARCHAR(255) NULL,
      price_scheme VARCHAR(120) NULL,
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      discounted_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
      line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      receipt_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      sold_at DATETIME NULL,
      product_id BIGINT UNSIGNED NULL,
      store_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'failed',
      error_message TEXT NULL,
      allocations_json LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_inventory_sale_import_external (sale_source, external_sale_id),
      KEY idx_inventory_sale_import_status (status),
      KEY idx_inventory_sale_import_article (article),
      KEY idx_inventory_sale_import_sold_at (sold_at),
      KEY idx_inventory_sale_import_product (product_id),
      KEY idx_inventory_sale_import_store (store_id),
      CONSTRAINT fk_inventory_sale_import_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_sale_import_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureBatchChecksTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_checks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id BIGINT UNSIGNED NOT NULL,
      task_id BIGINT UNSIGNED NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(50) NOT NULL,
      counted_quantity INT NULL,
      item_condition VARCHAR(50) NULL,
      issue_reason VARCHAR(80) NULL,
      note TEXT NULL,
      checked_followup_action VARCHAR(40) NULL,
      photo_url VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_batch_checks_batch (batch_id),
      KEY idx_batch_checks_task (task_id),
      KEY idx_batch_checks_product (product_id),
      KEY idx_batch_checks_store (store_id),
      KEY idx_batch_checks_user (user_id),
      KEY idx_batch_checks_action_created_at (action, created_at),
      CONSTRAINT fk_batch_checks_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_checks_task
        FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
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

  const columns = await listTableColumns('batch_checks');
  if (!columns.has('task_id')) {
    await pool.query('ALTER TABLE batch_checks ADD COLUMN task_id BIGINT UNSIGNED NULL AFTER batch_id');
  }
  if (!columns.has('checked_followup_action')) {
    await pool.query('ALTER TABLE batch_checks ADD COLUMN checked_followup_action VARCHAR(40) NULL AFTER note');
  }

  const indexes = await listTableIndexes('batch_checks');
  if (!indexes.has('idx_batch_checks_task')) {
    await pool.query('ALTER TABLE batch_checks ADD KEY idx_batch_checks_task (task_id)');
  }

  const constraints = await listTableConstraints('batch_checks');
  if (!constraints.has('fk_batch_checks_task')) {
    await pool.query(`
      ALTER TABLE batch_checks
      ADD CONSTRAINT fk_batch_checks_task
      FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
}

async function ensureBatchExpiryCorrectionsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_expiry_corrections (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      old_expiry_date DATE NOT NULL,
      new_expiry_date DATE NOT NULL,
      reason VARCHAR(80) NOT NULL,
      comment TEXT NULL,
      photo_url TEXT NULL,
      changed_by_user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_batch_expiry_corrections_batch (batch_id),
      KEY idx_batch_expiry_corrections_product (product_id),
      KEY idx_batch_expiry_corrections_store (store_id),
      KEY idx_batch_expiry_corrections_user (changed_by_user_id),
      KEY idx_batch_expiry_corrections_created_at (created_at),
      CONSTRAINT fk_batch_expiry_corrections_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_expiry_corrections_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_expiry_corrections_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_batch_expiry_corrections_user
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureExpiryTasksTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expiry_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      responsible_user_id BIGINT UNSIGNED NULL,
      assigned_user_id BIGINT UNSIGNED NULL,
      source_type VARCHAR(40) NOT NULL DEFAULT 'system',
      task_type VARCHAR(50) NOT NULL DEFAULT 'expiry_check',
      status VARCHAR(40) NOT NULL DEFAULT 'open',
      outcome VARCHAR(60) NULL,
      risk_level VARCHAR(20) NOT NULL DEFAULT 'medium',
      due_date DATE NOT NULL,
      days_left_snapshot INT NOT NULL DEFAULT 0,
      title VARCHAR(255) NOT NULL,
      note TEXT NULL,
      resolution_note TEXT NULL,
      created_by_user_id BIGINT UNSIGNED NULL,
      started_at DATETIME NULL,
      first_detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_notified_at DATETIME NULL,
      completed_at DATETIME NULL,
      completed_by_user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_expiry_tasks_batch (batch_id),
      KEY idx_expiry_tasks_product (product_id),
      KEY idx_expiry_tasks_store (store_id),
      KEY idx_expiry_tasks_responsible_user (responsible_user_id),
      KEY idx_expiry_tasks_assigned_user (assigned_user_id),
      KEY idx_expiry_tasks_status_due_date (status, due_date),
      KEY idx_expiry_tasks_task_type_status (task_type, status),
      CONSTRAINT fk_expiry_tasks_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_expiry_tasks_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_expiry_tasks_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_expiry_tasks_responsible_user
        FOREIGN KEY (responsible_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_expiry_tasks_assigned_user
        FOREIGN KEY (assigned_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_expiry_tasks_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_expiry_tasks_completed_by_user
        FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const columns = await listTableColumns('expiry_tasks');
  const statements: string[] = [];

  if (!columns.has('assigned_user_id')) {
    statements.push('ALTER TABLE expiry_tasks ADD COLUMN assigned_user_id BIGINT UNSIGNED NULL AFTER responsible_user_id');
  }
  if (!columns.has('source_type')) {
    statements.push("ALTER TABLE expiry_tasks ADD COLUMN source_type VARCHAR(40) NOT NULL DEFAULT 'system' AFTER assigned_user_id");
  }
  if (!columns.has('outcome')) {
    statements.push('ALTER TABLE expiry_tasks ADD COLUMN outcome VARCHAR(60) NULL AFTER status');
  }
  if (!columns.has('resolution_note')) {
    statements.push('ALTER TABLE expiry_tasks ADD COLUMN resolution_note TEXT NULL AFTER note');
  }
  if (!columns.has('created_by_user_id')) {
    statements.push('ALTER TABLE expiry_tasks ADD COLUMN created_by_user_id BIGINT UNSIGNED NULL AFTER resolution_note');
  }
  if (!columns.has('started_at')) {
    statements.push('ALTER TABLE expiry_tasks ADD COLUMN started_at DATETIME NULL AFTER created_by_user_id');
  }
  if (!columns.has('completed_by_user_id')) {
    statements.push('ALTER TABLE expiry_tasks ADD COLUMN completed_by_user_id BIGINT UNSIGNED NULL AFTER completed_at');
  }

  for (const statement of statements) {
    await pool.query(statement);
  }

  const refreshedColumns = await listTableColumns('expiry_tasks');
  if (refreshedColumns.has('assigned_user_id') && refreshedColumns.has('responsible_user_id')) {
    await pool.query(`
      UPDATE expiry_tasks
      SET assigned_user_id = responsible_user_id
      WHERE assigned_user_id IS NULL AND responsible_user_id IS NOT NULL
    `);
  }
  if (refreshedColumns.has('source_type')) {
    await pool.query(`
      UPDATE expiry_tasks
      SET source_type = 'system'
      WHERE TRIM(COALESCE(source_type, '')) = ''
    `);
  }
  if (refreshedColumns.has('outcome')) {
    await pool.query(`
      UPDATE expiry_tasks
      SET outcome = CASE
        WHEN status = 'escalated' THEN 'manager_review'
        WHEN status = 'writeoff_pending' THEN 'writeoff_required'
        WHEN status = 'completed' AND outcome IS NULL THEN 'checked_ok'
        ELSE outcome
      END
      WHERE status IN ('escalated', 'writeoff_pending', 'completed')
    `);
  }
  await pool.query(`
    UPDATE expiry_tasks
    SET status = CASE
      WHEN status IN ('escalated', 'writeoff_pending') THEN 'open'
      ELSE status
    END
    WHERE status IN ('escalated', 'writeoff_pending')
  `);

  const indexes = await listTableIndexes('expiry_tasks');
  if (!indexes.has('idx_expiry_tasks_assigned_user')) {
    await pool.query('ALTER TABLE expiry_tasks ADD KEY idx_expiry_tasks_assigned_user (assigned_user_id)');
  }

  const constraints = await listTableConstraints('expiry_tasks');
  if (!constraints.has('fk_expiry_tasks_assigned_user')) {
    await pool.query(`
      ALTER TABLE expiry_tasks
      ADD CONSTRAINT fk_expiry_tasks_assigned_user
      FOREIGN KEY (assigned_user_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
  if (!constraints.has('fk_expiry_tasks_created_by_user')) {
    await pool.query(`
      ALTER TABLE expiry_tasks
      ADD CONSTRAINT fk_expiry_tasks_created_by_user
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
  if (!constraints.has('fk_expiry_tasks_completed_by_user')) {
    await pool.query(`
      ALTER TABLE expiry_tasks
      ADD CONSTRAINT fk_expiry_tasks_completed_by_user
      FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
}

async function ensureInventoryCountSessionsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_count_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      store_id BIGINT UNSIGNED NOT NULL,
      scheduled_for DATE NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      started_by_user_id BIGINT UNSIGNED NULL,
      completed_by_user_id BIGINT UNSIGNED NULL,
      completed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inventory_count_sessions_store (store_id),
      KEY idx_inventory_count_sessions_status (status),
      KEY idx_inventory_count_sessions_started_by_user (started_by_user_id),
      KEY idx_inventory_count_sessions_completed_by_user (completed_by_user_id),
      KEY idx_inventory_count_sessions_store_status (store_id, status),
      CONSTRAINT fk_inventory_count_sessions_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_count_sessions_started_by_user
        FOREIGN KEY (started_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_count_sessions_completed_by_user
        FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureInventoryCountItemsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_count_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id BIGINT UNSIGNED NOT NULL,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      expected_quantity INT NOT NULL DEFAULT 0,
      counted_quantity INT NULL,
      difference_quantity INT NULL,
      note TEXT NULL,
      checked_by_user_id BIGINT UNSIGNED NULL,
      checked_at DATETIME NULL,
      product_name_snapshot VARCHAR(255) NOT NULL,
      article_snapshot VARCHAR(120) NULL,
      barcode_snapshot VARCHAR(255) NULL,
      units_of_measurement_snapshot VARCHAR(50) NULL,
      expiry_date_snapshot DATE NOT NULL,
      batch_code_snapshot VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inventory_count_items_session (session_id),
      KEY idx_inventory_count_items_batch (batch_id),
      KEY idx_inventory_count_items_product (product_id),
      KEY idx_inventory_count_items_checked_by_user (checked_by_user_id),
      KEY idx_inventory_count_items_expiry (expiry_date_snapshot),
      CONSTRAINT fk_inventory_count_items_session
        FOREIGN KEY (session_id) REFERENCES inventory_count_sessions(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_count_items_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_count_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_count_items_checked_by_user
        FOREIGN KEY (checked_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureInventoryAdjustmentsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      session_id BIGINT UNSIGNED NULL,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      adjusted_by_user_id BIGINT UNSIGNED NULL,
      reason VARCHAR(80) NOT NULL,
      old_quantity INT NOT NULL DEFAULT 0,
      new_quantity INT NOT NULL DEFAULT 0,
      difference_quantity INT NOT NULL DEFAULT 0,
      note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inventory_adjustments_session (session_id),
      KEY idx_inventory_adjustments_batch (batch_id),
      KEY idx_inventory_adjustments_product (product_id),
      KEY idx_inventory_adjustments_store (store_id),
      KEY idx_inventory_adjustments_user (adjusted_by_user_id),
      KEY idx_inventory_adjustments_reason_created_at (reason, created_at),
      CONSTRAINT fk_inventory_adjustments_session
        FOREIGN KEY (session_id) REFERENCES inventory_count_sessions(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_adjustments_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_adjustments_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_adjustments_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_adjustments_user
        FOREIGN KEY (adjusted_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureNotificationLogsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      task_id BIGINT UNSIGNED NULL,
      batch_id BIGINT UNSIGNED NULL,
      product_id BIGINT UNSIGNED NULL,
      store_id BIGINT UNSIGNED NULL,
      user_id BIGINT UNSIGNED NULL,
      notification_type VARCHAR(80) NOT NULL,
      message_text TEXT NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'sent',
      opened_at DATETIME NULL,
      opened_by_user_id BIGINT UNSIGNED NULL,
      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notification_logs_task (task_id),
      KEY idx_notification_logs_batch (batch_id),
      KEY idx_notification_logs_product (product_id),
      KEY idx_notification_logs_store (store_id),
      KEY idx_notification_logs_user (user_id),
      KEY idx_notification_logs_opened_by_user (opened_by_user_id),
      KEY idx_notification_logs_type_sent_at (notification_type, sent_at),
      CONSTRAINT fk_notification_logs_task
        FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
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
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_notification_logs_opened_by_user
        FOREIGN KEY (opened_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const columns = await listTableColumns('notification_logs');
  if (!columns.has('task_id')) {
    await pool.query('ALTER TABLE notification_logs ADD COLUMN task_id BIGINT UNSIGNED NULL AFTER id');
  }
  if (!columns.has('status')) {
    await pool.query("ALTER TABLE notification_logs ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'sent' AFTER message_text");
  }
  if (!columns.has('opened_at')) {
    await pool.query('ALTER TABLE notification_logs ADD COLUMN opened_at DATETIME NULL AFTER status');
  }
  if (!columns.has('opened_by_user_id')) {
    await pool.query('ALTER TABLE notification_logs ADD COLUMN opened_by_user_id BIGINT UNSIGNED NULL AFTER opened_at');
  }

  const indexes = await listTableIndexes('notification_logs');
  if (!indexes.has('idx_notification_logs_task')) {
    await pool.query('ALTER TABLE notification_logs ADD KEY idx_notification_logs_task (task_id)');
  }
  if (!indexes.has('idx_notification_logs_opened_by_user')) {
    await pool.query('ALTER TABLE notification_logs ADD KEY idx_notification_logs_opened_by_user (opened_by_user_id)');
  }

  const constraints = await listTableConstraints('notification_logs');
  if (!constraints.has('fk_notification_logs_task')) {
    await pool.query(`
      ALTER TABLE notification_logs
      ADD CONSTRAINT fk_notification_logs_task
      FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
  if (!constraints.has('fk_notification_logs_opened_by_user')) {
    await pool.query(`
      ALTER TABLE notification_logs
      ADD CONSTRAINT fk_notification_logs_opened_by_user
      FOREIGN KEY (opened_by_user_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
}

async function ensureNotificationLogTasksTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_log_tasks (
      notification_log_id BIGINT UNSIGNED NOT NULL,
      task_id BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_log_id, task_id),
      KEY idx_notification_log_tasks_task (task_id),
      CONSTRAINT fk_notification_log_tasks_log
        FOREIGN KEY (notification_log_id) REFERENCES notification_logs(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_notification_log_tasks_task
        FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureInventoryDiscussionTables() {
  const pool = getDbPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_discussion_threads (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      task_id BIGINT UNSIGNED NULL,
      batch_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      store_id BIGINT UNSIGNED NOT NULL,
      requester_user_id BIGINT UNSIGNED NOT NULL,
      manager_user_id BIGINT UNSIGNED NULL,
      title VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      created_from_action VARCHAR(40) NOT NULL DEFAULT 'discussion_required',
      last_message_at DATETIME NULL,
      closed_at DATETIME NULL,
      closed_by_user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inventory_discussion_threads_status_store (status, store_id, updated_at),
      KEY idx_inventory_discussion_threads_requester (requester_user_id, status),
      KEY idx_inventory_discussion_threads_manager (manager_user_id, status),
      KEY idx_inventory_discussion_threads_task (task_id),
      KEY idx_inventory_discussion_threads_batch (batch_id),
      CONSTRAINT fk_inventory_discussion_threads_task
        FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_threads_batch
        FOREIGN KEY (batch_id) REFERENCES product_batches(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_threads_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_threads_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_threads_requester
        FOREIGN KEY (requester_user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_threads_manager
        FOREIGN KEY (manager_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_threads_closed_by
        FOREIGN KEY (closed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_discussion_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      thread_id BIGINT UNSIGNED NOT NULL,
      sender_user_id BIGINT UNSIGNED NOT NULL,
      recipient_user_id BIGINT UNSIGNED NULL,
      sender_role VARCHAR(30) NOT NULL,
      channel VARCHAR(30) NOT NULL DEFAULT 'telegram',
      message_text TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_inventory_discussion_messages_thread (thread_id, created_at),
      KEY idx_inventory_discussion_messages_sender (sender_user_id, created_at),
      CONSTRAINT fk_inventory_discussion_messages_thread
        FOREIGN KEY (thread_id) REFERENCES inventory_discussion_threads(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_messages_sender
        FOREIGN KEY (sender_user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_messages_recipient
        FOREIGN KEY (recipient_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_discussion_sessions (
      user_id BIGINT UNSIGNED NOT NULL,
      thread_id BIGINT UNSIGNED NOT NULL,
      session_role VARCHAR(30) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      KEY idx_inventory_discussion_sessions_thread (thread_id),
      CONSTRAINT fk_inventory_discussion_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_inventory_discussion_sessions_thread
        FOREIGN KEY (thread_id) REFERENCES inventory_discussion_threads(id)
        ON DELETE CASCADE ON UPDATE CASCADE
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

async function ensureProductsApprovalWorkflowColumns() {
  const pool = getDbPool();
  const columns = await listTableColumns('products');
  const statements: string[] = [];

  if (!columns.has('approval_status')) {
    statements.push("ALTER TABLE products ADD COLUMN approval_status VARCHAR(30) NOT NULL DEFAULT 'approved' AFTER is_active");
  }
  if (!columns.has('created_source')) {
    statements.push("ALTER TABLE products ADD COLUMN created_source VARCHAR(40) NOT NULL DEFAULT 'admin' AFTER approval_status");
  }
  if (!columns.has('approval_requested_at')) {
    statements.push('ALTER TABLE products ADD COLUMN approval_requested_at DATETIME NULL AFTER created_source');
  }
  if (!columns.has('approved_at')) {
    statements.push('ALTER TABLE products ADD COLUMN approved_at DATETIME NULL AFTER approval_requested_at');
  }
  if (!columns.has('approved_by_user_id')) {
    statements.push('ALTER TABLE products ADD COLUMN approved_by_user_id BIGINT UNSIGNED NULL AFTER approved_at');
  }
  if (!columns.has('approval_note')) {
    statements.push('ALTER TABLE products ADD COLUMN approval_note TEXT NULL AFTER approved_by_user_id');
  }

  for (const statement of statements) {
    await pool.query(statement);
  }

  await pool.query(`
    UPDATE products
    SET
      approval_status = CASE
        WHEN TRIM(COALESCE(approval_status, '')) = '' THEN 'approved'
        ELSE approval_status
      END,
      created_source = CASE
        WHEN TRIM(COALESCE(created_source, '')) = '' THEN 'admin'
        ELSE created_source
      END
  `);

  await pool.query(`
    UPDATE products p
    INNER JOIN (
      SELECT product_id, MIN(created_at) AS created_at
      FROM activity_logs
      WHERE action_type = 'product_created_from_telegram_intake'
        AND product_id IS NOT NULL
      GROUP BY product_id
    ) al ON al.product_id = p.id
    SET
      p.created_source = 'manual_worker',
      p.approval_status = CASE
        WHEN p.approval_status = 'approved' AND p.approved_at IS NULL THEN 'pending'
        ELSE p.approval_status
      END,
      p.approval_requested_at = COALESCE(p.approval_requested_at, al.created_at)
  `);

  const indexes = await listTableIndexes('products');
  if (!indexes.has('idx_products_approval_status')) {
    await pool.query('ALTER TABLE products ADD KEY idx_products_approval_status (approval_status)');
  }
  if (!indexes.has('idx_products_created_source')) {
    await pool.query('ALTER TABLE products ADD KEY idx_products_created_source (created_source)');
  }
  if (!indexes.has('idx_products_approved_by_user')) {
    await pool.query('ALTER TABLE products ADD KEY idx_products_approved_by_user (approved_by_user_id)');
  }

  const constraints = await listTableConstraints('products');
  if (!constraints.has('fk_products_approved_by_user')) {
    await pool.query(`
      ALTER TABLE products
      ADD CONSTRAINT fk_products_approved_by_user
      FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }
}

async function ensureProductApprovalReviewsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_approval_reviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(30) NOT NULL,
      old_values_json LONGTEXT NULL,
      new_values_json LONGTEXT NULL,
      note TEXT NULL,
      reviewed_by_user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_product_approval_reviews_product (product_id),
      KEY idx_product_approval_reviews_action (action),
      KEY idx_product_approval_reviews_reviewed_by_user (reviewed_by_user_id),
      CONSTRAINT fk_product_approval_reviews_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_product_approval_reviews_reviewed_by_user
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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

async function ensureStoresTaskAssignmentModeColumn() {
  const pool = getDbPool();
  const columns = await listTableColumns('stores');
  if (!columns.has('task_assignment_mode')) {
    await pool.query(
      "ALTER TABLE stores ADD COLUMN task_assignment_mode VARCHAR(30) NOT NULL DEFAULT 'personal' AFTER sort_order"
    );
  }

  await pool.query(`
    UPDATE stores
    SET task_assignment_mode = CASE
      WHEN task_assignment_mode IN ('shared', 'hybrid') THEN task_assignment_mode
      ELSE 'personal'
    END
  `);
}

async function ensureTelegramRemindersTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_reminders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      chat_id VARCHAR(32) NOT NULL,
      creator_user_id VARCHAR(32) NOT NULL,
      creator_display_name VARCHAR(255) NOT NULL,
      assignee_username VARCHAR(32) NULL,
      reminder_text TEXT NOT NULL,
      remind_at DATETIME NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_telegram_reminders_due (status, remind_at),
      KEY idx_telegram_reminders_creator (chat_id, creator_user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const columns = await listTableColumns('telegram_reminders');
  if (!columns.has('assignee_username')) {
    await pool.query('ALTER TABLE telegram_reminders ADD COLUMN assignee_username VARCHAR(32) NULL AFTER creator_display_name');
  }
}

async function ensureMarketingStoreTpCodes() {
  const pool = getDbPool();
  const columns = await listTableColumns('stores');
  if (!columns.has('tp_code')) {
    await pool.query('ALTER TABLE stores ADD COLUMN tp_code INT NULL AFTER store_code');
  }
  const indexes = await listTableIndexes('stores');
  if (!indexes.has('uq_stores_tp_code')) {
    await pool.query('ALTER TABLE stores ADD UNIQUE KEY uq_stores_tp_code (tp_code)');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS marketing_store_tp_mapping (
    tp_code INT NOT NULL PRIMARY KEY, store_label VARCHAR(64) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`INSERT INTO marketing_store_tp_mapping (tp_code, store_label) VALUES
    (2,'М2'),(3,'М3'),(5,'М5'),(6,'М6'),(7,'М7'),(8,'М8'),(10,'М10'),(12,'М12'),(14,'М14'),(15,'М15'),(16,'М16'),(19,'М19'),(20,'М20'),(21,'М21'),(22,'М22'),(23,'М23'),(25,'М4/1'),(26,'М26'),(28,'М28'),(29,'М13/1'),(30,'М32'),(31,'М33'),(32,'М25'),(33,'М37'),(34,'М36'),(35,'М29'),(38,'М30'),(39,'М27'),(40,'М39'),(41,'М38'),(43,'М24/1'),(44,'М35'),(45,'М1/1'),(46,'М40'),(48,'М43'),(49,'М42'),(50,'М11/1'),(51,'М41'),(52,'М17/1'),(54,'М9/1'),(55,'М31') ON DUPLICATE KEY UPDATE store_label=VALUES(store_label), is_active=1`);
  await pool.query(`UPDATE stores s JOIN marketing_store_tp_mapping m
    ON CONVERT(m.store_label USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(REPLACE(s.store_code, 'M', 'М') USING utf8mb4) COLLATE utf8mb4_unicode_ci
    SET s.tp_code = m.tp_code WHERE s.tp_code IS NULL`);
}

async function ensureMarketingAnalyticsMart() {
  const pool = getDbPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS marketing_customer_store_period_metrics (
    period_start DATE NOT NULL, period_end DATE NOT NULL, tp_code INT NOT NULL, customer_code BIGINT NOT NULL,
    orders_count INT NOT NULL DEFAULT 0, turnover DECIMAL(20,2) NOT NULL DEFAULT 0, last_purchase_at DATETIME NULL,
    PRIMARY KEY (period_start, period_end, tp_code, customer_code),
    KEY idx_mcspm_customer_period (customer_code, period_start, period_end),
    KEY idx_mcspm_store_period (tp_code, period_start, period_end)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS marketing_customer_product_metrics (
    period_start DATE NOT NULL, period_end DATE NOT NULL, tp_code INT NOT NULL, customer_code BIGINT NOT NULL, product_code BIGINT NOT NULL,
    orders_count INT NOT NULL DEFAULT 0, quantity DECIMAL(20,3) NOT NULL DEFAULT 0, turnover DECIMAL(20,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (period_start, period_end, tp_code, customer_code, product_code),
    KEY idx_mcpm_product_period (product_code, tp_code, period_start, period_end), KEY idx_mcpm_customer_period (customer_code, period_start, period_end)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS marketing_customer_store_migrations (
    period_start DATE NOT NULL, period_end DATE NOT NULL, customer_code BIGINT NOT NULL, from_tp_code INT NOT NULL, to_tp_code INT NOT NULL,
    previous_orders_count INT NOT NULL DEFAULT 0, current_orders_count INT NOT NULL DEFAULT 0, calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (period_start, period_end, customer_code, from_tp_code, to_tp_code),
    KEY idx_mcsm_from_period (from_tp_code, period_start, period_end), KEY idx_mcsm_to_period (to_tp_code, period_start, period_end)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
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
  await ensureStoresTaskAssignmentModeColumn();
  await ensureProductsDefaultNotifyColumn();
  await ensureProductsDefaultUnitsColumn();
  await ensureProductsApprovalWorkflowColumns();
  await ensureProductApprovalReviewsTable();
  await ensureProductBarcodesTable();
  await ensureProductsBarcodeIndexes();
  await ensureProductBatchesWorkflowColumns();
  await ensureInventoryQuantityPrecision();
  await ensureBatchSalesTable();
  await ensureInventorySaleImportRowsTable();
  await ensureBatchChecksTable();
  await ensureBatchExpiryCorrectionsTable();
  await ensureExpiryTasksTable();
  await ensureInventoryCountSessionsTable();
  await ensureInventoryCountItemsTable();
  await ensureInventoryAdjustmentsTable();
  await ensureInventoryDiscussionTables();
  await ensureNotificationLogsTable();
  await ensureNotificationLogTasksTable();
  await ensureProductChangeLogsTable();
  await ensureProductImportReviewQueueTable();
  await ensureTelegramRemindersTable();
  await ensureMarketingStoreTpCodes();
  await ensureMarketingAnalyticsMart();

  return getInventoryReadinessFromDb();
}
