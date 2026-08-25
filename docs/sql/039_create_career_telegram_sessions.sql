-- Persistent conversation state for the Telegram vacancy bot.
-- This is applied automatically by Admin → Inventory → «Застосувати inventory-міграції».
-- Kept here only as a schema reference and for manual disaster recovery.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS career_telegram_sessions (
  chat_id VARCHAR(32) NOT NULL,
  step ENUM('phone', 'full_name', 'city', 'district') NOT NULL,
  phone VARCHAR(60) NULL,
  full_name VARCHAR(120) NULL,
  city VARCHAR(120) NULL,
  telegram_user_id VARCHAR(32) NULL,
  telegram_username VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id),
  KEY idx_career_telegram_sessions_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
