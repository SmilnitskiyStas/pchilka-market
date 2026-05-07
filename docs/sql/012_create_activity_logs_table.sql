-- Create activity_logs table for store actions on product batches.
-- Assumes products, stores, users, and product_batches already exist.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  batch_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  store_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(50) NOT NULL,
  comment TEXT NULL,
  old_quantity INT NULL,
  new_quantity INT NULL,
  old_expiry_date DATE NULL,
  new_expiry_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_logs_user (user_id),
  KEY idx_activity_logs_batch (batch_id),
  KEY idx_activity_logs_product (product_id),
  KEY idx_activity_logs_store (store_id),
  KEY idx_activity_logs_action_type (action_type),
  KEY idx_activity_logs_created_at (created_at),
  CONSTRAINT fk_activity_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_batch
    FOREIGN KEY (batch_id) REFERENCES product_batches(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
