-- Seed SEO rules settings key (optional)
-- Keeps JSON structure ready for admin SEO manager and sitemap generation.

INSERT INTO site_settings (setting_key, setting_value)
SELECT 'seo_rules_v1', CAST('[]' AS JSON)
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE setting_key = 'seo_rules_v1'
);
