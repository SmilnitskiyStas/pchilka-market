# 085_2026-02-17_fix_right_aligned_submit_buttons_in_cooperation_forms

## Дата
2026-02-17

## Що зроблено
- Виправлено вирівнювання submit-кнопок у формах розділу `Співпраця`.
- Причина: при відсутності статусного повідомлення `justify-between` не зсував одиночну кнопку вправо.
- Рішення: додано `ml-auto` для кнопки і `mr-auto` для повідомлення у:
  - `components/cooperation-offer-form.tsx`
  - `components/cooperation-search-room-form.tsx`
- Тепер кнопка стабільно відображається справа у всіх формах.
