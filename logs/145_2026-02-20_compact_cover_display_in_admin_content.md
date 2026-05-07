# Task
Зменшити візуальний шум від довгого `Cover` у списку статей адмінки.

# Що зроблено
- Оновлено відображення `Cover` у `components/admin/admin-content-manager.tsx`:
  - додано `formatCoverDisplay(...)` для компактного формату;
  - якщо `coverImage` це `data:image/...;base64`, показується короткий підпис виду:
    `image/jpeg (base64, ~123 KB)`;
  - для звичайного URL/шляху ввімкнено обрізання (`truncate`) з повним значенням у `title` (tooltip).

# Результат
- Довгі значення `Cover` більше не розтягують картку статті.
- Base64 значення не засмічують інтерфейс великим рядком.

# Перевірка
- `cmd /c npm run typecheck` -> success

