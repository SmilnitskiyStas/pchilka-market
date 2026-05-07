-- Add default notification lead time on product level.
-- Run for existing databases after 010_create_products_table.sql.

SET NAMES utf8mb4;

ALTER TABLE products
  ADD COLUMN notified_days_default INT NOT NULL DEFAULT 7 AFTER category;
