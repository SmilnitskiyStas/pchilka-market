# 093_2026-02-17_enforce_phone_input_and_email_validation_in_forms

## Дата
2026-02-17

## Що зроблено
- Посилено валідацію полів `Телефон` у формах:
  - додано фільтрацію вводу (без літер, тільки телефонні символи);
  - додано `inputMode="tel"` для кращого UX на мобільних;
  - залишено перевірку 10-15 цифр.
- Посилено перевірку `Email`:
  - замість перевірки на непорожнє значення застосовано regex-валидацію формату.
- Зміни внесено у форми:
  - `components/cooperation-offer-form.tsx`
  - `components/cooperation-search-room-form.tsx`
  - `components/cooperation-marketing-services-form.tsx`
  - `components/cooperation-rental-form.tsx`
  - `components/career-application-form.tsx`
  - `components/site-header.tsx` (форма зворотного зв’язку)
- Оновлено `docs/project_status.md`.
