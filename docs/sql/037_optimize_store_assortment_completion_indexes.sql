-- Прискорює заповненість магазину: план асортименту × товари, внесені працівниками.
-- Безпечний повторний запуск: індекси створюються лише якщо їх ще немає.

SET @schema_name = DATABASE();

SET @has_index = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'product_batches'
    AND index_name = 'idx_product_batches_store_product'
);
SET @sql = IF(
  @has_index = 0,
  'ALTER TABLE product_batches ADD INDEX idx_product_batches_store_product (store_id, product_id)',
  'SELECT ''idx_product_batches_store_product already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @schema_name
    AND table_name = 'store_inventory_assortment'
    AND index_name = 'idx_store_inventory_assortment_store_present_product'
);
SET @sql = IF(
  @has_index = 0,
  'ALTER TABLE store_inventory_assortment ADD INDEX idx_store_inventory_assortment_store_present_product (store_id, is_present, product_id)',
  'SELECT ''idx_store_inventory_assortment_store_present_product already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
