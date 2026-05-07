# 186 - Split admin inventory into logical sections

## What changed
- Reworked `components/admin/admin-inventory-manager.tsx`.
- Added top-level overview cards for inventory state.
- Added internal section navigation for:
  - schema
  - manual staff-created products
  - product import
  - intake
  - operations by store
  - Telegram settings
- Switched page rendering so only one major working block is shown at a time.

## Verification
- `cmd /c npm run build`
