# Task
Почати прикладну реалізацію inventory-модуля: додавання товару та внесення партії по товару з адмінки.

# Що зроблено
1. Додано рівень повідомлень на товар:
- у `products` закладено поле `notified_days_default`;
- оновлено `docs/sql/001_init_schema.sql`;
- оновлено `docs/sql/010_create_products_table.sql`;
- додано `docs/sql/015_add_products_notified_days_default.sql`.

2. Додано доменні типи inventory:
- `lib/inventory-product-types.ts`;
- `lib/inventory-batch-types.ts`.

3. Додано репозиторії:
- `lib/inventory-products-repository.ts`;
- `lib/inventory-batches-repository.ts`.

4. Додано адмінські API:
- `app/api/admin/inventory/products/route.ts`;
- `app/api/admin/inventory/batches/route.ts`.

5. Оновлено `components/admin/admin-inventory-manager.tsx`:
- форма створення товару;
- форма внесення партії;
- завантаження списку товарів, партій і магазинів;
- показ останніх товарів і останніх партій;
- підтримка логіки:
  - якщо для партії `notifiedDays` не задано,
  - береться `products.notified_days_default`.

# Нова логіка повідомлень
- глобальний `Default notified days` у Telegram settings залишається резервним;
- основний рівень налаштування тепер закладається на товарі через `notified_days_default`;
- партія може перевизначати значення власним `notified_days`.

# Що ще не зроблено
- редагування товару та партії;
- фільтри/пошук inventory;
- автоматичне створення `activity_logs` при додаванні партії;
- зв'язування з Telegram update flow.

# Перевірка
- має пройти `npm run typecheck`.
