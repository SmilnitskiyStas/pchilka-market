SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS pos_archive_orders (
  source_shop_code INT NOT NULL,
  source_workplace_id INT NOT NULL,
  source_order_code BIGINT NOT NULL,
  archive_day DATE NOT NULL,
  ordered_at DATETIME(6) NOT NULL,
  receipt_at DATETIME(6) NULL,
  source_client_code BIGINT NULL,
  source_user_code BIGINT NULL,
  receipt_number BIGINT NULL,
  cash_register VARCHAR(120) NULL,
  order_total DECIMAL(20,4) NULL,
  discount_total DECIMAL(20,4) NULL,
  order_type SMALLINT NULL,
  source_payload JSON NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_shop_code, source_workplace_id, source_order_code),
  KEY idx_pos_archive_orders_day (archive_day),
  KEY idx_pos_archive_orders_client_date (source_client_code, ordered_at),
  KEY idx_pos_archive_orders_ordered_at (ordered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_archive_order_items (
  source_shop_code INT NOT NULL,
  source_workplace_id INT NOT NULL,
  source_order_code BIGINT NOT NULL,
  line_number INT NOT NULL,
  archive_day DATE NOT NULL,
  source_product_code BIGINT NULL,
  source_unit_code BIGINT NULL,
  barcode VARCHAR(255) NULL,
  quantity DECIMAL(20,6) NULL,
  unit_price DECIMAL(20,4) NULL,
  line_total DECIMAL(20,4) NULL,
  discount_total DECIMAL(20,4) NULL,
  returned_quantity DECIMAL(20,6) NULL,
  returned_total DECIMAL(20,4) NULL,
  source_payload JSON NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_shop_code, source_workplace_id, source_order_code, line_number),
  KEY idx_pos_archive_items_day (archive_day),
  KEY idx_pos_archive_items_product_day (source_product_code, archive_day),
  CONSTRAINT fk_pos_archive_items_order
    FOREIGN KEY (source_shop_code, source_workplace_id, source_order_code)
    REFERENCES pos_archive_orders (source_shop_code, source_workplace_id, source_order_code)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_archive_order_payments (
  source_shop_code INT NOT NULL,
  source_workplace_id INT NOT NULL,
  source_order_code BIGINT NOT NULL,
  line_number INT NOT NULL,
  archive_day DATE NOT NULL,
  payment_type SMALLINT NULL,
  currency_code BIGINT NULL,
  payment_sum DECIMAL(20,4) NULL,
  base_sum DECIMAL(20,4) NULL,
  source_payload JSON NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_shop_code, source_workplace_id, source_order_code, line_number),
  KEY idx_pos_archive_payments_day (archive_day),
  CONSTRAINT fk_pos_archive_payments_order
    FOREIGN KEY (source_shop_code, source_workplace_id, source_order_code)
    REFERENCES pos_archive_orders (source_shop_code, source_workplace_id, source_order_code)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_archive_days (
  archive_day DATE NOT NULL,
  source_order_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  source_item_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  source_payment_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  batch_count INT UNSIGNED NOT NULL DEFAULT 0,
  run_id VARCHAR(80) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'complete',
  completed_at DATETIME(6) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (archive_day),
  KEY idx_pos_archive_days_status (status, archive_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
