-- Optimize product catalog list queries without changing stored data.
-- Safe to run more than once: every index is created only when it is absent.
-- For large production tables, run during a quiet period and monitor DB load.

SET @schema_name = DATABASE();

SET @has_index = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'products'
    AND index_name = 'idx_products_list_order'
);
SET @sql = IF(
  @has_index = 0,
  'ALTER TABLE products ADD INDEX idx_products_list_order (product_name, id), ALGORITHM=INPLACE, LOCK=NONE',
  'SELECT ''idx_products_list_order already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'products'
    AND index_name = 'idx_products_category_name_id'
);
SET @sql = IF(
  @has_index = 0,
  'ALTER TABLE products ADD INDEX idx_products_category_name_id (category, product_name, id), ALGORITHM=INPLACE, LOCK=NONE',
  'SELECT ''idx_products_category_name_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'product_barcodes'
    AND index_name = 'idx_product_barcodes_product_order'
);
SET @sql = IF(
  @has_index = 0,
  'ALTER TABLE product_barcodes ADD INDEX idx_product_barcodes_product_order (product_id, id), ALGORITHM=INPLACE, LOCK=NONE',
  'SELECT ''idx_product_barcodes_product_order already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
