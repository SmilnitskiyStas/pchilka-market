CREATE TABLE IF NOT EXISTS product_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  product_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  batch_code VARCHAR(120) NULL,

  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantity_received DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantity_current DECIMAL(12,3) NOT NULL DEFAULT 0,
  batch_status VARCHAR(40) NOT NULL DEFAULT 'active',

  expiry_date DATE NOT NULL,
  delivery_date DATE NULL,

  notified TINYINT(1) NOT NULL DEFAULT 0,
  notified_at DATETIME NULL,
  notified_days INT NOT NULL DEFAULT 7,

  check_status VARCHAR(50) NOT NULL DEFAULT 'new',

  checked_by_user_id BIGINT UNSIGNED NULL,
  checked_at DATETIME NULL,

  action_taken VARCHAR(50) NULL,
  action_note TEXT NULL,
  responsible_user_id BIGINT UNSIGNED NULL,

  discussion_required TINYINT(1) NOT NULL DEFAULT 0,
  discussion_note TEXT NULL,
  discussion_requested_by_user_id BIGINT UNSIGNED NULL,
  discussion_requested_at DATETIME NULL,
  admin_decision VARCHAR(50) NULL,
  admin_decision_note TEXT NULL,
  admin_decision_by_user_id BIGINT UNSIGNED NULL,
  admin_decision_at DATETIME NULL,

  created_by_user_id BIGINT UNSIGNED NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_product_batches_product (product_id),
  KEY idx_product_batches_store (store_id),
  KEY idx_product_batches_expiry (expiry_date),
  KEY idx_product_batches_status (check_status),
  KEY idx_product_batches_batch_status (batch_status),
  KEY idx_product_batches_checked_by_user (checked_by_user_id),
  KEY idx_product_batches_responsible_user (responsible_user_id),
  KEY idx_product_batches_discussion_required (discussion_required),
  KEY idx_product_batches_discussion_requested_by_user (discussion_requested_by_user_id),
  KEY idx_product_batches_admin_decision_by_user (admin_decision_by_user_id),
  KEY idx_product_batches_created_by_user (created_by_user_id),
  KEY idx_product_batches_updated_by_user (updated_by_user_id),

  CONSTRAINT fk_product_batches_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_checked_by_user
    FOREIGN KEY (checked_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_responsible_user
    FOREIGN KEY (responsible_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_discussion_requested_by_user
    FOREIGN KEY (discussion_requested_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_admin_decision_by_user
    FOREIGN KEY (admin_decision_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_product_batches_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
