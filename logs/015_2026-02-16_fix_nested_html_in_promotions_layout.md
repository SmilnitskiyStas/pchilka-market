# 015_2026-02-16_fix_nested_html_in_promotions_layout

## Дата
2026-02-16

## Що зроблено
- Виправлено причину hydration-помилки `In HTML, html cannot be a child of body`.
- У `app/promotions/layout.tsx` прибрано вкладені теги `<html>` і `<body>`, які конфліктували з кореневим `app/layout.tsx`.
- Оновлено layout для секції `promotions` на правильний вкладений формат (повертає тільки `children`).
- Додано metadata для розділу акцій.

## Що потрібно зробити далі
- Перезапустити dev-сервер і перевірити, що помилка в консолі більше не з'являється.
