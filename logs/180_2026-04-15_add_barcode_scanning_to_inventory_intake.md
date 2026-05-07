# 180 - Add barcode scanning to inventory intake

Date: 2026-04-15

Summary:
- added camera barcode scanning to `inventory/intake` using browser `BarcodeDetector`;
- scan result now fills the product search field and auto-selects a product on exact barcode match;
- rewrote the intake page in clean UTF-8 while preserving the Telegram intake flow.

Notes:
- scanning requires HTTPS or localhost and a browser with `BarcodeDetector` support;
- `npm run build` passes successfully;
- `npm run typecheck` still fails because of stale `.next/types/**/*.ts` references in `tsconfig.json`.

Verification:
- `npm run build`
