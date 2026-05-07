# 190 - Add inventory expiry Telegram notifications

## What changed
- Added expiry notification pipeline:
  - `lib/inventory-telegram-notifications.ts`
  - `lib/inventory-notification-logs-repository.ts`
- Added Telegram inline button sending support in `lib/inventory-telegram-bot.ts`.
- Added batch notification candidate and mark-notified helpers in `lib/inventory-batches-repository.ts`.
- Added manual admin trigger:
  - `POST /api/admin/inventory/notifications/run`
- Added cron-ready trigger:
  - `POST /api/inventory/notifications/run`
  - requires header `x-inventory-notify-secret`
- Added batch-specific review flow:
  - `app/api/inventory/batch-check/context/route.ts`
  - `app/inventory/batch-check/page.tsx`
- Updated store management UI highlight by `batchId`.
- Added admin button to run notifications from inventory Telegram settings section.

## Result
- Users of the same store receive Telegram notifications for batches whose expiry date reached the notification window.
- Each message contains an inline button `Перевірити товар` that opens the exact batch check page.
- Sent notifications are written to `notification_logs`, and processed batches are marked as notified.

## Verification
- `cmd /c npm run build`
