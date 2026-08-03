CREATE TABLE IF NOT EXISTS telegram_reminders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  chat_id VARCHAR(32) NOT NULL,
  creator_user_id VARCHAR(32) NOT NULL,
  creator_display_name VARCHAR(255) NOT NULL,
  assignee_username VARCHAR(32) NULL,
  reminder_text TEXT NOT NULL,
  remind_at DATETIME NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_telegram_reminders_due (status, remind_at),
  KEY idx_telegram_reminders_creator (chat_id, creator_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
