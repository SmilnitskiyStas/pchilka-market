# 151 — Видимість поточної сесії та керування користувачами в адмінці

## Що зроблено
- Додано API для поточної сесії:
  - `app/api/admin/auth/me/route.ts`
  - Повертає поточного користувача (`login`, `role`, `authProvider`) за активною сесією.
- Розширено auth-хелпери:
  - `lib/admin-auth.ts`
  - Додано парсинг payload сесії та `getAdminSessionFromRequest`.
- Розширено репозиторій користувачів:
  - `lib/admin-users-repository.ts`
  - Додано:
    - `findAdminUserById`
    - `listAdminUsersFromDb`
    - `deleteAdminUserById`
    - `countActiveAdminsExcludingUser`
- Додано повноцінний admin API керування користувачами:
  - `app/api/admin/users/route.ts`
  - `GET` — список користувачів;
  - `POST` — створення користувача (`login`, `password`, `displayName`, `role`);
  - `DELETE` — видалення користувача з захистами:
    - не можна видалити поточного користувача;
    - не можна видалити останнього `admin`.
- Додано UI керування користувачами:
  - `components/admin/admin-users-manager.tsx`
  - `app/admin/users/page.tsx`
  - Функції:
    - створити користувача;
    - переглянути список користувачів;
    - видалити користувача.
- Додано розділ в адмін-навігацію:
  - `components/admin/admin-sections.ts` -> `Користувачі`.
- Додано видимість активної сесії в навігації:
  - `components/admin/admin-nav.tsx`
  - Відображається "Ви залогінені як: login (role)".

## Перевірка
- `npm run typecheck` — успішно.

## Що залишилось
- За потреби додати редагування ролі/статусу користувача без перевидалення.
- За потреби додати reset/change password для користувачів з `auth_provider=local`.
