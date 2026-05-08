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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
