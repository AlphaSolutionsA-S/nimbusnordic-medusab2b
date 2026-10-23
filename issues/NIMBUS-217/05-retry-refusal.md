# 05: Admin retry refuses a shipment of a switched-off company
**App:** backend · **Layer:** L3 validation step, L4 reopen workflow · **Depends on:** 03

**Goal:** `POST /admin/shipment-tracking/:id/retry` for a gave-up row whose company is switched off (or gone) answers 400 "The company is not enabled for the order API" and leaves the row unchanged.
**Files / areas:** `src/workflows/shipment-notice/workflows/reopen-shipment-tracking.ts`, a new step in `src/workflows/shipment-notice/steps/`.
**Seam contracts:** `MedusaError` `NOT_ALLOWED` with the exact message above; uses the rule from task 03. A missing tracking row is not refused by the new step, so the existing 404 still applies; the existing 400 for a row that did not give up is unchanged. The Admin page already shows the error message in a toast.
**Test intent:**
- Contract `admin/shipment-tracking.spec.ts`: gave-up row of a switched-off company → 400 with the exact message, row still closed `gave_up` with `reopened_by` unset; same row after switching the company on → reopened as today; unknown id → 404 unchanged.
**Done when:** tests pass; lint, typecheck at or below baseline.
**Verify after deploy:** none (no stored data or screen changes beyond the error toast).
**Also update:** `integration-tests/http/admin/shipment-tracking.spec.ts` (its seeds switch the company on for the existing retry cases).
