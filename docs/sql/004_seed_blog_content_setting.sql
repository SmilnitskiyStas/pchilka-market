-- Seed blog content settings key (optional)
-- Stores admin-managed blog entries and categories in server DB JSON.

INSERT INTO site_settings (setting_key, setting_value)
SELECT 'blog_content_v1', CAST('{"entries": [], "categories": []}' AS JSON)
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings WHERE setting_key = 'blog_content_v1'
);
