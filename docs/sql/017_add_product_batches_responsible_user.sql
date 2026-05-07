-- Add responsible user assignment for product batches.
-- Compatible with older MySQL versions.

SET NAMES utf8mb4;

ALTER TABLE product_batches
  ADD COLUMN responsible_user_id BIGINT UNSIGNED NULL AFTER action_note,
  ADD KEY idx_product_batches_responsible_user (responsible_user_id),
  ADD CONSTRAINT fk_product_batches_responsible_user
    FOREIGN KEY (responsible_user_id) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
