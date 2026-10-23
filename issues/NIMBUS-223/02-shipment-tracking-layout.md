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
