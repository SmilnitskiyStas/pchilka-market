# 156 / 2026-02-23 / move forms to mysql and add admin messages

## Що зроблено
- Додано єдину модель вхідних заявок для всіх ключових форм сайту:
  - `lib/incoming-requests.ts`
  - `lib/incoming-requests-repository.ts`
- Додано SQL для таблиці `incoming_requests`:
  - оновлено `docs/sql/001_init_schema.sql`
  - додано міграцію `docs/sql/007_add_incoming_requests.sql`
- Додано публічний API для прийому заявок:
  - `POST /api/requests` (`app/api/requests/route.ts`)
- Оновлено endpoint зворотного звʼязку:
  - `app/api/feedback/route.ts`
  - тепер пише не тільки в `feedback_requests`, а й у `incoming_requests`.
- Переведено форми з `localStorage` на MySQL через `POST /api/requests`:
  - `components/cooperation-offer-form.tsx`
  - `components/cooperation-search-room-form.tsx`
  - `components/cooperation-marketing-services-form.tsx`
  - `components/cooperation-rental-form.tsx`
  - `components/career-application-form.tsx`
- Додано адмін-розділ для перегляду заявок:
  - API: `GET/PATCH /api/admin/messages` (`app/api/admin/messages/route.ts`)
  - UI: `components/admin/admin-messages-manager.tsx`
  - сторінка: `app/admin/messages/page.tsx`
  - секція в адмін-навігації: `components/admin/admin-sections.ts`

## Перевірка
- `cmd /c npm run typecheck` — успішно.

## Результат
- Заявки з форм співпраці/карʼєри та header feedback тепер зберігаються в MySQL.
- В адмінці є розділ `Повідомлення` для перегляду, фільтрації та зміни статусу заявок.

## Що залишилось
- За потреби додати окремий адмін-експорт (CSV/XLSX).
- За потреби додати сповіщення (email/Telegram) при нових заявках.
- За потреби перевести коментарі/реакції блогу з `localStorage` у БД.

