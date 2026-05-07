# Analytics Events (MVP)

## Джерело конфігурації
- Адмінка: `Admin -> Інтеграції`
- API: `GET/PUT /api/admin/integrations`
- Збереження: `site_settings.setting_key = analytics_settings_v1`
- Runtime loader: `components/analytics-loader.tsx`

## Події, які зараз трекаються

### 1) `feedback_open`
- Коли: відкриття модалки зворотного зв'язку у хедері.
- Де: `components/site-header.tsx`
- Параметри:
- `page_path`

### 2) `contact_phone_click`
- Коли: клік на телефон у випадаючому списку контактів.
- Де: `components/site-header.tsx`
- Параметри:
- `phone_label`
- `page_path`

### 3) `form_submit`
- Коли: успішне збереження заявки (через API у MySQL).
- Де:
- `components/site-header.tsx` (`header_feedback`)
- `components/career-application-form.tsx` (`career_application`)
- `components/cooperation-offer-form.tsx` (`cooperation_offer_general`, `cooperation_offer_product`)
- `components/cooperation-rental-form.tsx` (`cooperation_rental`)
- `components/cooperation-marketing-services-form.tsx` (`cooperation_marketing_services`)
- Параметри:
- `form_name`
- `form_type`
- `has_attachment` (де застосовно)
- `page_path`

## Канали відправки
- GA4 (`gtag('event', ...)`) якщо GA4 підключено.
- GTM (`dataLayer.push({ event, ... })`) якщо GTM підключено.
- Meta Pixel (`fbq('trackCustom', ...)`) якщо Pixel підключено.

## Примітки
- Події відправляються через `lib/analytics-events.ts`.
- Якщо інтеграції вимкнені в адмінці або середовище не співпадає (`prod/dev`), події не відправляються.
