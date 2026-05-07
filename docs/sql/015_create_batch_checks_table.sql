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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
