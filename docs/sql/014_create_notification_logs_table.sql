-- Create notification_logs for outgoing Telegram/system notifications.
-- Run after users, stores, products and product_batches exist.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  store_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  notification_type VARCHAR(80) NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notification_logs_batch (batch_id),
  KEY idx_notification_logs_product (product_id),
  KEY idx_notification_logs_store (store_id),
  KEY idx_notification_logs_user (user_id),
  KEY idx_notification_logs_type_sent_at (notification_type, sent_at),
  CONSTRAINT fk_notification_logs_batch
    FOREIGN KEY (batch_id) REFERENCES product_batches(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notification_logs_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notification_logs_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notification_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
