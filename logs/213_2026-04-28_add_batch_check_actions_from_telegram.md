# 213 - add batch check actions from telegram

## Problem
- Telegram link `/inventory/batch-check` only showed batch details
- there was no user action on the page to confirm what happened with the product
- as a result, the system could not tell whether the batch was checked, prepared for write-off, or sent for discussion

## Done
- added server action route:
  - `app/api/inventory/batch-check/action/route.ts`
- added batch update logic in:
  - `lib/inventory-batches-repository.ts`
- updated Telegram batch page:
  - `app/inventory/batch-check/page.tsx`

## New behavior
- after opening the batch from Telegram, the user can choose one of the actions:
  - `Перевірив`
  - `На списанні`
  - `Для обговорення`
- optional note can be saved together with the action
- action updates existing batch fields in DB:
  - `check_status`
  - `checked_by_user_id`
  - `checked_at`
  - `action_taken`
  - `action_note`
  - `discussion_required`
  - `discussion_note`
  - `discussion_requested_by_user_id`
  - `discussion_requested_at`
- every action is also written into `activity_logs`

## Result
- batch check link from Telegram is now actionable, not read-only
- the system can track that the product was actually reviewed by a store user
- managers/admins can later see what was done with the batch

## Verification
- passed `cmd /c npm run typecheck`
