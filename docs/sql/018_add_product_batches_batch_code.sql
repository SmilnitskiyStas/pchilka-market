ALTER TABLE product_batches
  ADD COLUMN batch_code VARCHAR(120) NULL AFTER store_id;
