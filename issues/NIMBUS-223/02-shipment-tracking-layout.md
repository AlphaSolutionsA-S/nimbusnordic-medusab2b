# 02: Shipment tracking in two sections
**App:** backend (Admin UI) · **Layer:** Admin UI (`admin/**`) · **Depends on:** 01

**Goal:** The Shipment tracking page renders `core:single-column` under `shipment_tracking.list` with two named sections, given-up shipments (heading, Retry) then all shipments.
**Files / areas:** `src/admin/routes/shipment-tracking/page.tsx`, `routes/shipment-tracking/__tests__/page.test.tsx`.
**Seam contracts:** page key from task 01's module.
**Test intent:**
- Every existing case keeps passing unchanged in what it asserts (spinner, retry pending and invalidation, toast on failure, load errors, overview paging, close-reason labels).
- New: the page key is `shipment_tracking.list` and the two entries appear in default order, given-up first (via the stand-in's attributes).
**Done when:** both sections render as today; lint passes; typecheck at or below baseline.
**Verify after deploy:** Admin → Shipment tracking: move "All shipments" above the given-up list, save Personal, reload in another browser → order kept.
**Also update:** `routes/shipment-tracking/__tests__/page.test.tsx`; `docs/architecture/order-api/shipment-notices.md` row for the page still accurate (no change expected).

## Deviations
- The given-up block became its own component (`GivenUpShipments`) beside the existing `AllShipments`, and the old `flex flex-col gap-y-3` wrapper was dropped (Medusa's single-column layout spaces its entries). Why: shape choice inside the task; each entry wraps one component.
- Entry ids chosen: `given-up-shipments`, `all-shipments` (the plan named the sections but not their ids). Why: fixed names are needed and none were given.

## Done-when evidence
- Both sections render as today: every existing case in `routes/shipment-tracking/__tests__/page.test.tsx` passes unchanged (spinner, retry pending and invalidation, toast on failure, load errors, overview paging by 50, close-reason labels).
- Page key `shipment_tracking.list`, layout `core:single-column`, entries in default order given-up first: `page.test.tsx` "lays the page out under its own key with the given-up section before all shipments". Moving sections in a browser: browser run (final gate, plan decision 1).
- Lint passes: `pnpm --filter @b2b-starter/backend lint`, 0 errors (13 warnings, none in the touched files).
- Typecheck at or below baseline: 22 errors, the same set as after task 01; none in `shipment-tracking`.
- Also update `routes/shipment-tracking/__tests__/page.test.tsx`: one case added, existing assertions unchanged.
- Also update `docs/architecture/order-api/shipment-notices.md`: row for `admin/routes/shipment-tracking/page.tsx` still accurate; no change.
