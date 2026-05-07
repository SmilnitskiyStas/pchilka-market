# Task
Виправити 3 проблеми в адмін-блоці Контент:
1) категорії не оновлюються в "Статті" без reload;
2) у модалці вибору зображення частина карток показувалась білою;
3) підтримати категорію для кількох блоків контенту (blog/news/charity).

# Що зроблено
1. Live-синхронізація категорій у вкладці "Статті"
- `components/admin/admin-content-manager.tsx`
- Додано refresh payload при переході на вкладку `articles`, щоб нові категорії/статті підтягувались без перезавантаження сторінки.

2. Виправлення завантаження/прев’ю зображень
- `app/api/admin/images/route.ts`
  - GET тепер повертає `{ ok: true, images }`.
  - Додано POST upload файлу в `public/img/uploads` з поверненням `{ ok: true, path }`.
- `components/admin/admin-content-manager.tsx`
  - "Завантажити файл" для cover тепер вантажить файл на сервер (не base64 у local state).
  - Для прев’ю шляхи кодуються через `encodeURI(...)`, щоб коректно рендерити файли з пробілами/кирилицею.

3. Категорія для декількох блоків контенту
- `lib/blog-categories.ts`
  - Додано `contentTypes?: ContentType[]` (з backward-compatible `contentType`).
  - Додано helper: `getCategoryContentTypes`, `categorySupportsContentType`.
- `components/admin/admin-blog-categories-manager.tsx`
  - Замість single-select блоку контенту додано multi-select (checkboxes).
  - Прив’язка статей фільтрується по вибраних блоках.
  - Валідація дублікатів slug враховує перетин по кількох блоках.
  - Синхронізація `postSlugs -> categoryIds` для статей тепер враховує multi-block категорії.
- `components/admin/admin-content-manager.tsx`
  - Вибір доступних категорій у формі статті переведено на `categorySupportsContentType(...)`.
- `app/api/admin/blog/content/route.ts`
  - Серверна валідація категорій оновлена під multi-block.
- `components/blog-post-categories.tsx`
- `components/admin-blog-posts-list.tsx`
- `components/admin-blog-post-page.tsx`
  - Оновлено фільтри категорій під multi-block.

# Результат
- Категорії в "Статті" оновлюються без reload.
- Завантажені зображення для cover зберігаються як серверні файли та коректно рендеряться в модалці.
- Одна категорія може використовуватись для декількох блоків контенту.

# Перевірка
- `cmd /c npm run typecheck` -> success

