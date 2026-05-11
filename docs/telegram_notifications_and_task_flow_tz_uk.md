# ТЗ — Telegram Notification Flow + Task Management System

---

# 1. Основна концепція

Telegram повинен використовуватись не як основний інтерфейс роботи, а як:

- система сповіщень
- система швидкого переходу до задач
- система контролю відкриття повідомлень
- система нагадувань

Основна робота працівника повинна виконуватись через Web App.

---

# 2. Основна логіка роботи

# 2.1 Загальний процес

## Крок 1

Система автоматично аналізує:

- терміни придатності
- ризик списання
- FEFO ризики
- залишки товару
- невиконані задачі
- проблемні партії

---

## Крок 2

Система створює задачі:

- expiry_check
- fefo_check
- quantity_check
- writeoff_check
- manager_review
- shelf_check

---

## Крок 3

Система групує задачі по:

- користувачу
- магазину
- пріоритету

---

## Крок 4

Система відправляє Telegram повідомлення.

---

## Крок 5

Працівник відкриває Web App через посилання.

---

## Крок 6

Працівник виконує задачі.

---

## Крок 7

Система оновлює статуси задач.

---

# 3. Telegram повідомлення

# 3.1 Основна задача Telegram

Telegram НЕ повинен бути місцем виконання задач.

Telegram повинен:

- повідомляти про нові задачі
- показувати коротку інформацію
- відкривати Web App
- нагадувати про критичні задачі

---

# 3.2 Формат повідомлення

## Приклад

```text
🔔 Є задачі на перевірку товару

Магазин: M6

Критичні задачі: 3
До 3 днів: 7
FEFO перевірка: 4

Натисніть кнопку нижче для відкриття задач.
```

---

# 3.3 Telegram кнопка

Кнопка:

```text
Відкрити задачі
```

---

# 3.4 Deep Link

Telegram повідомлення повинно містити deep link.

Приклад:

```text
https://site.com/tasks/today?notificationId=123&token=abc123
```

---

# 3.5 Вимоги до token

Token повинен:

- бути одноразовим або тимчасовим
- мати expiration time
- бути прив'язаним до користувача
- бути захищеним

---

# 4. Логіка відкриття повідомлення

# 4.1 Після натискання кнопки

Backend повинен:

1. Перевірити token
2. Перевірити користувача
3. Знайти notification_log
4. Позначити повідомлення як opened
5. Відкрити список задач користувача

---

# 4.2 Notification Status Flow

```text
created
↓
sent
↓
opened
↓
completed
```

---

# 5. Notification Logs

# 5.1 Призначення

Таблиця notification_logs повинна:

- зберігати історію повідомлень
- контролювати відкриття повідомлень
- контролювати виконання задач
- дозволяти аналітику персоналу

---

# 5.2 Рекомендовані нові поля

```sql
ALTER TABLE notification_logs
ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'created',
ADD COLUMN opened_at DATETIME NULL,
ADD COLUMN opened_by_user_id BIGINT UNSIGNED NULL,
ADD COLUMN related_task_count INT NULL,
ADD COLUMN payload_json JSON NULL,
ADD COLUMN token VARCHAR(255) NULL,
ADD COLUMN expires_at DATETIME NULL;
```

---

# 5.3 Notification statuses

## Рекомендовані статуси

```text
created
sent
failed
opened
expired
completed
```

---

# 6. Web App — Основна робота

# 6.1 Основний принцип

Всі задачі повинні виконуватись тільки через Web App.

---

# 6.2 Після відкриття Web App

Користувач повинен бачити:

- список задач
- пріоритет задач
- критичність
- інформацію про товар
- кількість
- термін придатності
- FEFO проблеми

---

# 6.3 Основний екран

# Мої задачі

Приклад:

```text
1. Молоко 1л — термін завтра — критично
2. Йогурт — перевірити FEFO
3. Сир — кількість не сходиться
4. Кефір — підозра на списання
```

---

# 7. Логіка задач

# 7.1 Типи задач

```text
expiry_check
fefo_check
quantity_check
writeoff_check
manager_review
shelf_check
```

---

# 7.2 Пріоритети задач

```text
low
medium
high
critical
```

---

# 7.3 Статуси задач

```text
pending
in_progress
checked_ok
completed
cancelled

fefo_violation
quantity_mismatch
writeoff_required
manager_review
```

---

# 8. Виконання задачі

# 8.1 Працівник повинен мати можливість:

- вказати фактичну кількість
- вказати стан товару
- вказати FEFO статус
- додати фото
- додати коментар
- змінити статус задачі

---

# 8.2 Варіанти стану товару

```text
Норма
Пошкоджений
Викладено частково
Відсутній на полиці
Партії перемішані
Свіжий товар попереду
Прострочений
Потребує списання
```

---

# 8.3 FEFO статус

```text
FEFO дотримується
FEFO порушено
Не можу перевірити
```

---

# 9. Логіка після перевірки

# 9.1 Якщо все добре

Система:

- закриває задачу
- оновлює history
- записує batch check

---

# 9.2 Якщо FEFO порушено

Система:

- створює FEFO task
- повідомляє старшого зміни
- повідомляє store manager

---

# 9.3 Якщо кількість не сходиться

Система:

- створює adjustment task
- ставить manager_review

---

# 9.4 Якщо товар прострочений

Система:

- створює writeoff task
- ставить high priority

---

# 10. Reminder System

# 10.1 Повторні нагадування

Якщо задачі не виконані:

Система повинна:

- відправляти reminder
- збільшувати priority
- повідомляти керівника

---

# 10.2 Reminder logic

## Приклад

```text
1 година — reminder
3 години — повторний reminder
6 годин — escalation до shift_lead
12 годин — escalation до store_manager
```

---

# 11. Dashboard для керівника

# 11.1 Керівник повинен бачити

## Notification analytics

```text
✔ хто отримав повідомлення
✔ хто відкрив повідомлення
✔ хто не відкрив
✔ хто виконав задачі
✔ хто не виконав
```

---

## Task analytics

```text
✔ кількість задач
✔ кількість проблемних задач
✔ FEFO порушення
✔ writeoff tasks
✔ quantity mismatch
```

---

## User analytics

```text
✔ час відкриття повідомлення
✔ час виконання задач
✔ середній час реакції
✔ % виконаних задач
```

---

# 12. Рекомендовані нові таблиці

# 12.1 expiry_tasks

```sql
id
store_id
product_id
batch_id

task_type
priority
status

title
description

assigned_user_id
created_by_user_id

notification_id

due_date

completed_at
completed_by_user_id

created_at
updated_at
```

---

# 12.2 batch_checks

```sql
id
batch_id
task_id

checked_by_user_id

actual_quantity

condition_status
fefo_status

comment
photo_url

created_at
```

---

# 13. Основна архітектура системи

# Telegram

Тільки:

- notification
- reminder
- deep link

---

# Web App

Основна робота:

- задачі
- перевірки
- FEFO
- списання
- фото
- коментарі
- dashboard

---

# Backend

Основна логіка:

- FEFO
- task creation
- reminders
- analytics
- escalation
- notification flow

---

# 14. Основна бізнес-логіка

Система повинна:

- мінімізувати інвентаризацію
- автоматично створювати задачі
- автоматично контролювати FEFO
- автоматично контролювати відкриття повідомлень
- автоматично контролювати виконання задач
- автоматично контролювати ризики списання

---

# 15. Основний результат

Після реалізації система повинна:

- перевести роботу з Telegram у Web App
- мінімізувати ручну інвентаризацію
- автоматизувати task management
- автоматизувати FEFO контроль
- автоматизувати reminder system
- автоматизувати escalation flow
- дати керівнику повний контроль по задачах
- дати прозору аналітику по персоналу

