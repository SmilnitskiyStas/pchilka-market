# 158 / 2026-02-23 / fix request attachments render and update docs

## Що зроблено
- Вирівняно upload-флоу вкладень у формах, де файли раніше не завантажувались на сервер:
  - `components/cooperation-search-room-form.tsx`
  - `components/cooperation-marketing-services-form.tsx`
  - `components/cooperation-rental-form.tsx`
  - `components/career-application-form.tsx`
  - `components/site-header.tsx` (модалка зворотного зв'язку)
- У цих формах перед відправкою заявки додається upload через `uploadRequestAttachment(...)`.
- У `metadata.attachment` тепер передається `url` (а також інші метадані), тому адмінка може відкрити файл.
- Розширено `app/api/feedback/route.ts` для збереження `attachment.url` і `attachment.lastModified` в `incoming_requests.metadata_json`.

## Оновлення документації
- Оновлено `docs/project_status.md` (додано актуалізацію стану на 2026-02-23).
- Оновлено `docs/site_content.md` (додано актуалізацію щодо MySQL-заявок і серверних вкладень).
- Оновлено `docs/analytics_events.md` (уточнено, що `form_submit` фіксується після збереження через API у MySQL).
- Оновлено `docs/sql/README.md` (актуалізовано під MySQL).

## Перевірка
- `cmd /c npm run typecheck` — успішно.

## Результат
- Нові заявки з файлами тепер зберігають URL вкладення та коректно відображають/відкриваються в адмінці.
- Документація приведена до актуального стану після міграції заявок у MySQL.

## Що залишилось
- За потреби додати міграційний скрипт/утиліту для старих заявок, які мають лише метадані файлу без `url`.
- За потреби додати очищення старих невикористаних файлів у `uploads/request-attachments`.
