# 141 / 2026-02-19 / server crud for banners promotions blog modules

## Що зроблено
- Додано серверний CRUD для банерів:
  - `lib/banners-repository.ts`
  - `app/api/admin/banners/route.ts`
  - `components/admin/admin-banners-manager.tsx` переведено на API/БД.
- Додано серверний CRUD для акцій:
  - `lib/promotion-types.ts`
  - `lib/promotions-repository.ts`
  - `app/api/admin/promotions/route.ts`
  - новий UI модуль `components/admin/admin-promotions-manager.tsx`
  - `app/admin/promotions/page.tsx` переведено з placeholder на реальний менеджер.
- Додано серверне збереження блогу (статті + категорії) через `site_settings`:
  - `lib/blog-content-repository.ts`
  - `lib/blog-content-client.ts`
  - `app/api/admin/blog/content/route.ts`
  - `components/admin/admin-content-manager.tsx` переведено на API/БД.
  - `components/admin/admin-blog-categories-manager.tsx` переведено на API/БД.
  - `components/admin-blog-posts-list.tsx` та `components/admin-blog-post-page.tsx` тепер читають дані з API.
- Публічний home банер тепер бере дані з БД (з fallback на статичні):
  - `app/page.tsx`.

## SQL / налаштування
- Додано seed для блогу в `site_settings`:
  - `docs/sql/004_seed_blog_content_setting.sql`

## Перевірка
- `npm run typecheck` — успішно.
- `npm run build` — успішно.

## Результат
- Модулі `банери`, `акції`, `блог` працюють через серверний CRUD і більше не залежать від локальних тимчасових збережень у браузері.
