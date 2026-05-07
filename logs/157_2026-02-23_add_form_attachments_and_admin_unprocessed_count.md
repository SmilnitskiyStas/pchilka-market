# 157 / 2026-02-23 / add form attachments and admin unprocessed count

## Що зроблено
- Додано можливість прикріплення файлів у форми:
  - `components/cooperation-search-room-form.tsx`
  - `components/cooperation-marketing-services-form.tsx`
  - `components/cooperation-rental-form.tsx`
- Для нових вкладень у формах додано:
  - валідацію розміру (до 10MB),
  - валідацію розширень (`jpg,jpeg,png,webp,pdf,doc,docx,txt`),
  - передачу метаданих файла в `metadata` при `POST /api/requests`.
- Додано підрахунок необроблених заявок (`status = new`) у репозиторії:
  - `lib/incoming-requests-repository.ts`
- Розширено API повідомлень:
  - `app/api/admin/messages/route.ts` тепер повертає `unprocessedCount`.
- Додано відображення лічильника нових повідомлень у адмін-навігації:
  - `components/admin/admin-nav.tsx`
  - підпис пункту `Повідомлення` має формат `Повідомлення (N)` при `N > 0`.

## Перевірка
- `cmd /c npm run typecheck` — успішно.

## Результат
- У формах співпраці тепер можна додавати файли.
- В адмінці видно кількість необроблених повідомлень у навігації.

