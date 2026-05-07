# Task
Додати до таблиці магазинів поле коду магазину для інтеграції з Telegram-застосунком і поле регіону, зберігши керування активністю магазину через сайт.

# Що зроблено
1. Розширено модель магазинів:
- у `lib/store-types.ts` додано поля `storeCode` та `region`;
- нормалізація магазинів оновлена для нових полів.

2. Оновлено MySQL-репозиторій магазинів:
- у `lib/stores-repository.ts` читання з таблиці `stores` тепер повертає `id`, `storeCode`, `region`, `isActive` та інші поля;
- запис у БД тепер зберігає `store_code` і `region`.

3. Оновлено SQL-схему та міграцію:
- у `docs/sql/001_init_schema.sql` таблиця `stores` тепер містить поля `store_code` і `region`;
- додано унікальний індекс `uq_stores_store_code` для `store_code`;
- створено міграцію `docs/sql/008_add_store_code_region_fields.sql` для вже існуючих баз;
- оновлено seed `docs/sql/005_seed_site_profile_and_stores.sql`.

4. Оновлено адмінку мережі:
- у `components/admin/admin-network-manager.tsx` додано поля редагування `Код магазину (M1/1)` та `Регіон`;
- статус активності магазину залишився в існуючому полі `Активний`.

# Технічна перевірка
- `cmd /c npm run typecheck` -> success

# Примітки
- Поле активності вже існувало в системі як `is_active`, тому повторно його додавати в схему не знадобилося.
- Для існуючої БД потрібно виконати `docs/sql/008_add_store_code_region_fields.sql`.
