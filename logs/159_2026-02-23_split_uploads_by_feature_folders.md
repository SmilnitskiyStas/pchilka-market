# 159 / 2026-02-23 / split uploads by feature folders

## Що зроблено
- Впроваджено структуру збереження файлів за тематичними підпапками:
  - `uploads/<domain>/<feature>/<year>/<month>/<file>`.
- Розширено утиліти завантажень:
  - `lib/uploads.ts`:
    - `normalizeUploadFolder(...)`
    - `buildMediaUrl(...)`
- Оновлено API вкладень форм:
  - `app/api/uploads/request-attachment/route.ts`
  - тепер підтримує `folder` у `FormData`.
- Оновлено API завантажень адмін-зображень:
  - `app/api/admin/images/route.ts`
  - тепер підтримує `folder` у `FormData` і кладе файли в підпапки з датою.

## Оновлено клієнтський код
- `lib/request-attachment-client.ts`:
  - додано опцію `folder`.
- Форми (вкладення):
  - `components/site-header.tsx` -> `forms/header-feedback`
  - `components/cooperation-offer-form.tsx` -> `forms/cooperation/general|product`
  - `components/cooperation-search-room-form.tsx` -> `forms/cooperation/search-room`
  - `components/cooperation-marketing-services-form.tsx` -> `forms/cooperation/marketing-services`
  - `components/cooperation-rental-form.tsx` -> `forms/cooperation/rental`
  - `components/career-application-form.tsx` -> `forms/career/application`
- Адмін-модулі:
  - `components/admin/admin-content-manager.tsx` -> `admin/content/covers`
  - `components/admin/admin-shock-price-manager.tsx` -> `admin/promotions/shock-price`

## Документація
- Додано `docs/uploads_storage.md` із картою папок.
- Оновлено `docs/project_status.md`.
- Оновлено `docs/site_content.md`.

## Перевірка
- `cmd /c npm run typecheck` — успішно.

## Результат
- Нові файли більше не змішуються в одному корені uploads.
- Пошук і обслуговування файлів спрощено завдяки поділу за доменами/модулями.
