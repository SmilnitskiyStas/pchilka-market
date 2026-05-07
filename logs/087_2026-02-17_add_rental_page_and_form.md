# 087_2026-02-17_add_rental_page_and_form

## Дата
2026-02-17

## Що зроблено
- Додано сторінку `Співпраця -> Пропонуємо в оренду` за маршрутом `/cooperation/rental`.
- Реалізовано читання контенту з `public/img/cooperation/we_offer_rental.txt`.
- На сторінці зроблено клікабельні контакти менеджера:
  - email через `mailto:`
  - телефон через `tel:`
- Додано форму `Форма запиту на оренду` (`components/cooperation-rental-form.tsx`) з полями:
  - компанія, контактна особа, телефон, email;
  - бажаний магазин/адреса;
  - необхідна площа;
  - ціль оренди;
  - період і деталі запиту.
- Заявки форми зберігаються в `localStorage` (ключ `cooperation_rental_requests`, MVP).
- Оновлено підпункт меню `Пропонуємо в оренду` у `content/menu.ts`:
  - `href: '/cooperation/rental'` (замість `#`).
- Оновлено документацію:
  - `docs/project_status.md`
  - `docs/site_content.md`
