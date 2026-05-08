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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
