# Task
Додати таблицю `products`, щоб `product_batches` могла коректно створюватися з foreign key на товари.

# Що зроблено
1. Оновлено базову SQL-схему:
- у `docs/sql/001_init_schema.sql` додано таблицю `products`.

2. Додано SQL-скрипт для поточної БД:
- створено `docs/sql/010_create_products_table.sql`.

# Структура таблиці `products`
- `id`
- `article`
- `barcode`
- `product_name`
- `units_of_measurement`
- `category`
- `is_active`
- `created_at`
- `updated_at`

# Додатково
- `article` зроблено унікальним;
- `barcode` зроблено унікальним;
- додано індекс `idx_products_category_active (category, is_active)`.

# Що запускати в поточній БД
1. `docs/sql/010_create_products_table.sql`
2. після цього `sql_product_batches.txt`
