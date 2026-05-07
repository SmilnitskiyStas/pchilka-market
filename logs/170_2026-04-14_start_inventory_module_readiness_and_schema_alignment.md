# Task
Запустити перший інкремент нового inventory/Telegram-модуля так, щоб він вбудовувався у поточний сайт і спирався на ту саму MySQL-базу.

# Що зроблено
1. Додано новий розділ адмін-панелі `Інвентар`:
- маршрут `app/admin/inventory/page.tsx`;
- компонент `components/admin/admin-inventory-manager.tsx`;
- пункт навігації у `components/admin/admin-sections.ts`.

2. Додано server-side readiness-перевірку БД:
- створено `lib/inventory-schema.ts` з переліком обов'язкових таблиць і колонок;
- створено `lib/inventory-repository.ts` для перевірки наявності inventory-схеми у MySQL;
- створено API `app/api/admin/inventory/readiness/route.ts`.

3. Додано кероване застосування inventory-міграцій з адмінки:
- створено API `app/api/admin/inventory/migrate/route.ts`;
- на сторінку `Інвентар` додано кнопку застосування міграцій для:
  - добудови workflow-полів у `product_batches`;
  - створення `notification_logs`.

4. Вирівняно SQL-документацію під специфікацію inventory/Telegram workflow:
- оновлено `docs/sql/001_init_schema.sql`;
- оновлено `docs/sql/011_create_product_batches_table.sql`;
- додано `docs/sql/013_extend_product_batches_for_inventory_workflow.sql`;
- додано `docs/sql/014_create_notification_logs_table.sql`;
- оновлено `docs/sql/README.md` з рекомендованою послідовністю запуску.

# Що покрито в схемі
- `notification_logs` як журнал вихідних Telegram/system-повідомлень;
- у `product_batches` додано поля для:
  - `discussion_required`;
  - `discussion_note`;
  - `discussion_requested_by_user_id`;
  - `discussion_requested_at`;
  - `admin_decision`;
  - `admin_decision_note`;
  - `admin_decision_by_user_id`;
  - `admin_decision_at`.

# Перевірка
- виконано `npm run typecheck` — без помилок.

# Обмеження / примітки
- readiness-екран читає фактичний стан MySQL через поточний конфіг застосунку;
- раніше перевірка живої БД показала проблему доступу до `DB_NAME`, тому на середовищі з некоректними доступами endpoint показуватиме помилку підключення, а не готовність схеми;
- прикладний CRUD для товарів, партій, логів і Telegram webhook ще не реалізовано на цьому етапі.

# Що далі
1. Додати репозиторії та API для `products` і `product_batches`.
2. Створити базовий web-інтерфейс перегляду/редагування партій в адмінці.
3. Після цього підключити журнал `activity_logs` і `notification_logs`.
4. Окремим етапом додати Telegram webhook/бота і workflow pending -> discussion_required -> completed -> overdue.
