# 129 / 2026-02-18 / refactor_admin_to_content_module_with_articles_and_categories

## Що зроблено
- Перероблено адмін-навігацію:
  - замість пункту `Блог` додано `Контент`.
  - файл: `components/admin/admin-sections.ts`.
- Оновлено підсвітку активного пункту меню для вкладених шляхів.
  - файл: `components/admin/admin-nav.tsx`.

## Новий модуль Контент
- Додано сторінку `app/admin/content/page.tsx`.
- Додано компонент `components/admin/admin-content-manager.tsx`.
- У модулі `Контент` реалізовано дві вкладки:
  - `Статті`
  - `Категорії`

### Вкладка Статті
- Форма створення/редагування статті з полями:
  - блок контенту (`Блог` / `Новини мережі` / `Благодійність`)
  - заголовок
  - slug (авто)
  - короткий опис
  - cover image
  - статус (`чернетка` / `опубліковано`)
- Список статей у компактному розгортаному вигляді (expand/collapse).
- Локальне збереження в localStorage (`admin_content_entries_v1`).
- Додано модель: `lib/content-entries.ts`.

### Вкладка Категорії
- Підключено `components/admin/admin-blog-categories-manager.tsx`.
- Категорії тепер підтримують `contentType` (`blog`/`news`/`charity`).
- При створенні категорії обирається блок контенту.
- Прив'язка статей показує тільки статті обраного блоку.
- Оновлена модель: `lib/blog-categories.ts`.

## Сумісність
- Старий маршрут `app/admin/blog/page.tsx` тепер перенаправляє на `/admin/content`.

## Додатково
- Додано `lib/content-types.ts` для єдиного enum типів контенту.
- Оновлено `components/blog-post-categories.tsx`, щоб на публічному блозі показувати лише категорії типу `blog`.

## Перевірка
- Виконано `npm.cmd run typecheck`.
- Результат: без помилок.
