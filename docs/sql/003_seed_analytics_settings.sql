-- Seed analytics settings key (optional)
-- Used by Admin -> Integrations and runtime analytics loader.

INSERT INTO site_settings (setting_key, setting_value)
SELECT 'analytics_settings_v1', CAST('{"enabled": false, "environment": "prod", "ga4MeasurementId": "", "gtmContainerId": "", "metaPixelId": "", "updatedAt": ""}' AS JSON)
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE setting_key = 'analytics_settings_v1'
);
