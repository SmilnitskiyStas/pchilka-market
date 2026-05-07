# 215 - improve intake batch selection visibility

## Problem
- in the inventory intake form, selected supply batch was not visually obvious
- users could miss whether they had already chosen an open batch
- first available open batch was not selected automatically

## Done
- updated `app/inventory/intake/page.tsx`
- added explicit batch selection mode:
  - `existing`
  - `new`
- first open batch is now auto-selected on page load when available
- added stronger visual highlight for selected batch input
- added visible summary card below the field:
  - selected existing batch details
  - or automatic new batch state
- preserved explicit switch to "new batch" without forcing re-selection of an open batch

## Result
- current batch selection is much easier to understand
- user does not need to click the first open batch manually
- automatic new-batch creation remains clear when no open batch is selected

## Verification
- passed `cmd /c npm run typecheck`
