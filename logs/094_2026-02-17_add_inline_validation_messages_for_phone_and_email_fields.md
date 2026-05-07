# 094_2026-02-17_add_inline_validation_messages_for_phone_and_email_fields

## Дата
2026-02-17

## Що зроблено
- Додано inline-повідомлення про помилки під полями `Телефон` та `Email`, щоб користувач бачив причину неактивної кнопки submit.
- Повідомлення показуються динамічно під час заповнення полів.
- Охоплені форми:
  - `components/cooperation-offer-form.tsx`
  - `components/cooperation-search-room-form.tsx`
  - `components/cooperation-marketing-services-form.tsx`
  - `components/cooperation-rental-form.tsx`
  - `components/career-application-form.tsx`
  - `components/site-header.tsx` (форма зворотного зв'язку)
