# Task
Підготувати спільний конфіг для inventory web-модуля і Telegram-бота всередині поточного застосунку.

# Що зроблено
1. Додано тип і нормалізацію Telegram-настройок inventory-модуля:
- `lib/inventory-telegram-settings.ts`.

2. Додано repository для збереження налаштувань у `site_settings`:
- `lib/inventory-telegram-settings-repository.ts`.

3. Додано адмінський API для читання та збереження Telegram-конфігурації:
- `app/api/admin/inventory/settings/route.ts`.

4. Оновлено сторінку `Адмінка -> Інвентар`:
- у `components/admin/admin-inventory-manager.tsx` додано форму для:
  - `publicBaseUrl`;
  - `webhookPath`;
  - `botUsername`;
  - `botToken`;
  - `webhookSecret`;
  - `staffChatId`;
  - `adminChatId`;
  - `defaultNotifiedDays`;
  - прапора `enabled`.

5. Додано стартовий webhook endpoint:
- `app/api/inventory/telegram/webhook/route.ts`.

# Поточна поведінка webhook
- endpoint приймає `POST`;
- читає Telegram-настройки з БД;
- перевіряє, чи інтеграція увімкнена;
- перевіряє `x-telegram-bot-api-secret-token`;
- повертає `accepted: true` у scaffold-режимі.

# Для чого це потрібно
- сайт і Telegram отримали спільну конфігурацію;
- більше не треба зберігати bot/webhook параметри окремо від web-модуля;
- наступний етап можна будувати вже на стабільному контракті налаштувань.

# Що ще не реалізовано
- фактична обробка Telegram update payload;
- зіставлення `user_chat_id` з користувачем;
- відправка повідомлень у Telegram;
- callback flow `pending -> action -> note -> completed`;
- escalation `discussion_required -> admin_decision`.

# Перевірка
- має пройти `npm run typecheck`.
