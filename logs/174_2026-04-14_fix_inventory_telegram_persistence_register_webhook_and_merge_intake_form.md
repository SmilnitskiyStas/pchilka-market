# Task
Виправити практичні проблеми inventory-модуля:
- Telegram settings не давали відчутного результату для користувача;
- `/start` не спрацьовував без реєстрації webhook;
- форма додавання товару і партії була розділена, хоча потрібен один intake-flow.

# Що зроблено
1. Посилено збереження Telegram settings:
- у `lib/inventory-telegram-settings-repository.ts` додано fallback-збереження JSON без `CAST(? AS JSON)` для сумісності з MySQL/MariaDB середовищами.

2. Додано керування webhook з адмінки:
- `lib/inventory-telegram-webhook.ts`;
- `app/api/admin/inventory/webhook/route.ts`;
- у `components/admin/admin-inventory-manager.tsx` додано:
  - завантаження `getWebhookInfo`;
  - показ поточного webhook URL;
  - показ `pending_update_count`;
  - показ `last_error_message`;
  - кнопку `Зареєструвати webhook`.

3. Об'єднано додавання товару і партії:
- додано `app/api/admin/inventory/intake/route.ts`;
- у `components/admin/admin-inventory-manager.tsx` замінено два окремі сценарії на одну форму:
  - дані товару;
  - дані першої партії;
  - один submit `Додати товар і партію`.

# Практичний результат
- після збереження Telegram settings користувач бачить явний статус збереження;
- webhook можна зареєструвати прямо з адмінки, без ручного виклику Telegram API;
- `/start` у Telegram почне працювати тільки після кроку реєстрації webhook;
- intake-flow для inventory тепер відповідає вимозі: товар і партія вносяться однією формою.

# Перевірка
- виконано `npm run typecheck` — без помилок.
