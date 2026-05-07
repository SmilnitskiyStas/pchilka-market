# 138 / 2026-02-19 / SEO sitemap controls + .htaccess

## Що зроблено
- Додано серверне збереження SEO-правил у БД через `site_settings` (ключ `seo_rules_v1`).
- Реалізовано API `GET/PUT /api/admin/seo/rules` для читання/збереження правил.
- Оновлено SEO-адмінку:
  - завантаження/збереження правил через API (БД);
  - детальні поля для sitemap: `includeInSitemap`, `changeFrequency`, `priority`;
  - синхронізація локального кешу для runtime SEO loader.
- Додано генерацію `app/sitemap.ts`:
  - джерело маршрутів з SEO-правил;
  - fallback на маршрути з меню;
  - автоматичне виключення `noindex,nofollow` зі sitemap.
- Додано `app/robots.ts` з посиланням на `sitemap.xml`.
- Додано `.htaccess` з базовими SEO/безпековими правилами (canonical host + https, cache headers, deny sensitive files).
- Додано SQL-файл `docs/sql/002_seed_seo_rules_setting.sql` для seed ключа налаштувань SEO.

## Що залишилось
- Підключити SEO runtime/metadata повністю до серверного джерела (щоб не залежати від localStorage).
- Перевірити сценарій на бойовому хостингу Apache/Nginx та адаптувати `.htaccess` під фактичну інфраструктуру.
- Виправити загальну помилку typecheck у проєкті: `Cannot find module 'mysql2/promise'`.
