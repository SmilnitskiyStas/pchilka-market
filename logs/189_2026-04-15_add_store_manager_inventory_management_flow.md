# 189 - Add store manager inventory management flow

## What changed
- Added public inventory management page for store roles `manager` and `admin`:
  - `app/inventory/manage/page.tsx`
- Added token-protected APIs:
  - `app/api/inventory/manage/context/route.ts`
  - `app/api/inventory/manage/user/route.ts`
  - `app/api/inventory/manage/reassign/route.ts`
- Added worker update support in `lib/inventory-users-repository.ts`.
- Added entry link from `app/inventory/intake/page.tsx` for manager/admin users.
- Updated `lib/inventory-telegram-bot.ts` so manager/admin users receive a management link after `/start`.

## Capabilities
- View workers for the current store.
- Update worker role, position, and active status within the same store.
- View batches expiring within 30 days.
- Reassign responsible worker when needed.

## Verification
- `cmd /c npm run build`
