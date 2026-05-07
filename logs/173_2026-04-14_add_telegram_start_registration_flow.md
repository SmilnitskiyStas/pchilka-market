# Task
Зв'язати Telegram `/start` з веб-реєстрацією користувача inventory-модуля через перевірку `user_chat_id` у MySQL.

# Що зроблено
1. Додано repository для користувачів inventory:
- `lib/inventory-users-repository.ts`;
- підтримано пошук по `user_chat_id`;
- додано створення користувача в таблиці `users`.

2. Додано signed token для реєстрації:
- `lib/inventory-registration-token.ts`;
- токен містить `chatId`, дані Telegram користувача і час життя.

3. Додано Telegram bot flow:
- `lib/inventory-telegram-bot.ts`;
- при `/start` система:
  - перевіряє, чи існує користувач з таким `user_chat_id`;
  - якщо існує — повідомляє, що повторна реєстрація не потрібна;
  - якщо не існує — генерує посилання на веб-реєстрацію і надсилає його в Telegram.

4. Оновлено webhook:
- `app/api/inventory/telegram/webhook/route.ts`;
- scaffold-режим замінено на обробку Telegram update для `/start`.

5. Додано web-реєстрацію:
- `app/inventory/register/page.tsx`;
- `app/api/inventory/register/context/route.ts`;
- `app/api/inventory/register/complete/route.ts`.

# Логіка перевірки дубля
- перевірка наявності користувача по `user_chat_id` виконується:
  - при `/start` у Telegram;
  - при відкритті сторінки реєстрації;
  - повторно безпосередньо перед створенням користувача.

# Що ще не зроблено
- після успішної реєстрації бот ще не надсилає follow-up меню/кнопки;
- немає сценарію подальшої роботи користувача після реєстрації;
- не реалізовано callback flow по кейсах і партіях.

# Перевірка
- має пройти `npm run typecheck`.
