-- Add secure admin users table with support for local auth and Google OAuth identity.

SET NAMES utf8mb4;

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
