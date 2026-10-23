# Локальний архів продажів

Архів розміщений локально на диску `D:` у каталозі `D:\PchilkaPosAnalytics\mysql`.
Він працює в контейнері Docker `pchilka-local-pos-analytics` і не відкритий в інтернет.

## Підключення на цьому комп’ютері

| Параметр | Значення |
| --- | --- |
| Хост | `127.0.0.1` |
| Порт | `3307` |
| База даних | `pchilka_pos_analytics` |
| Користувач | `pos_analytics` |
| Пароль | `MYSQL_PASSWORD` з локального файлу `.env.local-pos-archive` |

У DBeaver створіть підключення **MySQL**, внесіть ці параметри і завантажте пароль з локального файлу. Не передавайте файл з паролями через Git або месенджери.

## Вміст

- `pos_orders` — чеки / операції продажу;
- `pos_order_items` — товарні рядки чеків;
- `pos_order_payments` — оплати;
- `pos_products`, `pos_product_groups`, `pos_product_barcodes` — довідник товарів;
- `pos_shops`, `pos_warehouses`, `pos_shop_warehouses` — магазини та їх зв’язок зі складами;
- `pos_units` — одиниці виміру;
- `pos_dealer_prices` — поточні ціни та індикативи;
- `pos_sync_days` — контроль повноти завантажених днів.

Для додавання нового періоду використовуйте:

```powershell
node scripts\archive-pos-to-local-mysql.mjs --from YYYY-MM-DD --to YYYY-MM-DD
```

Повторний запуск не дублює завершені дні.
