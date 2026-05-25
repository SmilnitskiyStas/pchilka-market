-- Add approval workflow for products created manually by store staff.

SET NAMES utf8mb4;

ALTER TABLE products
  ADD COLUMN approval_status VARCHAR(30) NOT NULL DEFAULT 'approved' AFTER is_active,
  ADD COLUMN created_source VARCHAR(40) NOT NULL DEFAULT 'admin' AFTER approval_status,
  ADD COLUMN approval_requested_at DATETIME NULL AFTER created_source,
  ADD COLUMN approved_at DATETIME NULL AFTER approval_requested_at,
  ADD COLUMN approved_by_user_id BIGINT UNSIGNED NULL AFTER approved_at,
  ADD COLUMN approval_note TEXT NULL AFTER approved_by_user_id;

ALTER TABLE products
  ADD KEY idx_products_approval_status (approval_status),
  ADD KEY idx_products_created_source (created_source),
  ADD KEY idx_products_approved_by_user (approved_by_user_id),
  ADD CONSTRAINT fk_products_approved_by_user
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE products
SET
  approval_status = CASE
    WHEN TRIM(COALESCE(approval_status, '')) = '' THEN 'approved'
    ELSE approval_status
  END,
  created_source = CASE
    WHEN TRIM(COALESCE(created_source, '')) = '' THEN 'admin'
    ELSE created_source
  END;

UPDATE products p
INNER JOIN (
  SELECT product_id, MIN(created_at) AS created_at
  FROM activity_logs
  WHERE action_type = 'product_created_from_telegram_intake'
    AND product_id IS NOT NULL
  GROUP BY product_id
) al ON al.product_id = p.id
SET
  p.created_source = 'manual_worker',
  p.approval_status = CASE
    WHEN p.approval_status = 'approved' AND p.approved_at IS NULL THEN 'pending'
    ELSE p.approval_status
  END,
  p.approval_requested_at = COALESCE(p.approval_requested_at, al.created_at);

CREATE TABLE IF NOT EXISTS product_approval_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(30) NOT NULL,
  old_values_json LONGTEXT NULL,
  new_values_json LONGTEXT NULL,
  note TEXT NULL,
  reviewed_by_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_approval_reviews_product (product_id),
  KEY idx_product_approval_reviews_action (action),
  KEY idx_product_approval_reviews_reviewed_by_user (reviewed_by_user_id),
  CONSTRAINT fk_product_approval_reviews_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_product_approval_reviews_reviewed_by_user
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
