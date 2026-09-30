# Implementation Manifest: Show processed (posted) returns in the return overview

**Project ID:** NIMBUS-172
**Date:** 2026-09-30
**Ready for Dispatch:** false (waiting for the user's plan review, PLAN.md "Open Questions")

## Branch

`feature/NIMBUS-172` (from `develop`). The planner created it on 2026-09-30. Nothing is
committed on it yet.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Merge posted return receipts into `listReturns` (types, merge helpers, `state` filter) | `01-backend-return-list-merge-implementation.md` | backend | None | TODO |
| 02 | Return detail for processed returns and posted receipts (`getReturn`) | `02-backend-return-detail-receipts-implementation.md` | backend | 01 | TODO |
| 03 | Combined return list: state badge, open/processed filter, grouped receipts, translations | `03-storefront-return-list-implementation.md` | storefront | 01 | TODO |
| 04 | Return detail page for processed returns and receipts, translations | `04-storefront-return-detail-implementation.md` | storefront | 02, 03 | TODO |

## Notes for the dispatcher

- Run the tasks **strictly in order**: 01, 02, 03, 04.
  - 01 and 02 both edit `service.ts`, `types.ts` and `return-history.ts`.
  - 03 and 04 both edit `apps/storefront/src/types/bc-order.ts` and all 8
    `apps/storefront/messages/*.json` catalogs, and 04 places its keys after the ones 03 adds.
- Each task must be green on its own: tests, `pnpm build` and `pnpm lint`.
- **Test commands:**
  - Backend module tests: `cd apps/backend && pnpm test:integration:modules`.
  - Backend unit tests: `cd apps/backend && pnpm test:unit`.
  - Storefront: `cd apps/storefront && pnpm test`.
- **Test infrastructure** already exists for both apps (backend `jest.config.js`, storefront
  `jest.config.ts`), so no scaffolding task is needed.
- **Known backend baseline:** one pre-existing `listOrders` guardrail test fails, and it is
  reported twice because of the `.medusa/server` copy. Leave it alone.
- The translation scripts in Tasks 03 and 04 are one-off helpers. Run them from the session
  scratchpad and **never commit them**.
- Do not touch NIMBUS-138 code (`createReturnFromSalesOrder`, `listReturnReasons`,
  `TEMP (NIMBUS-138)`), `listOrders` or `getOrder`.
- The working tree has user-owned, uncommitted edits to `issues/NIMBUS-140/PROGRESS.md`,
  `issues/NIMBUS-172/PROGRESS.md` and `issues/NIMBUS-172/SCOPE.md`. Do not discard or
  overwrite them.
