-- Add store_code and region fields to stores.
-- Compatible with older MySQL versions that do not support
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

SET NAMES utf8mb4;

SET @store_code_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stores'
    AND column_name = 'store_code'
);

SET @store_code_column_sql := IF(
  @store_code_column_exists = 0,
  'ALTER TABLE stores ADD COLUMN store_code VARCHAR(64) NULL AFTER id',
  'SELECT 1'
);

PREPARE stmt FROM @store_code_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @region_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'stores'
    AND column_name = 'region'
);

SET @region_column_sql := IF(
  @region_column_exists = 0,
  'ALTER TABLE stores ADD COLUMN region VARCHAR(120) NULL AFTER name',
  'SELECT 1'
);

PREPARE stmt FROM @region_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @store_code_index_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'stores'
    AND index_name = 'uq_stores_store_code'
);

SET @store_code_index_sql := IF(
  @store_code_index_exists = 0,
  'ALTER TABLE stores ADD UNIQUE KEY uq_stores_store_code (store_code)',
  'SELECT 1'
);

PREPARE stmt FROM @store_code_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
