# 083_2026-02-17_add_search_room_page_and_room_offer_form

## Дата
2026-02-17

## Що зроблено
- Додано сторінку `Співпраця -> Шукаємо приміщення` за маршрутом `/cooperation/search-room`.
- Реалізовано читання контенту з файлу `public/img/cooperation/search_room.txt`.
- На сторінці ключові вимоги до об'єктів винесено у візуальні картки з hover-ефектом.
- Додано форму `Форма пропозиції приміщення` (`components/cooperation-search-room-form.tsx`) з полями:
  - ПІБ, телефон, email;
  - місто/населений пункт, адреса;
  - тип приміщення;
  - діапазон квадратури;
  - наявність паркомісць;
  - приблизна кількість паркомісць;
  - коментар.
- Збереження заявок реалізовано в `localStorage` (ключ `cooperation_search_room_requests`, MVP).
- Оновлено меню `Співпраця -> Шукаємо приміщення` у `content/menu.ts`:
  - `href: '/cooperation/search-room'` (замість `#`).
- Оновлено документацію:
  - `docs/project_status.md`
  - `docs/site_content.md`
