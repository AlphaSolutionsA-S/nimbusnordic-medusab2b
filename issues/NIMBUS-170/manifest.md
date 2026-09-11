# Implementation Manifest: Merge Business Central Sales Orders and Sales Invoices in Order History

**Project ID:** NIMBUS-170
**Date:** 2026-09-11
**Ready for Dispatch:** true

## Branch

`feature/nimbus-170` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Update Business Central order types for the merge | `01-bc-types-implementation.md` | backend | None | DONE |
| 02 | Merge salesOrders + salesInvoices in `listOrders` | `02-list-orders-merge-implementation.md` | backend | 01 | DONE |
| 03 | Merge salesOrder + salesInvoice lines in `getOrder` | `03-get-order-merge-implementation.md` | backend | 01, 02 | DONE |
| 04 | Storefront — route by order number, widen types | `04-storefront-updates-implementation.md` | storefront | 02, 03 | DONE |

## Notes for the dispatcher

- Tasks 01–03 all touch `apps/backend/src/modules/business-central/service.ts` and/or `types.ts` and must run **strictly in order** (01 → 02 → 03) — Task 02 introduces shared types/mapping functions that Task 03 reuses, and Task 01's type changes are a prerequisite for both.
- Task 04 only starts once the backend response shape is final (after Task 03), since it types the storefront against that shape and changes routing that depends on it.
- Backend test command: `cd apps/backend && pnpm test:integration:modules` (matches `**/src/modules/*/__tests__/**/*.[jt]s` in `apps/backend/jest.config.js`).
- Storefront test command: `cd apps/storefront && pnpm test`.
- Test infrastructure already exists for both apps — no scaffolding task was needed (backend `jest.config.js` and storefront `jest.config.ts` both pre-exist).
