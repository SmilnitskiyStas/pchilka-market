-- Direct utility-electricity contracts for stores.
CREATE TABLE IF NOT EXISTS utility_store_direct_contracts (
  store_id BIGINT UNSIGNED NOT NULL,
  legal_entity VARCHAR(255) NOT NULL,
  electricity_supplier ENUM('yasno','tolk') NULL,
  is_direct_contract TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id),
  CONSTRAINT fk_utility_store_direct_contracts_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
