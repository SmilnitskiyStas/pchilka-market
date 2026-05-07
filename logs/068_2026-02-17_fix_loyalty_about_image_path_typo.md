# 068_2026-02-17_fix_loyalty_about_image_path_typo

## Дата
2026-02-17

## Що зроблено
- Виправлено шлях до зображення на сторінці `Програма лояльності -> Про програму`.
- Причина проблеми: у файловій системі папка має назву `public/img/loyalry_programm/`, а в коді було `loyalty_programm`.
- Оновлено `app/loyalty/about/page.tsx`:
  - `src` змінено на `/img/loyalry_programm/loyalty_for_people.jpg`.
