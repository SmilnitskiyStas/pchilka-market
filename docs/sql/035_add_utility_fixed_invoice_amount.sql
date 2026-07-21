-- Per-meter monthly fixed invoice amounts for services without a unit tariff.
ALTER TABLE utility_meter_rates
  ADD COLUMN calculation_mode ENUM('rate','fixed_amount') NOT NULL DEFAULT 'rate' AFTER includes_vat,
  ADD COLUMN fixed_amount DECIMAL(18,2) NULL AFTER calculation_mode,
  ADD COLUMN invoice_reference VARCHAR(255) NULL AFTER fixed_amount;

ALTER TABLE utility_meter_charges
  ADD COLUMN calculation_mode ENUM('rate','fixed_amount') NOT NULL DEFAULT 'rate' AFTER amount,
  ADD COLUMN fixed_amount DECIMAL(18,2) NULL AFTER calculation_mode,
  ADD COLUMN invoice_reference VARCHAR(255) NULL AFTER fixed_amount;
