# 187 - Improve intake camera preview and manual date entry

## What changed
- Updated `app/inventory/intake/page.tsx`.
- Reduced scanner preview to a compact centered camera frame instead of a wide full block.
- Set delivery date default to today for new batch entry.
- Replaced native date pickers with manual text inputs.
- Added support for date entry in formats:
  - `dd.mm.yyyy`
  - `yyyy-mm-dd`
- Normalized entered dates before sending them to the API.

## Verification
- `cmd /c npm run build`
