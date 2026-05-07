# 176 - Add store staff view and batch responsibility reassignment

Date: 2026-04-14

Summary:
- added `product_batches.responsible_user_id` to inventory schema and migration path;
- added admin API to list inventory users and reassign responsible user for a batch;
- updated admin inventory UI with store filter, registered staff list, and per-batch reassignment control.

Verification:
- `npm run typecheck`
