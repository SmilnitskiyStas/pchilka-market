# 140 / 2026-02-19 / move seo runtime from local storage to db api

## Що зроблено
- Переведено `SeoRuntimeLoader` з локального `localStorage` на серверне джерело правил SEO.
- Тепер runtime-застосування title/description/robots/canonical читає правила через API:
  - `GET /api/admin/seo/rules`
- Додано безпечне асинхронне завантаження з `AbortController` при зміні route.
- Збережено поточну логіку застосування тегів у `<head>` і авто-нормалізацію canonical.

## Файли
- `components/seo-runtime-loader.tsx`

## Перевірка
- `npm run typecheck` — успішно.
- `npm run build` — успішно.

## Результат
- SEO runtime використовує єдине серверне джерело (БД через API), узгоджене з адмінкою та sitemap.
