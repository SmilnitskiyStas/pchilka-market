# 078_2026-02-17_add_cooperation_offer_equipment_page_and_form

## Дата
2026-02-17

## Що зроблено
- Додано сторінку `Співпраця -> Запропонувати обладнання` за маршрутом `/cooperation/offer-equipment`.
- Реалізовано читання текстового контенту з файлу `public/img/cooperation/offer_equipment.txt`.
- На сторінці додано форму для звернення щодо співпраці:
  - ПІБ, Компанія, Телефон, Email, Повідомлення, Фото/файл;
  - базова валідація обов'язкових полів;
  - збереження звернень у `localStorage` (ключ `cooperation_offer_requests`) для MVP.
- Оновлено пункт меню `Запропонувати обладнання` у `content/menu.ts`:
  - `href: '/cooperation/offer-equipment'`.
