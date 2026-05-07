# 139 / 2026-02-19 / analytics config via admin + events documentation

## Що зроблено
- Додано серверне джерело конфігурації аналітики через `site_settings`:
  - `lib/integrations-settings.ts`
  - `lib/integrations-repository.ts`
  - `app/api/admin/integrations/route.ts` (`GET/PUT`)
- Оновлено адмін-модуль інтеграцій для роботи через API/БД:
  - `components/admin/admin-integrations-manager.tsx`
  - прибрано залежність від `localStorage` як єдиного джерела.
- Оновлено runtime-підключення аналітики:
  - `components/analytics-loader.tsx`
  - завантажує налаштування з API і вмикає GA4/GTM/Meta Pixel за умовами `enabled` + `environment`.
- Додано базовий трекінг подій:
  - `lib/analytics-events.ts` (уніфікований helper для `gtag`, `dataLayer`, `fbq`).
  - `components/site-header.tsx`: `feedback_open`, `contact_phone_click`, `form_submit`.
  - `components/career-application-form.tsx`: `form_submit`.
  - `components/cooperation-offer-form.tsx`: `form_submit`.
  - `components/cooperation-rental-form.tsx`: `form_submit`.
  - `components/cooperation-marketing-services-form.tsx`: `form_submit`.
- Документовано події:
  - `docs/analytics_events.md`.
- Додано SQL seed для ключа налаштувань аналітики:
  - `docs/sql/003_seed_analytics_settings.sql`.

## Перевірка
- `npm run typecheck` — успішно.
- `npm run build` — успішно.

## Що залишилось
- За потреби розширити набір подій для каталогу/блогу (кліки, скрол, engagement).
- За потреби додати серверний endpoint для відправки conversion-подій у бекенд/CRM.
