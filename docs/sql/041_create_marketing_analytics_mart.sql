CREATE TABLE IF NOT EXISTS marketing_customer_store_period_metrics (
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tp_code INT NOT NULL,
  customer_code BIGINT NOT NULL,
  orders_count INT NOT NULL DEFAULT 0,
  turnover DECIMAL(20,2) NOT NULL DEFAULT 0,
  last_purchase_at DATETIME NULL,
  PRIMARY KEY (period_start, period_end, tp_code, customer_code),
  KEY idx_mcspm_customer_period (customer_code, period_start, period_end),
  KEY idx_mcspm_store_period (tp_code, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS marketing_customer_product_metrics (
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tp_code INT NOT NULL,
  customer_code BIGINT NOT NULL,
  product_code BIGINT NOT NULL,
  orders_count INT NOT NULL DEFAULT 0,
  quantity DECIMAL(20,3) NOT NULL DEFAULT 0,
  turnover DECIMAL(20,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (period_start, period_end, tp_code, customer_code, product_code),
  KEY idx_mcpm_product_period (product_code, tp_code, period_start, period_end),
  KEY idx_mcpm_customer_period (customer_code, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS marketing_customer_store_migrations (
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  customer_code BIGINT NOT NULL,
  from_tp_code INT NOT NULL,
  to_tp_code INT NOT NULL,
  previous_orders_count INT NOT NULL DEFAULT 0,
  current_orders_count INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (period_start, period_end, customer_code, from_tp_code, to_tp_code),
  KEY idx_mcsm_from_period (from_tp_code, period_start, period_end),
  KEY idx_mcsm_to_period (to_tp_code, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
