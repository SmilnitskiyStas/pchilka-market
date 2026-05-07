CREATE TABLE IF NOT EXISTS expiry_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  responsible_user_id BIGINT UNSIGNED NULL,
  task_type VARCHAR(50) NOT NULL DEFAULT 'expiry_check',
  status VARCHAR(40) NOT NULL DEFAULT 'open',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date DATE NOT NULL,
  days_left_snapshot INT NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL,
  note TEXT NULL,
  first_detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_notified_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expiry_tasks_batch (batch_id),
  KEY idx_expiry_tasks_product (product_id),
  KEY idx_expiry_tasks_store (store_id),
  KEY idx_expiry_tasks_responsible_user (responsible_user_id),
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
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
