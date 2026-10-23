CREATE TABLE IF NOT EXISTS megogo_code_issuance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_key VARCHAR(64) NOT NULL,
  code_value VARCHAR(255) NOT NULL,
  status ENUM('available', 'issued') NOT NULL DEFAULT 'available',
  issued_at DATETIME NULL,
  last_presented_at DATETIME NULL,
  issued_loyalty_code VARCHAR(64) NULL,
  issued_check_total DECIMAL(12,2) NULL,
  issued_order_code VARCHAR(64) NULL,
  issued_store_code VARCHAR(64) NULL,
  issued_workplace_id VARCHAR(64) NULL,
  issued_rule_code INT NULL,
  issue_key VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_megogo_campaign_code (campaign_key, code_value),
  UNIQUE KEY uq_megogo_campaign_issue (campaign_key, issue_key),
  UNIQUE KEY uq_megogo_campaign_loyalty (campaign_key, issued_loyalty_code),
  KEY idx_megogo_available (campaign_key, status, id),
  KEY idx_megogo_loyalty (issued_loyalty_code, issued_at),
  KEY idx_megogo_last_presented (last_presented_at),
  KEY idx_megogo_order (issued_store_code, issued_workplace_id, issued_order_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Один безпечний технічний код для перевірки контуру правила 843.
-- Він не є кодом MEGOGO та може бути виданий тільки тестовому учаснику,
-- визначеному змінною MEGOGO_TEST_LOYALTY_CODE на сервері.
INSERT IGNORE INTO megogo_code_issuance (campaign_key, code_value)
VALUES ('megogo-843-test', 'TEST-MEGOGO-843-001');
