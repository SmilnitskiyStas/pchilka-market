ALTER TABLE notification_logs
  ADD COLUMN task_id BIGINT UNSIGNED NULL AFTER id,
  ADD KEY idx_notification_logs_task (task_id),
  ADD CONSTRAINT fk_notification_logs_task
    FOREIGN KEY (task_id) REFERENCES expiry_tasks(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
