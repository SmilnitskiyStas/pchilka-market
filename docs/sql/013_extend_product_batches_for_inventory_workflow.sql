-- Extend product_batches for Telegram discussion/admin decision workflow.
-- Run after 011_create_product_batches_table.sql for existing databases.

SET NAMES utf8mb4;

ALTER TABLE product_batches
  ADD COLUMN discussion_required TINYINT(1) NOT NULL DEFAULT 0 AFTER action_note,
  ADD COLUMN discussion_note TEXT NULL AFTER discussion_required,
  ADD COLUMN discussion_requested_by_user_id BIGINT UNSIGNED NULL AFTER discussion_note,
  ADD COLUMN discussion_requested_at DATETIME NULL AFTER discussion_requested_by_user_id,
  ADD COLUMN admin_decision VARCHAR(50) NULL AFTER discussion_requested_at,
  ADD COLUMN admin_decision_note TEXT NULL AFTER admin_decision,
  ADD COLUMN admin_decision_by_user_id BIGINT UNSIGNED NULL AFTER admin_decision_note,
  ADD COLUMN admin_decision_at DATETIME NULL AFTER admin_decision_by_user_id;

ALTER TABLE product_batches
  ADD KEY idx_product_batches_discussion_required (discussion_required),
  ADD KEY idx_product_batches_discussion_requested_by_user (discussion_requested_by_user_id),
  ADD KEY idx_product_batches_admin_decision_by_user (admin_decision_by_user_id);

ALTER TABLE product_batches
  ADD CONSTRAINT fk_product_batches_discussion_requested_by_user
    FOREIGN KEY (discussion_requested_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  ADD CONSTRAINT fk_product_batches_admin_decision_by_user
    FOREIGN KEY (admin_decision_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
