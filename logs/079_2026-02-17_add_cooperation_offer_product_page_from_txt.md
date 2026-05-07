# 079_2026-02-17_add_cooperation_offer_product_page_from_txt

## Дата
2026-02-17

## Що зроблено
- Додано сторінку `Співпраця -> Запропонувати товар` за маршрутом `/cooperation/offer-product`.
- Реалізовано читання текстового контенту з файлу `public/img/cooperation/offer_product.txt`.
- Для email-адрес у тексті додано автоматичне перетворення в клікабельні `mailto:` посилання.
- На сторінку підключено наявну форму звернення щодо співпраці (`CooperationOfferForm`) з MVP-збереженням у `localStorage`.
- Оновлено пункт меню `Запропонувати товар` у `content/menu.ts`:
  - `href: '/cooperation/offer-product'` (замість `#`).
- Оновлено документацію:
  - `docs/project_status.md`
  - `docs/site_content.md`
