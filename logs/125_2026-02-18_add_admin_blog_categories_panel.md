# 125 / 2026-02-18 / add_admin_blog_categories_panel

## Що зроблено
- Створено новий модуль категорій блогу:
  - `components/admin/admin-blog-categories-manager.tsx`
- Додано модель і storage-шар для категорій:
  - `lib/blog-categories.ts`
  - тип `BlogCategory`
  - `load/save` у localStorage (`admin_blog_categories_v1`)
  - нормалізація slug і дефолтні категорії
- Оновлено сторінку адмінки блогу:
  - `app/admin/blog/page.tsx` тепер рендерить менеджер категорій замість заглушки.

## Функціонал панелі
- CRUD категорій блогу:
  - назва
  - slug
  - опис
  - статус active/inactive
  - sort order
- Прив'язка статей до категорій (checkbox список по `content/blog.ts`).
- Валідації:
  - slug не порожній
  - slug унікальний
  - sort order — число
- Список збережених категорій з редагуванням/видаленням.
- Блок "Макет даних для БД" (готовність до перенесення в Supabase).

## Перевірка
- Виконано `npm.cmd run typecheck`.
- Результат: без помилок.

## Що залишилось
- Підключити категорії до публічної сторінки блогу (фільтр/маркування карток).
- Перенести дані категорій з localStorage у БД.
