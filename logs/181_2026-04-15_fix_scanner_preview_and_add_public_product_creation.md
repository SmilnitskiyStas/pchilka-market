# 181 - Fix scanner preview and add public product creation

Date: 2026-04-15

Summary:
- fixed barcode scanner preview by attaching the video stream after the `video` element is mounted;
- improved intake scanner flow so scanned barcode fills search and pre-fills the new product form;
- added public token-based API to create a new product from the Telegram intake page;
- extended `inventory/intake` with a new product form for cases when scanned barcode is missing in the database.

Verification:
- `npm run build`
