# 184 - Add admin manual product review list

## What changed
- Added `listInventoryManualProductCreationsFromDb()` in `lib/inventory-activity-logs-repository.ts`.
- Added admin API `GET /api/admin/inventory/manual-products`.
- Added a new section in `components/admin/admin-inventory-manager.tsx`:
  - shows products manually created by staff;
  - shows creator, store, timestamp, article, barcode;
  - shows saved note/comment for admin review.

## Verification
- `cmd /c npm run build`
