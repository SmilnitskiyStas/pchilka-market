# 207. Simplify Telegram /start to single intake button

Дата: 2026-04-28

## Зроблено

- Оновлено `lib/inventory-telegram-bot.ts`.
- Для зареєстрованого користувача команда `/start` більше не надсилає два окремі посилання.
- Прибрано посилання на `/inventory/manage`.
- Залишено тільки перехід до `/inventory/intake`.
- Перехід тепер оформлено як Telegram inline button:
  - текст кнопки: `Додати товар`;
  - URL: token-protected сторінка внесення товару.

## Результат

- Повідомлення в Telegram стало компактнішим.
- Користувач бачить одну основну дію без дублювання посилань.

## Перевірка

- `cmd /c npm run build` - успішно.
