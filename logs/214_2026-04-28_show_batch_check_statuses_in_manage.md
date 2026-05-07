# 214 - show batch check statuses in manage

## Problem
- store management page showed batches and responsible users
- but it did not show what action had already been taken after Telegram batch check

## Done
- updated `app/inventory/manage/page.tsx`
- added batch status display in both grouped lists:
  - `Статус перевірки`
  - `Остання дія`
  - `Примітка` when present

## Result
- managers can now see which batches were checked
- write-off and discussion cases are visible directly in `/inventory/manage`
- action notes are visible without opening the separate batch page

## Verification
- passed `cmd /c npm run typecheck`
