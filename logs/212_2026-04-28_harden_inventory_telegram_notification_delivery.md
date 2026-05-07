# 212 - harden inventory telegram notification delivery

## Problem
- manual inventory notification run stopped entirely when one recipient had an invalid Telegram `user_chat_id`
- because of that, valid recipients could miss the same batch notification

## Done
- updated `lib/inventory-telegram-notifications.ts`
- wrapped Telegram send per recipient in local `try/catch`
- added failure recording into `notification_logs` with type `expiry_check_due_failed`
- added per-recipient debug status fields: `ok` and `error`
- changed batch completion behavior:
  - batch is marked notified only if at least one recipient was notified successfully
  - if all sends fail, the batch remains available for future retry

## Result
- one bad `chat_id` no longer stops notification delivery for other recipients
- admin/manual API response now includes clearer per-recipient delivery diagnostics
- failed sends are stored in DB for later review

## Verification
- passed `cmd /c npm run typecheck`
