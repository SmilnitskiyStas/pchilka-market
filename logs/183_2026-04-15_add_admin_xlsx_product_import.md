# 183 - Add admin xlsx product import

Date: 2026-04-15

Summary:
- added server-side `.xlsx` parsing for product import from the provided nomenclature file format;
- added transactional admin API `POST /api/admin/inventory/products/import` for Excel upload and import;
- added upsert-style import logic for `products` based on `barcode` or `article`;
- added admin inventory UI block to upload an Excel file and run import through the site;
- installed `xlsx` package to support Excel parsing in the app runtime.

Verification:
- `npm run build`
