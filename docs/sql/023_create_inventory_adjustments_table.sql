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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
