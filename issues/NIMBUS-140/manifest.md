# Implementation Manifest: Create Return Overview

**Project ID:** NIMBUS-140
**Date:** 2026-09-15
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-140` (from `develop`)

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Add `listReturns` to the Business Central module service | `01-backend-list-returns-service-implementation.md` | backend | None | TODO |
| 02 | Add `GET /store/bc-returns` API route | `02-backend-bc-returns-route-implementation.md` | backend | 01 | TODO |
| 03 | Storefront return types and data-fetching layer | `03-storefront-return-types-data-layer-implementation.md` | storefront | 02 | TODO |
| 04 | Return overview components (card, filters, overview) | `04-storefront-return-overview-components-implementation.md` | storefront | 03 | TODO |
| 05 | Returns page route, account nav entry, and translations | `05-storefront-returns-page-nav-implementation.md` | storefront | 04 | TODO |

## Notes

- Task 04's translation-dependent test assertions depend on Task 05's message-file edits (see the "IMPORTANT" note at the top of Task 04). If tasks are executed strictly in dependency order and each task's test suite is run to completion before moving to the next, Task 04's tests will not pass until Task 05 lands. This is a known, deliberate ordering consequence of `next-intl`'s automatic test mock resolving against the real `messages/en.json` catalog — not a defect in the plan. The dispatcher/worker should either run both Task 04 and Task 05 before the final test pass, or accept that Task 04's test run alone is red until Task 05 completes.
- NIMBUS-141 (return detail page) is a downstream dependency, not a blocker — Task 05 wires the `/account/returns/{number}` link and route prefix without building the destination page.
