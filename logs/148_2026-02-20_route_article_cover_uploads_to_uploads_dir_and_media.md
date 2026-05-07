# Task
Виправити завантаження cover-зображень для статей так, щоб файли зберігались у серверному uploads-директорії (FTP `data/pchilka/uploads`), а не в `public/img/uploads`.

# Що зроблено
- Повністю оновлено `app/api/admin/images/route.ts`:
  - `POST` тепер пише файл у `UPLOADS_DIR` через `getUploadsDir()` з `lib/uploads.ts`.
  - `POST` повертає URL у форматі `/media/<file>`.
  - `GET` повертає об'єднаний список:
    - `/img/...` (статичні публічні файли)
    - `/media/...` (файли з `UPLOADS_DIR`).
- Таким чином, зображення, завантажені в адмінці, мають зберігатися у файловому сховищі сервера, що відповідає FTP-шляху uploads.

# Результат
- Нові cover-файли більше не повинні йти в `public/img/uploads`.
- Вибір зображень у модалці "Обрати з сервера" бачить і `/img`, і `/media`.

# Важливо для прод середовища
- Має бути задано `UPLOADS_DIR` у runtime env прод-сервера.
- `UPLOADS_DIR` повинен вказувати на фактичну директорію uploads (наприклад, `.../data/pchilka/uploads`).

# Перевірка
- `cmd /c npm run typecheck` -> success

