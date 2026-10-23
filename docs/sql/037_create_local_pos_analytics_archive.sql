CREATE DATABASE IF NOT EXISTS pchilka_pos_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pchilka_pos_analytics;

CREATE TABLE pos_orders (
  shop_code INT NOT NULL, workplace_id INT NOT NULL, order_code BIGINT NOT NULL, order_day DATE NOT NULL,
  ordered_at DATETIME(6) NOT NULL, receipt_at DATETIME(6) NULL, client_code BIGINT NULL, user_code BIGINT NULL,
  receipt_number BIGINT NULL, cash_register VARCHAR(120) NULL, order_total DECIMAL(20,4) NULL,
  discount_total DECIMAL(20,4) NULL, order_type SMALLINT NULL,
  PRIMARY KEY (shop_code, workplace_id, order_code), KEY idx_orders_day (order_day), KEY idx_orders_ordered (ordered_at), KEY idx_orders_client_day (client_code, order_day)
) ENGINE=InnoDB;

CREATE TABLE pos_order_items (
  shop_code INT NOT NULL, workplace_id INT NOT NULL, order_code BIGINT NOT NULL, line_number INT NOT NULL, order_day DATE NOT NULL,
  product_code BIGINT NULL, unit_code BIGINT NULL, barcode VARCHAR(255) NULL, quantity DECIMAL(20,6) NULL,
  unit_price DECIMAL(20,4) NULL, line_total DECIMAL(20,4) NULL, discount_total DECIMAL(20,4) NULL,
  returned_quantity DECIMAL(20,6) NULL, returned_total DECIMAL(20,4) NULL,
  PRIMARY KEY (shop_code, workplace_id, order_code, line_number), KEY idx_items_day (order_day), KEY idx_items_product_day (product_code, order_day)
) ENGINE=InnoDB;

CREATE TABLE pos_order_payments (
  shop_code INT NOT NULL, workplace_id INT NOT NULL, order_code BIGINT NOT NULL, line_number INT NOT NULL, order_day DATE NOT NULL,
  payment_type SMALLINT NULL, currency_code BIGINT NULL, payment_sum DECIMAL(20,4) NULL, base_sum DECIMAL(20,4) NULL,
  PRIMARY KEY (shop_code, workplace_id, order_code, line_number), KEY idx_payments_day (order_day)
) ENGINE=InnoDB;

CREATE TABLE pos_products (
  product_code BIGINT PRIMARY KEY, group_code BIGINT NULL, product_name VARCHAR(1000) NOT NULL, receipt_name VARCHAR(1000) NULL,
  article VARCHAR(255) NULL, uktzed VARCHAR(40) NULL, basis_unit_code BIGINT NULL, default_unit_code BIGINT NULL,
  vat DECIMAL(12,4) NULL, active SMALLINT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_group (group_code), KEY idx_products_uktzed (uktzed)
) ENGINE=InnoDB;
CREATE TABLE pos_product_groups (group_code BIGINT PRIMARY KEY, parent_group_code BIGINT NULL, group_name VARCHAR(1000) NOT NULL, active SMALLINT NULL) ENGINE=InnoDB;
CREATE TABLE pos_product_barcodes (barcode VARCHAR(255) NOT NULL, product_code BIGINT NOT NULL, unit_code BIGINT NULL, active SMALLINT NULL, PRIMARY KEY (barcode, product_code), KEY idx_barcodes_product (product_code)) ENGINE=InnoDB;
CREATE TABLE pos_shops (shop_code INT PRIMARY KEY, shop_name VARCHAR(1000) NOT NULL, dealer_code INT NULL, active SMALLINT NULL) ENGINE=InnoDB;
CREATE TABLE pos_warehouses (warehouse_code INT PRIMARY KEY, warehouse_name VARCHAR(1000) NOT NULL) ENGINE=InnoDB;
CREATE TABLE pos_shop_warehouses (shop_code INT NOT NULL, warehouse_code INT NOT NULL, PRIMARY KEY (shop_code, warehouse_code)) ENGINE=InnoDB;
CREATE TABLE pos_units (unit_code INT PRIMARY KEY, unit_name VARCHAR(255) NOT NULL, unit_abbr VARCHAR(80) NULL, active SMALLINT NULL) ENGINE=InnoDB;
CREATE TABLE pos_dealer_prices (dealer_code INT NOT NULL, product_code BIGINT NOT NULL, dealer_price DECIMAL(20,4) NULL, indicative_min_price DECIMAL(20,4) NULL, indicative_max_price DECIMAL(20,4) NULL, indicative_active SMALLINT NULL, indicative_begin_date DATE NULL, indicative_end_date DATE NULL, PRIMARY KEY (dealer_code, product_code), KEY idx_prices_indicator (indicative_active)) ENGINE=InnoDB;
CREATE TABLE pos_sync_days (sync_day DATE PRIMARY KEY, orders_count BIGINT NOT NULL, items_count BIGINT NOT NULL, payments_count BIGINT NOT NULL, completed_at DATETIME(6) NOT NULL) ENGINE=InnoDB;
