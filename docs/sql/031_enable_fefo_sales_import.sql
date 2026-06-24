SET NAMES utf8mb4;

ALTER TABLE product_batches
  MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  MODIFY COLUMN quantity_received DECIMAL(12,3) NOT NULL DEFAULT 0,
  MODIFY COLUMN quantity_current DECIMAL(12,3) NOT NULL DEFAULT 0;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE batch_sales
  MODIFY COLUMN sold_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  MODIFY COLUMN external_sale_id VARCHAR(255) NULL;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
