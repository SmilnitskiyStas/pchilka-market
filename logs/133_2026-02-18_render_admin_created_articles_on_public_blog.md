# 133 / 2026-02-18 / render_admin_created_articles_on_public_blog

## Що зроблено
- Реалізовано відображення статей, створених у адмінці, у публічному розділі блогу.

### Додані компоненти
- `components/admin-blog-posts-list.tsx`
  - читає статті з localStorage (`admin_content_entries_v1`)
  - показує опубліковані (`status=published`) статті блоку `blog`
  - виключає дублікати static slug
  - відображає категорії статті.
- `components/admin-blog-post-page.tsx`
  - fallback-відображення статті з адмінки за `slug`, якщо її немає у статичних даних
  - базовий markdown-рендер для `body` (h2/h3, списки, параграфи, зображення)
  - підтримка `BlogEngagement`.

### Оновлені сторінки
- `app/blog/page.tsx`
  - збережено статичні статті
  - додано секцію з опублікованими статтями з адмінки.
- `app/blog/[slug]/page.tsx`
  - якщо статичної статті немає, сторінка рендерить fallback з адмінки (`AdminBlogPostPage`).

## Перевірка
- Виконано `npm.cmd run typecheck`.
- Результат: без помилок.

## Примітка
- Поки це працює через localStorage (MVP). Для SSR/продакшену потрібно перенести дані в БД (Supabase) і читати з сервера.
