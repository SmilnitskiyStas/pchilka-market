# Лог виконаних робіт

- Дата: `2026-02-18`
- Номер: `100`
- Назва: `connect_natural_smoking_page_content`

## Що зроблено
- Для розділу `Власне класне` додано підтримку контент-файлів у `content/own-brand.ts`.
- Для `natural-smoking` підключено файл `public/img/own_brand/natural_smoking.txt`.
- Оновлено сторінку `app/own-brand/[slug]/page.tsx`:
  - читання тексту з файлу на сервері;
  - рендер заголовка і абзаців;
  - автоматичне визначення YouTube-посилання та вбудовування відео.
- Оновлено документацію:
  - `docs/site_content.md`;
  - `docs/project_status.md`.

## Перевірка
- `npx tsc --noEmit` — успішно.
