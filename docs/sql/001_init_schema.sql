-- MySQL 8+ initial schema for Pchilka Web App
-- Safe to run on empty database.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS blog_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(160) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NULL,
  slug VARCHAR(180) NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NULL,
  content MEDIUMTEXT NULL,
  cover_image_url VARCHAR(1024) NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_posts_slug (slug),
  KEY idx_blog_posts_status_published_at (status, published_at),
  CONSTRAINT fk_blog_posts_category
    FOREIGN KEY (category_id) REFERENCES blog_categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(500) NULL,
  image_url VARCHAR(1024) NOT NULL,
  mobile_image_url VARCHAR(1024) NULL,
  target_url VARCHAR(1024) NULL,
  button_text VARCHAR(120) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_banners_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(180) NOT NULL,
  title VARCHAR(255) NOT NULL,
  short_description TEXT NULL,
  content MEDIUMTEXT NULL,
  image_url VARCHAR(1024) NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  is_weekly TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promotions_slug (slug),
  KEY idx_promotions_status_dates (status, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article VARCHAR(120) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  default_units_of_measurement VARCHAR(50) NULL,
  notified_days_default INT NOT NULL DEFAULT 7,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_identity (article, product_name),
  KEY idx_products_category_active (category, is_active)
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

CREATE TABLE IF NOT EXISTS stores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_code VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  region VARCHAR(120) NULL,
  city VARCHAR(120) NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  phone VARCHAR(60) NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  work_hours VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stores_store_code (store_code),
  KEY idx_stores_active_city (is_active, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(180) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pages_slug (slug),
  KEY idx_pages_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_meta (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type ENUM('page','blog_post','promotion') NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NULL,
  description VARCHAR(500) NULL,
  canonical_url VARCHAR(1024) NULL,
  og_title VARCHAR(255) NULL,
  og_description VARCHAR(500) NULL,
  og_image_url VARCHAR(1024) NULL,
  noindex TINYINT(1) NOT NULL DEFAULT 0,
  nofollow TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_seo_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS integrations_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ga4_measurement_id VARCHAR(80) NULL,
  gtm_container_id VARCHAR(80) NULL,
  meta_pixel_id VARCHAR(80) NULL,
  custom_head_code TEXT NULL,
  custom_body_code TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(60) NULL,
  email VARCHAR(255) NULL,
  subject VARCHAR(255) NULL,
  message TEXT NOT NULL,
  status ENUM('new','in_progress','done','spam') NOT NULL DEFAULT 'new',
  source_page VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_feedback_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incoming_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_type ENUM(
    'header_feedback',
    'cooperation_general',
    'cooperation_product',
    'cooperation_search_room',
    'cooperation_marketing_services',
    'cooperation_rental',
    'career_application'
  ) NOT NULL,
  full_name VARCHAR(255) NULL,
  company_name VARCHAR(255) NULL,
  contact_person VARCHAR(255) NULL,
  phone VARCHAR(60) NULL,
  email VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  vacancy VARCHAR(255) NULL,
  subject VARCHAR(255) NULL,
  target_store VARCHAR(255) NULL,
  message TEXT NULL,
  metadata_json JSON NULL,
  source_page VARCHAR(255) NULL,
  status ENUM('new','in_progress','done','spam') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_incoming_requests_status_created (status, created_at),
  KEY idx_incoming_requests_type_created (request_type, created_at),
  KEY idx_incoming_requests_email_phone (email, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(120) NOT NULL,
  setting_value JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_site_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  login VARCHAR(100) NOT NULL,
  display_name VARCHAR(120) NULL,
  password_hash VARCHAR(255) NULL,
  auth_provider ENUM('local','google') NOT NULL DEFAULT 'local',
  google_sub VARCHAR(191) NULL,
  email VARCHAR(255) NULL,
  role ENUM('admin','editor') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_login (login),
  UNIQUE KEY uq_admin_users_google_sub (google_sub),
  KEY idx_admin_users_active_role (is_active, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  surname VARCHAR(120) NOT NULL,
  position_title VARCHAR(120) NULL,
  user_chat_id BIGINT NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_chat_id (user_chat_id),
  KEY idx_users_store_id (store_id),
  KEY idx_users_role_active (role, is_active),
  CONSTRAINT fk_users_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  batch_code VARCHAR(120) NULL,
  quantity INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  quantity_current INT NOT NULL DEFAULT 0,
  batch_status VARCHAR(40) NOT NULL DEFAULT 'active',
  expiry_date DATE NOT NULL,
  delivery_date DATE NULL,
  notified TINYINT(1) NOT NULL DEFAULT 0,
  notified_at DATETIME NULL,
  notified_days INT NOT NULL DEFAULT 7,
  check_status VARCHAR(50) NOT NULL DEFAULT 'new',
  checked_by_user_id BIGINT UNSIGNED NULL,
  checked_at DATETIME NULL,
  action_taken VARCHAR(50) NULL,
  action_note TEXT NULL,
  responsible_user_id BIGINT UNSIGNED NULL,
  discussion_required TINYINT(1) NOT NULL DEFAULT 0,
  discussion_note TEXT NULL,
  discussion_requested_by_user_id BIGINT UNSIGNED NULL,
  discussion_requested_at DATETIME NULL,
  admin_decision VARCHAR(50) NULL,
  admin_decision_note TEXT NULL,
  admin_decision_by_user_id BIGINT UNSIGNED NULL,
  admin_decision_at DATETIME NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_batches_product (product_id),
  KEY idx_product_batches_store (store_id),
  KEY idx_product_batches_expiry (expiry_date),
  KEY idx_product_batches_status (check_status),
  KEY idx_product_batches_batch_status (batch_status),
  KEY idx_product_batches_checked_by_user (checked_by_user_id),
  KEY idx_product_batches_responsible_user (responsible_user_id),
  KEY idx_product_batches_discussion_required (discussion_required),
  KEY idx_product_batches_discussion_requested_by_user (discussion_requested_by_user_id),
  KEY idx_product_batches_admin_decision_by_user (admin_decision_by_user_id),
  KEY idx_product_batches_created_by_user (created_by_user_id),
  KEY idx_product_batches_updated_by_user (updated_by_user_id),
  CONSTRAINT fk_product_batches_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_checked_by_user
    FOREIGN KEY (checked_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_responsible_user
    FOREIGN KEY (responsible_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_discussion_requested_by_user
    FOREIGN KEY (discussion_requested_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_admin_decision_by_user
    FOREIGN KEY (admin_decision_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_product_batches_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batch_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  sold_quantity INT NOT NULL DEFAULT 0,
  sale_source VARCHAR(80) NOT NULL DEFAULT 'manual',
  external_sale_id VARCHAR(120) NULL,
  sold_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_batch_sales_batch (batch_id),
  KEY idx_batch_sales_product (product_id),
  KEY idx_batch_sales_store (store_id),
  KEY idx_batch_sales_sold_at (sold_at),
  CONSTRAINT fk_batch_sales_batch
    FOREIGN KEY (batch_id) REFERENCES product_batches(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_batch_sales_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_batch_sales_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  batch_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  store_id BIGINT UNSIGNED NULL,
  action_type VARCHAR(50) NOT NULL,
  comment TEXT NULL,
  old_quantity INT NULL,
  new_quantity INT NULL,
  old_expiry_date DATE NULL,
  new_expiry_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_logs_user (user_id),
  KEY idx_activity_logs_batch (batch_id),
  KEY idx_activity_logs_product (product_id),
  KEY idx_activity_logs_store (store_id),
  KEY idx_activity_logs_action_type (action_type),
  KEY idx_activity_logs_created_at (created_at),
  CONSTRAINT fk_activity_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_batch
    FOREIGN KEY (batch_id) REFERENCES product_batches(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  store_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  notification_type VARCHAR(80) NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notification_logs_batch (batch_id),
  KEY idx_notification_logs_product (product_id),
  KEY idx_notification_logs_store (store_id),
  KEY idx_notification_logs_user (user_id),
  KEY idx_notification_logs_type_sent_at (notification_type, sent_at),
  CONSTRAINT fk_notification_logs_batch
    FOREIGN KEY (batch_id) REFERENCES product_batches(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notification_logs_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notification_logs_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notification_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed one settings row for analytics/integrations (optional)
INSERT INTO integrations_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM integrations_settings WHERE id = 1);

SET FOREIGN_KEY_CHECKS = 1;
