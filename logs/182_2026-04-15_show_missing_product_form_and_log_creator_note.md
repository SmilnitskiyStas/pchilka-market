# 182 - Show missing product form and log creator note

Date: 2026-04-15

Summary:
- fixed `inventory/intake` so the missing-product form stays visible even when a product lookup fails;
- separated blocking page load errors from workflow messages, so non-fatal messages no longer hide the intake UI;
- added a note field for new product creation from the Telegram intake flow;
- added `activity_logs` entry for products created by staff, including who created the product, store, timestamp and note for admin review.

Verification:
- `npm run build`
