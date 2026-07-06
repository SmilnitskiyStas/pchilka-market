-- Create products table for product batches and catalog integrations.
-- Compatible with current project schema.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article VARCHAR(120) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  default_units_of_measurement VARCHAR(50) NULL,
  notified_days_default INT NOT NULL DEFAULT 7,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  fefo_tracking_enabled TINYINT(1) NOT NULL DEFAULT 1,
  approval_status VARCHAR(30) NOT NULL DEFAULT 'approved',
  created_source VARCHAR(40) NOT NULL DEFAULT 'admin',
  approval_requested_at DATETIME NULL,
  approved_at DATETIME NULL,
  approved_by_user_id BIGINT UNSIGNED NULL,
  approval_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_identity (article, product_name),
  KEY idx_products_category_active (category, is_active),
  KEY idx_products_fefo_tracking (fefo_tracking_enabled),
  KEY idx_products_approval_status (approval_status),
  KEY idx_products_created_source (created_source),
  KEY idx_products_approved_by_user (approved_by_user_id),
  CONSTRAINT fk_products_approved_by_user
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_barcodes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  barcode VARCHAR(120) NOT NULL,
  units_of_measurement VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_barcodes_barcode (barcode),
  KEY idx_product_barcodes_product (product_id),
  CONSTRAINT fk_product_barcodes_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
