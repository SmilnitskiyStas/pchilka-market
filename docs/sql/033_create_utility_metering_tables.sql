-- Utility meter readings, validation, and payment-document workflow.
-- Run manually against the target database after reviewing the schema.

CREATE TABLE IF NOT EXISTS utility_meter_import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_file VARCHAR(255) NOT NULL,
  source_sheet VARCHAR(255) NULL,
  imported_by VARCHAR(255) NULL,
  rows_total INT UNSIGNED NOT NULL DEFAULT 0,
  rows_imported INT UNSIGNED NOT NULL DEFAULT 0,
  rows_failed INT UNSIGNED NOT NULL DEFAULT 0,
  dry_run TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_utility_meter_import_batches_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utility_meter_points (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id BIGINT UNSIGNED NULL,
  store_code VARCHAR(64) NULL,
  store_label VARCHAR(255) NULL,
  address_line VARCHAR(500) NULL,
  owner_kind ENUM('store','tenant','shared','other') NOT NULL DEFAULT 'store',
  tenant_name VARCHAR(255) NULL,
  legal_entity VARCHAR(255) NULL,
  provider_name VARCHAR(255) NULL,
  contract_number VARCHAR(255) NULL,
  utility_type ENUM('electricity_active','electricity_reactive','water','waste','maintenance','rent','other') NOT NULL DEFAULT 'other',
  utility_label VARCHAR(255) NOT NULL,
  meter_number VARCHAR(255) NULL,
  coefficient DECIMAL(16,6) NOT NULL DEFAULT 1,
  initial_reading_value DECIMAL(14,4) NULL,
  area_sq_m DECIMAL(16,4) NULL,
  source_key VARCHAR(500) NOT NULL,
  source_file VARCHAR(255) NULL,
  source_sheet VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_meter_points_source_key (source_key),
  KEY idx_utility_meter_points_store_id (store_id),
  KEY idx_utility_meter_points_store_code (store_code),
  KEY idx_utility_meter_points_utility_type (utility_type),
  CONSTRAINT fk_utility_meter_points_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utility_meter_readings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  meter_point_id BIGINT UNSIGNED NOT NULL,
  period_month DATE NOT NULL,
  reading_date DATE NOT NULL,
  reading_value DECIMAL(18,4) NOT NULL,
  previous_reading_id BIGINT UNSIGNED NULL,
  submitted_by_user_id BIGINT UNSIGNED NULL,
  submitted_by_name VARCHAR(255) NULL,
  source_kind ENUM('manual','excel_import','system') NOT NULL DEFAULT 'manual',
  source_file VARCHAR(255) NULL,
  source_sheet VARCHAR(255) NULL,
  source_cell VARCHAR(64) NULL,
  notes TEXT NULL,
  status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_meter_readings_point_month (meter_point_id, period_month),
  KEY idx_utility_meter_readings_period_month (period_month),
  KEY idx_utility_meter_readings_status (status),
  KEY idx_utility_meter_readings_previous (previous_reading_id),
  CONSTRAINT fk_utility_meter_readings_point
    FOREIGN KEY (meter_point_id) REFERENCES utility_meter_points(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_utility_meter_readings_previous
    FOREIGN KEY (previous_reading_id) REFERENCES utility_meter_readings(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_utility_meter_readings_user
    FOREIGN KEY (submitted_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utility_meter_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  meter_point_id BIGINT UNSIGNED NULL,
  store_id BIGINT UNSIGNED NULL,
  utility_type ENUM('electricity_active','electricity_reactive','water','waste','maintenance','rent','other') NOT NULL DEFAULT 'other',
  period_month DATE NOT NULL,
  rate DECIMAL(18,6) NOT NULL,
  rate_label VARCHAR(255) NULL,
  includes_vat TINYINT(1) NOT NULL DEFAULT 1,
  source_file VARCHAR(255) NULL,
  source_sheet VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_meter_rates_scope (meter_point_id, store_id, utility_type, period_month),
  KEY idx_utility_meter_rates_period (period_month),
  CONSTRAINT fk_utility_meter_rates_point
    FOREIGN KEY (meter_point_id) REFERENCES utility_meter_points(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_utility_meter_rates_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utility_meter_charges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  meter_point_id BIGINT UNSIGNED NOT NULL,
  reading_id BIGINT UNSIGNED NOT NULL,
  period_month DATE NOT NULL,
  previous_value DECIMAL(18,4) NULL,
  current_value DECIMAL(18,4) NOT NULL,
  consumption DECIMAL(18,4) NULL,
  coefficient DECIMAL(16,6) NOT NULL DEFAULT 1,
  rate DECIMAL(18,6) NULL,
  amount DECIMAL(18,2) NULL,
  formula_code VARCHAR(64) NOT NULL DEFAULT 'reading_delta_rate',
  validation_status ENUM('ok','warning','error') NOT NULL DEFAULT 'warning',
  validation_messages JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_meter_charges_reading (reading_id),
  KEY idx_utility_meter_charges_period (period_month),
  KEY idx_utility_meter_charges_status (validation_status),
  CONSTRAINT fk_utility_meter_charges_point
    FOREIGN KEY (meter_point_id) REFERENCES utility_meter_points(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_utility_meter_charges_reading
    FOREIGN KEY (reading_id) REFERENCES utility_meter_readings(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utility_payment_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_number VARCHAR(100) NOT NULL,
  period_month DATE NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  store_label VARCHAR(255) NULL,
  status ENUM('draft','ready','approved','exported','cancelled') NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  generated_payload JSON NULL,
  generated_by VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_payment_documents_number (document_number),
  KEY idx_utility_payment_documents_period (period_month),
  KEY idx_utility_payment_documents_store (store_id),
  CONSTRAINT fk_utility_payment_documents_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS utility_payment_document_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id BIGINT UNSIGNED NOT NULL,
  charge_id BIGINT UNSIGNED NOT NULL,
  line_order INT UNSIGNED NOT NULL DEFAULT 0,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(18,4) NULL,
  unit_price DECIMAL(18,6) NULL,
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_payment_document_items_charge (document_id, charge_id),
  CONSTRAINT fk_utility_payment_document_items_document
    FOREIGN KEY (document_id) REFERENCES utility_payment_documents(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_utility_payment_document_items_charge
    FOREIGN KEY (charge_id) REFERENCES utility_meter_charges(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
