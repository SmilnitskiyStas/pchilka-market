# 067_2026-02-17_add_image_to_loyalty_about_page

## Дата
2026-02-17

## Що зроблено
- На сторінку `Програма лояльності -> Про програму` додано зображення:
  - файл: `public/img/loyalty_programm/loyalty_for_people.jpg`
- Оновлено `app/loyalty/about/page.tsx`:
  - підключено `next/image`;
  - додано адаптивний блок із зображенням (`aspect-[16/9]`).
- У файлі сторінки також нормалізовано текст і метадані в UTF-8.
