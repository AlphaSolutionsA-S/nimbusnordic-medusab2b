# Implementation Manifest: See Existing Return Status (Return Detail Page)

**Project ID:** NIMBUS-141
**Date:** 2026-09-29
**Ready for Dispatch:** false

> **Why it is not ready:**
> 1. **Blocked by NIMBUS-140.** Every task builds on code that NIMBUS-140 adds, and NIMBUS-140 is
>    planned but not implemented or merged. See "External dependencies" below.
> 2. **The plan review is pending.** The user must approve `PLAN.md`, including the Q4 reading
>    that no per-line prices are shown and open questions OQ-2 and OQ-3.
>
> Set this to `true` only when NIMBUS-140 is merged to develop **and** the user has approved the
> plan.

## Branch

`feature/NIMBUS-141` (from `develop`). Create it only **after** NIMBUS-140 has been merged to
develop.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Add `getReturn` to the Business Central module service | `01-backend-get-return-service-implementation.md` | backend | NIMBUS-140 T01 | TODO |
| 02 | Add `GET /store/bc-returns/:number` API route | `02-backend-bc-return-detail-route-implementation.md` | backend | 01, NIMBUS-140 T02 | TODO |
| 03 | Storefront return detail types and data-fetching layer | `03-storefront-return-detail-types-data-layer-implementation.md` | storefront | 02, NIMBUS-140 T03 | TODO |
| 04 | Return detail components, template and all-locale translations | `04-storefront-return-detail-components-translations-implementation.md` | storefront | 03, NIMBUS-140 T04–T05 | TODO |
| 05 | Return detail page route and link from the return confirmation | `05-storefront-return-detail-page-confirmation-link-implementation.md` | storefront | 04, NIMBUS-140 T05 | TODO |

## External dependencies (blocking)

| NIMBUS-140 artefact | Needed by | Why |
|---|---|---|
| T01 `mapSalesReturnOrderToListItem` in `service.ts` | 141 T01 | Edit 3 switches its status decoding to the shared `decodeBCEnumValue`, so list and detail decode statuses identically. |
| T02 `bc-returns/middlewares.ts` (`/store/bc-returns*` `authenticate`) and its registration | 141 T02 | This is the only customer authentication for `/store/bc-returns/:number`. |
| T03 `BCReturnList*` types in `bc-order.ts` | 141 T03 | Ordering only: 141 appends after them. |
| T04–T05 `/account/returns` page, nav entry, `bcReturnCard` link to `/account/returns/{number}` | 141 T04–T05 | These provide the back link target and the entry point into the new page. |

Each 141 task starts with a check that stops the task if its NIMBUS-140 prerequisite is
missing.

## Notes

- **NIMBUS-138 interplay:** NIMBUS-138 is in progress on develop and shares `service.ts`,
  `types.ts`, `messages/*.json` and `bc-order-return/index.tsx`. Rebase `feature/NIMBUS-141` on
  develop before merging. Never modify `TEMP (NIMBUS-138)` code. Task 05 only extends the
  "return created" confirmation block.
- **NIMBUS-172:** 172 will add posted returns later. No posted-return handling is built here.
  The template is split into reusable sections (`BcReturnLines`, `BcReturnExpectedCredit`) so
  that 172 can extend the page.
- **Known backend baseline failure:**
  `service.spec.ts › listOrders › stops filling from salesInvoices after the round-trip guardrail…`
  (reported twice because of `.medusa/server`) already fails on develop and is unrelated.
- **Line endings:** the edited `.ts`/`.tsx` files use CRLF and `messages/*.json` use LF.
  Preserve each file's line endings.
- **Each task is green on its own.** All catalog keys, including those Task 05 uses, are added
  in Task 04.
