-- Rule 843: preserve the first issue date and record the most recent receipt display.
ALTER TABLE megogo_code_issuance
  ADD COLUMN last_presented_at DATETIME NULL AFTER issued_at,
  ADD KEY idx_megogo_last_presented (last_presented_at);

-- Existing issued codes were first and last known to be shown at issued_at.
UPDATE megogo_code_issuance
SET last_presented_at = issued_at
WHERE status = 'issued'
  AND issued_at IS NOT NULL
  AND last_presented_at IS NULL;