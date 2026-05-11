ALTER TABLE batch_checks
  ADD COLUMN task_id BIGINT UNSIGNED NULL AFTER batch_id,
  ADD KEY idx_batch_checks_task (task_id),
  ADD CONSTRAINT fk_batch_checks_task
    FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE notification_logs
  ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT 'sent' AFTER message_text,
  ADD COLUMN opened_at DATETIME NULL AFTER status,
  ADD COLUMN opened_by_user_id BIGINT UNSIGNED NULL AFTER opened_at,
  ADD KEY idx_notification_logs_opened_by_user (opened_by_user_id),
  ADD CONSTRAINT fk_notification_logs_opened_by_user
    FOREIGN KEY (opened_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
