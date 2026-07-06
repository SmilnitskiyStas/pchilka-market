# SQL Notes

This folder contains MySQL SQL scripts for the current project.

Naming rule:
`number_short-action-name.sql`

Example:
`001_init_schema.sql`

Inventory / Telegram workflow sequence for existing databases:
- `009_create_users_table.sql`
- `016_add_users_position_title.sql`
- `010_create_products_table.sql`
- `015_add_products_notified_days_default.sql`
- `011_create_product_batches_table.sql`
- `012_create_activity_logs_table.sql`
- `013_extend_product_batches_for_inventory_workflow.sql`
- `014_create_notification_logs_table.sql`
- `017_add_product_batches_responsible_user.sql`
- `018_add_product_batches_batch_code.sql`
- `031_enable_fefo_sales_import.sql`
- `032_add_product_fefo_tracking_flag.sql`
