# 192. Fix inventory registration ambiguous id

Дата: 2026-04-27

## Проблема

Після реєстрації inventory/Telegram-користувача запис успішно додавався в таблицю `users`, але API повертав помилку:

`Column 'id' in where clause is ambiguous`

Причина: після `INSERT INTO users` виконувався `SELECT` з `LEFT JOIN stores`, де умова була `WHERE id = ?`. Поле `id` є і в `users`, і в `stores`, тому MySQL не міг визначити потрібну таблицю.

## Зроблено

- У `lib/inventory-users-repository.ts` в запиті читання щойно створеного користувача замінено `WHERE id = ?` на `WHERE u.id = ?`.
- Перевірено інші запити цього файлу з `LEFT JOIN stores`: решта умов для joined-запитів вже використовують `u.id`.

## Перевірка

- `cmd /c npm run build` - успішно.

## Залишилось

- За потреби повторно пройти реєстрацію через Telegram-посилання у браузері та переконатися, що після натискання кнопки показується успішний статус, а не DB-помилка.
