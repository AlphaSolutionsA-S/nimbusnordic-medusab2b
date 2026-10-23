# 04: Shipment job skips and closes switched-off companies
**App:** backend · **Layer:** L0 (tracking close-reason enum), L3 steps, L5 check schedule, Admin UI label · **Depends on:** 03

**Goal:** Discovery never tracks shipments of switched-off companies (cursor still advances, no back-fill); the check run closes each due open row of a switched-off or missing company with close reason `company_not_enabled` without reading it from Business Central.
**Files / areas:** `src/modules/order-ingestion/models/shipment-tracking.ts` (+ generated migration), `src/workflows/shipment-notice/steps/{scan-shipment-windows,prepare-shipment-checks,check-shipments}.ts`, `src/workflows/shipment-notice/utils/shipment-check-schedule.ts`, `src/admin/hooks/api/shipment-tracking.tsx`, `src/admin/routes/shipment-tracking/page.tsx`.
**Seam contracts:** close-reason wire value `company_not_enabled`; the rule from task 03 is the only place that decides "enabled". Each due check carries whether its company is enabled, read in the preparation step with one companies query for the batch. Business Central request count per run unchanged (N4).
**Test intent:**
- Unit: the check schedule closes with `company_not_enabled` for the new outcome, keeping `attempts`/`last_error` semantics like `superseded`.
- Integration `discover-shipments.spec.ts`: a header of a switched-off company is not tracked and the cursor passes it; switching the company on later does not track it (R7); an enabled company's header is tracked as today.
- Integration `check-shipments.spec.ts`: a due open row of a switched-off company closes `company_not_enabled` with no Business Central read for it and its stored notices kept; an enabled company's row in the same batch is checked as today; a closed `company_not_enabled` row stays closed after switching on and another run (R9).
- Admin test: the overview shows a label for the new close reason.
**Done when:** tests pass; migration generated (check constraint re-created with the new value); existing shipment specs switch their companies on and stay green; lint, typecheck at or below baseline.
**Verify after deploy:** `shipment_tracking` rows of a company left off after go-live show `close_reason = 'company_not_enabled'` after the next due run; rows of a switched-on API company stay open.
**Also update:** `integration-tests/http/shipment-notice/{discover-shipments,check-shipments,poll-shipment-notices}.spec.ts`, `src/workflows/shipment-notice/__tests__/shipment-check-schedule.unit.spec.ts`, `src/modules/order-ingestion/__tests__/shipment-notice-storage.spec.ts` (only if it enumerates close reasons), `src/admin/routes/shipment-tracking/__tests__/page.test.tsx`, `integration-tests/http/admin/shipment-tracking.spec.ts` (reason union in its seed helper).
