# Task
Додати окрему таблицю `users` для користувачів Telegram/застосунку з прив'язкою до магазину.

# Що зроблено
1. Оновлено базову SQL-схему:
- у `docs/sql/001_init_schema.sql` додано таблицю `users`.

2. Додано окрему міграцію для існуючих БД:
- створено файл `docs/sql/009_create_users_table.sql`.

# Структура таблиці `users`
- `id`
- `store_id`
- `name`
- `surname`
- `user_chat_id`
- `role`
- `is_active`
- `created_at`
- `updated_at`

# Примітки по схемі
- `store_id` прив'язаний до `stores(id)` через foreign key `fk_users_store`;
- при видаленні магазину `store_id` у користувача стає `NULL` (`ON DELETE SET NULL`);
- `user_chat_id` зроблено унікальним через `uq_users_chat_id`.

# Що запускати в поточній БД
- `docs/sql/009_create_users_table.sql`
