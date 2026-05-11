ALTER TABLE expiry_tasks
  ADD COLUMN assigned_user_id BIGINT UNSIGNED NULL AFTER responsible_user_id,
  ADD COLUMN source_type VARCHAR(40) NOT NULL DEFAULT 'system' AFTER assigned_user_id,
  ADD COLUMN outcome VARCHAR(60) NULL AFTER status,
  ADD COLUMN resolution_note TEXT NULL AFTER note,
  ADD COLUMN created_by_user_id BIGINT UNSIGNED NULL AFTER resolution_note,
  ADD COLUMN started_at DATETIME NULL AFTER created_by_user_id,
  ADD COLUMN completed_by_user_id BIGINT UNSIGNED NULL AFTER completed_at,
  ADD KEY idx_expiry_tasks_assigned_user (assigned_user_id),
  ADD CONSTRAINT fk_expiry_tasks_assigned_user
    FOREIGN KEY (assigned_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_expiry_tasks_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_expiry_tasks_completed_by_user
    FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE expiry_tasks
SET assigned_user_id = responsible_user_id
WHERE assigned_user_id IS NULL AND responsible_user_id IS NOT NULL;

UPDATE expiry_tasks
SET outcome = CASE
  WHEN status = 'escalated' THEN 'manager_review'
  WHEN status = 'writeoff_pending' THEN 'writeoff_required'
  WHEN status = 'completed' AND outcome IS NULL THEN 'checked_ok'
  ELSE outcome
END
WHERE status IN ('escalated', 'writeoff_pending', 'completed');

UPDATE expiry_tasks
SET status = CASE
  WHEN status IN ('escalated', 'writeoff_pending') THEN 'open'
  ELSE status
END
WHERE status IN ('escalated', 'writeoff_pending');
