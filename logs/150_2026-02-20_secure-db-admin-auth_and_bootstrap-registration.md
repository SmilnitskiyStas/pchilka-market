# 150 — Захищена авторизація admin через БД + bootstrap-реєстрація

## Що зроблено
- Реалізовано безпечне зберігання паролів:
  - `lib/password-hash.ts`:
    - хешування `scrypt` з випадковою сіллю;
    - перевірка пароля через `timingSafeEqual`.
- Додано DB-репозиторій адмін-користувачів:
  - `lib/admin-users-repository.ts`:
    - пошук користувача за `login`;
    - створення користувача;
    - підрахунок кількості користувачів;
    - оновлення `last_login_at`.
- Переведено auth на користувачів із БД:
  - `lib/admin-auth.ts`:
    - `verifyAdminCredentials()` тепер перевіряє `admin_users`;
    - сесійна cookie містить підписаний payload (`sub`, `username`, `expiresAt`);
    - env-логін залишено як тимчасовий fallback для плавної міграції.
- Оновлено логін API:
  - `app/api/admin/auth/login/route.ts`:
    - асинхронна перевірка БД-користувача;
    - оновлення `last_login_at`.
- Додано endpoint реєстрації admin:
  - `app/api/admin/auth/register/route.ts` (`POST`):
    - створення admin-користувача в БД;
    - захист через `ADMIN_BOOTSTRAP_TOKEN` або активну admin-сесію;
    - автологін після успішної первинної реєстрації.
- Оновлено UI сторінки входу:
  - `app/login/page.tsx`:
    - вкладки `Вхід` / `Реєстрація admin`;
    - поле `Логін`;
    - поле `Bootstrap token` для ініціалізації користувача;
    - заглушка-кнопка `Google Sign-In (підготовлено, ще не увімкнено)`.
- Оновлено SQL-схему:
  - `docs/sql/001_init_schema.sql` — додано `admin_users`.
  - `docs/sql/006_add_admin_users_auth.sql` — окрема міграція для поточних БД.
- Оновлено env-шаблон:
  - `.env.example`:
    - `ADMIN_BOOTSTRAP_TOKEN`;
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`.

## Перевірка
- `npm run typecheck` — успішно.

## Що залишилось
- На сервері виконати SQL:
  - нова БД: достатньо `docs/sql/001_init_schema.sql`;
  - існуюча БД: застосувати `docs/sql/006_add_admin_users_auth.sql`.
- Додати в `.env.local`:
  - `ADMIN_SESSION_SECRET`
  - `ADMIN_BOOTSTRAP_TOKEN`
- Створити першого користувача через `/login` -> `Реєстрація admin`.
- Після первинного створення користувача бажано прибрати/оновити `ADMIN_BOOTSTRAP_TOKEN`.
- Для реального Google OAuth додати серверну перевірку `id_token` та callback-flow (окремий етап).
