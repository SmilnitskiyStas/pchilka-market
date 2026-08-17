-- Daily Telegram reminders for store managers who have not submitted utility meter readings.

CREATE TABLE IF NOT EXISTS utility_meter_reminder_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  period_month DATE NOT NULL,
  reminder_date DATE NOT NULL,
  missing_meters_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  error_message VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_meter_reminders_user_period_day (recipient_user_id, period_month, reminder_date),
  KEY idx_utility_meter_reminders_store_period (store_id, period_month),
  CONSTRAINT fk_utility_meter_reminders_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_utility_meter_reminders_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
