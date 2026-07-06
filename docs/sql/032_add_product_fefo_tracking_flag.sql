SET NAMES utf8mb4;

SET @has_fefo_tracking_column := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'products'
    AND column_name = 'fefo_tracking_enabled'
);

SET @add_fefo_tracking_column_sql := IF(
  @has_fefo_tracking_column = 0,
  'ALTER TABLE products ADD COLUMN fefo_tracking_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active',
  'SELECT ''fefo_tracking_enabled already exists'' AS message'
);

PREPARE add_fefo_tracking_column_stmt FROM @add_fefo_tracking_column_sql;
EXECUTE add_fefo_tracking_column_stmt;
DEALLOCATE PREPARE add_fefo_tracking_column_stmt;

SET @has_fefo_tracking_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'products'
    AND index_name = 'idx_products_fefo_tracking'
);

SET @add_fefo_tracking_index_sql := IF(
  @has_fefo_tracking_index = 0,
  'ALTER TABLE products ADD INDEX idx_products_fefo_tracking (fefo_tracking_enabled), ALGORITHM=INPLACE, LOCK=NONE',
  'SELECT ''idx_products_fefo_tracking already exists'' AS message'
);

PREPARE add_fefo_tracking_index_stmt FROM @add_fefo_tracking_index_sql;
EXECUTE add_fefo_tracking_index_stmt;
DEALLOCATE PREPARE add_fefo_tracking_index_stmt;
