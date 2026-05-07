-- Seed site profile and sample stores data for admin/network module.
-- Safe to run multiple times.

SET NAMES utf8mb4;

INSERT INTO site_settings (setting_key, setting_value)
VALUES (
  'site_profile_v1',
  JSON_OBJECT(
    'companyName', 'Pchilka Market',
    'contactPhones', JSON_ARRAY('+38 (067) 341-84-98', '+38 (073) 341-84-98', '+38 (095) 341-84-98'),
    'contactEmail', 'office.manager@legion2015.com',
    'contactAddress', 'м. Київ, проспект Повітряних Сил, 19A/1',
    'contactsPageTitle', 'Контакти',
    'contactsPageLines', JSON_ARRAY(
      'Центральний офіс Pchilka Market',
      'м. Київ, проспект Повітряних Сил, 19A/1',
      'Телефон: +38 (067) 341-84-98',
      'Email: office.manager@legion2015.com'
    ),
    'contactsMapAddress', 'Київ, проспект Повітряних Сил, 19A/1',
    'storesPageTitle', 'Наші магазини',
    'storesPageDescription', 'Актуальний список магазинів Pchilka Market за містами та населеними пунктами.',
    'storesMapEmbedUrl', '',
    'storesMapTitle', 'Карта магазинів Pchilka Market',
    'updatedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ')
  )
)
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO stores (store_code, name, region, city, address_line, phone, work_hours, is_active, sort_order)
SELECT 'M1/1', 'Pchilka Market', 'Київська область', 'м. Київ', 'проспект Повітряних Сил, 19A/1', '+38 (067) 341-84-98', '08:00-22:00', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM stores);
