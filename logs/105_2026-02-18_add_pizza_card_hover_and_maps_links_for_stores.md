# Лог виконаних робіт

- Дата: `2026-02-18`
- Номер: `105`
- Назва: `add_pizza_card_hover_and_maps_links_for_stores`

## Що зроблено
- Оновлено `components/pizza-menu-grid.tsx`:
  - додано hover-ефект збільшення картки піци при наведенні.
- Оновлено `app/own-brand/[slug]/page.tsx` для `/own-brand/pizza-coffeehouse`:
  - адреси магазинів зроблено клікабельними;
  - додано посилання на Google Maps для побудови маршруту;
  - використано `ConfirmDirectionsLink` для підтвердження перед переходом.
- Оновлено документацію:
  - `docs/site_content.md`;
  - `docs/project_status.md`.

## Перевірка
- `npx tsc --noEmit` — успішно.
