# Task
Додати таблицю `activity_logs` для збереження логів дій по товарах і партіях у магазинах.

# Що зроблено
1. Оновлено базову SQL-схему:
- у `docs/sql/001_init_schema.sql` додано таблиці `product_batches` і `activity_logs` у взаємоузгодженому вигляді.

2. Додано SQL-скрипт для поточної БД:
- створено `docs/sql/011_create_activity_logs_table.sql`.

# Структура таблиці `activity_logs`
- `id`
- `user_id`
- `batch_id`
- `product_id`
- `store_id`
- `action_type`
- `comment`
- `old_quantity`
- `new_quantity`
- `old_expiry_date`
- `new_expiry_date`
- `created_at`
- `updated_at`

# Примітки
- уточнено поле `action_type` замість помилково повтореного `store_id`;
- таблиця посилається на `users`, `product_batches`, `products`, `stores`;
- для існуючої БД перед створенням `activity_logs` мають уже існувати `products`, `stores`, `users`, `product_batches`.

# Що запускати в поточній БД
1. `docs/sql/010_create_products_table.sql`
2. `sql_product_batches.txt`
3. `docs/sql/012_create_activity_logs_table.sql`
