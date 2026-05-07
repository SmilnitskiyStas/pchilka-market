-- Create users table for Telegram/app users.
-- Compatible with older MySQL versions.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  surname VARCHAR(120) NOT NULL,
  position_title VARCHAR(120) NULL,
  user_chat_id BIGINT NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_chat_id (user_chat_id),
  KEY idx_users_store_id (store_id),
  KEY idx_users_role_active (role, is_active),
  CONSTRAINT fk_users_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
