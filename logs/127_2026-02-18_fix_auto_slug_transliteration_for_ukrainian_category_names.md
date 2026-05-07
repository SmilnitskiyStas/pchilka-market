# 127 / 2026-02-18 / fix_auto_slug_transliteration_for_ukrainian_category_names

## Що зроблено
- Оновлено `lib/blog-categories.ts`.
- Додано транслітерацію українських символів у `normalizeCategorySlug`.
- Тепер slug коректно формується з назв українською (наприклад: `Поради покупцям` -> `porady-pokuptsiam`).
- Підтримано заміну специфічних символів (`ь`, апострофи) та нормалізацію дефісів.

## Перевірка
- Виконано `npm.cmd run typecheck`.
- Результат: без помилок.
