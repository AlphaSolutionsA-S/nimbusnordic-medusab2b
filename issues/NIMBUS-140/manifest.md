# Implementation Manifest: Create Return Overview

**Project ID:** NIMBUS-140
**Date:** 2026-09-15 (reconciled 2026-09-29)
**Ready for Dispatch:** true

> The user resolved Q1 and Q2 on 2026-09-29 (see "Resolved Questions" in `PLAN.md`).
> - Q1: no related-order-number field, because External Document No. holds the portal's
>   `requestId`.
> - Q2: open (unposted) returns only.
> Tasks 01, 03 and 04 are updated accordingly.

## Branch

`feature/NIMBUS-140` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Add `listReturns` to the Business Central module service | `01-backend-list-returns-service-implementation.md` | backend | None | TODO |
| 02 | Add `GET /store/bc-returns` API route | `02-backend-bc-returns-route-implementation.md` | backend | 01 | TODO |
| 03 | Storefront return list types and data-fetching layer | `03-storefront-return-types-data-layer-implementation.md` | storefront | 02 | TODO |
| 04 | Return overview components (card, filters, overview) and all-locale translations | `04-storefront-return-overview-components-implementation.md` | storefront | 03 | TODO |
| 05 | Returns page route and account nav entry | `05-storefront-returns-page-nav-implementation.md` | storefront | 04 | TODO |

## Notes

- **Reconciled 2026-09-29** against develop after NIMBUS-138 (real BC return action and
  reservations, committed directly on develop), NIMBUS-170 (merged orders and invoices),
  NIMBUS-163..169 (8-locale next-intl), NIMBUS-157 and the Medusa 2.21 upgrade. The stale
  anchors in Tasks 01 and 04/05 are fixed. See `PLAN.md` for what changed.
- **Each task's tests now pass on their own.** All message-catalog edits, for all 8 locales,
  moved from Task 05 to Task 04. The old "Task 04 is red until Task 05 lands" ordering caveat no
  longer applies.
- **Known backend baseline failure:**
  `service.spec.ts › listOrders › stops filling from salesInvoices after the round-trip guardrail…`
  already fails on develop. Jest reports it twice because it also runs the `.medusa/server/`
  build copy. It is unrelated to this work.
- **NIMBUS-138 interplay:** there is no code dependency on unmerged work, because all NIMBUS-138
  code is already on develop. NIMBUS-138 is still In Progress on develop and touches
  `service.ts`, `types.ts` and `messages/*.json` (`TEMP (NIMBUS-138)` logging, reason codes).
  Rebase `feature/NIMBUS-140` on develop before merging, and do not modify NIMBUS-138's `TEMP`
  code.
- **Line endings:** the edited `.ts`/`.tsx` source files on develop use CRLF, and
  `messages/*.json` use LF. Preserve each file's line endings. All edit anchors were
  re-verified on 2026-09-29 against develop with line endings normalised.
- NIMBUS-141 (return detail page) is a downstream dependency, not a blocker. Task 04 links to
  `/account/returns/{number}` without building the destination page.
