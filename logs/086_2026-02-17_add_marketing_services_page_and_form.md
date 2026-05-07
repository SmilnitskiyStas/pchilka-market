# 086_2026-02-17_add_marketing_services_page_and_form

## Дата
2026-02-17

## Що зроблено
- Додано сторінку `Співпраця -> Надаємо маркетингові послуги` за маршрутом `/cooperation/marketing-services`.
- Реалізовано читання контенту з `public/img/cooperation/marketing_services.txt`.
- Додано форму `Форма запиту на маркетингові послуги` (`components/cooperation-marketing-services-form.tsx`) з полями:
  - компанія, контактна особа, телефон, email;
  - формат розміщення;
  - бажаний магазин/адреса (де компанія хоче розмістити інформацію);
  - бажаний період розміщення;
  - деталі запиту.
- Заявки форми зберігаються в `localStorage` (ключ `cooperation_marketing_service_requests`, MVP).
- Оновлено підпункт меню `Надаємо маркетингові послуги` у `content/menu.ts`:
  - `href: '/cooperation/marketing-services'` (замість `#`).
- Оновлено документацію:
  - `docs/project_status.md`
  - `docs/site_content.md`
