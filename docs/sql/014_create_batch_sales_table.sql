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
