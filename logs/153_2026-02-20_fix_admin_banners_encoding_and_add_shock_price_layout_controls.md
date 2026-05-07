# 153 — Виправлення кодування Адмін/Банери + керування відображенням Шок ціна

## Що зроблено
- Виправлено кодування текстів у модулі банерів:
  - `app/admin/banners/page.tsx`
  - `components/admin/admin-banners-manager.tsx`
- Додано налаштування сторінки `Шок ціна` (через БД):
  - `lib/shock-price-settings.ts`
  - `lib/shock-price-settings-repository.ts`
  - `app/api/admin/shock-price/settings/route.ts`
- Розширено адмінку акцій блоком керування `Шок ціна`:
  - `components/admin/admin-promotions-manager.tsx`
  - Параметри:
    - колонки для mobile/tablet/desktop;
    - максимум карток (0 = без ліміту);
    - порядок відображення (новіші/старіші/за назвою).
- Оновлено публічну сторінку `Шок ціна` для застосування налаштувань:
  - `app/promotions/shock-price/page.tsx`
  - `components/shock-price-gallery.tsx`
  - Галерея тепер рендериться динамічно за кількістю колонок і підтримує довільну кількість карток.

## Перевірка
- `npm run typecheck` — успішно.

## Що важливо
- Джерело зображень для `Шок ціна` залишилось тим самим: `public/img/shock_price`.
- Адмінка керує саме відображенням (сітка, порядок, ліміт), що вирішує сценарій з різною кількістю зображень.
