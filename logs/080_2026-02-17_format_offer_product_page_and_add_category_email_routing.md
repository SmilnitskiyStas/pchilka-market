# 080_2026-02-17_format_offer_product_page_and_add_category_email_routing

## Дата
2026-02-17

## Що зроблено
- Перероблено сторінку `/cooperation/offer-product` для кращої читабельності:
  - вступний текст відображається окремим блоком;
  - контакти менеджерів показуються картками за категоріями;
  - додано окремий інформаційний блок для повідомлення Службі безпеки.
- Оновлено форму співпраці `CooperationOfferForm`:
  - додано режим `product` з обов'язковим вибором категорії;
  - додано список категорій та показ email одержувача;
  - після submit формується `mailto:`-лист на email менеджера обраної категорії;
  - дані звернення також зберігаються в `localStorage` (MVP).
- Для `/cooperation/offer-product` підключено форму в режимі `product`:
  - `storageKey: cooperation_offer_product_requests`;
  - кнопка `Сформувати лист`.
- Оновлено документацію:
  - `docs/project_status.md`
  - `docs/site_content.md`
