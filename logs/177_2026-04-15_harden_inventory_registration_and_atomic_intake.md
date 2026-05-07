# 177 - Harden inventory registration and atomic intake

Date: 2026-04-15

Summary:
- closed public self-assignment of elevated roles in inventory Telegram/web registration;
- updated the registration UI so store administrators cannot be self-selected during signup;
- made admin inventory intake atomic by wrapping product + first batch creation in a single DB transaction;
- extended inventory repositories so product and batch creation can reuse the same DB connection inside transactions.

Verification:
- `npm run typecheck`
