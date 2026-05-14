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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
