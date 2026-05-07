# 188 - Show real inventory product count in admin

## What changed
- Added `countInventoryProductsInDb()` in `lib/inventory-products-repository.ts`.
- Updated `GET /api/admin/inventory/products` to return:
  - limited `products` list for UI rendering
  - real `totalCount` from DB
- Updated `components/admin/admin-inventory-manager.tsx` to show total product count instead of `products.length`.

## Result
- Admin inventory page now shows the real number of products in the database even when the visible list is limited for performance.

## Verification
- `cmd /c npm run build`
