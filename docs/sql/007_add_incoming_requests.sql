-- Add unified incoming requests table for forms from public website.

SET NAMES utf8mb4;

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

