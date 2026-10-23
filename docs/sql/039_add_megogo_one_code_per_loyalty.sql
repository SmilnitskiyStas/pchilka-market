-- Rule 843: one MEGOGO code for one loyalty participant within a campaign.
-- Run the check first. It must return no rows before ALTER TABLE.
SELECT
  campaign_key,
  issued_loyalty_code,
  COUNT(*) AS issued_codes
FROM megogo_code_issuance
WHERE status = 'issued'
  AND issued_loyalty_code IS NOT NULL
GROUP BY campaign_key, issued_loyalty_code
HAVING COUNT(*) > 1;

ALTER TABLE megogo_code_issuance
  ADD UNIQUE KEY uq_megogo_campaign_loyalty (campaign_key, issued_loyalty_code);