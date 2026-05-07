# 185 - Fix inventory barcode lookup beyond 500 products

## What changed
- Added barcode normalization helper in `lib/inventory-product-types.ts`.
- Added exact product lookup helpers in `lib/inventory-products-repository.ts`:
  - `findInventoryProductByIdInDb`
  - `findInventoryProductByBarcodeInDb`
  - `findInventoryProductDuplicateInDb`
- Reworked public intake routes:
  - `app/api/inventory/intake/batch/route.ts` now validates product by DB id instead of first 500 products.
  - `app/api/inventory/intake/product/route.ts` now checks duplicates against the full DB.
  - added `app/api/inventory/intake/product-lookup/route.ts` for exact barcode lookup.
- Updated `app/inventory/intake/page.tsx` so scanner lookup no longer depends only on preloaded products.
- Updated `lib/inventory-xlsx-import.ts` to read Excel values with `raw: false` to preserve displayed barcode text more reliably.

## Verification
- `cmd /c npm run build`
