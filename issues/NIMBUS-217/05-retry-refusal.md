# 05: Admin retry refuses a shipment of a switched-off company
**App:** backend · **Layer:** L3 validation step, L4 reopen workflow · **Issue:** NIMBUS-222 · **Depends on:** 03

**Goal:** `POST /admin/shipment-tracking/:id/retry` for a gave-up row whose company is switched off (or gone) answers 400 "The company is not enabled for the order API" and leaves the row unchanged.
**Files / areas:** `src/workflows/shipment-notice/workflows/reopen-shipment-tracking.ts`, a new step in `src/workflows/shipment-notice/steps/`.
**Seam contracts:** `MedusaError` `NOT_ALLOWED` with the exact message above; uses the rule from task 03. A missing tracking row is not refused by the new step, so the existing 404 still applies; the existing 400 for a row that did not give up is unchanged. The Admin page already shows the error message in a toast.
**Test intent:**
- Contract `admin/shipment-tracking.spec.ts`: gave-up row of a switched-off company → 400 with the exact message, row still closed `gave_up` with `reopened_by` unset; same row after switching the company on → reopened as today; unknown id → 404 unchanged.
**Done when:** tests pass; lint, typecheck at or below baseline.
**Verify after deploy:** none (no stored data or screen changes beyond the error toast).
**Also update:** `integration-tests/http/admin/shipment-tracking.spec.ts` (its seeds switch the company on for the existing retry cases).

## Deviations

- The contract test was written and typechecks but was NOT run: no PostgreSQL in this environment (and the company and close-reason migrations from tasks 01/04 are not generated yet).
- The step refuses any existing row of a switched-off company, so a not-gave-up row of a switched-off company now gets the new message instead of "Only a shipment that gave up can be retried"; both are 400 `not_allowed`, and plan section E reads the company before the row state. For enabled companies the existing 400 is unchanged.
- No test-intent case dropped; "unknown id → 404 unchanged" is asserted in the new test while the company is switched off (and still in the existing "refuses window-ended, open and unknown rows").

## Done-when evidence

- 400 with the exact message, row unchanged (`closed`/`gave_up`, `reopened_by` and `reopened_at` null, attempts 8): `integration-tests/http/admin/shipment-tracking.spec.ts` "refuses a gave-up row of a switched-off company and leaves it unchanged, then reopens it once switched on" (written, NOT run: no DB).
- Same row reopened after switching the company on: same test, second half (NOT run).
- Unknown id stays 404: same test, and existing "refuses window-ended, open and unknown rows" (NOT run).
- Existing 400 for a not-gave-up row unchanged (enabled company): existing "refuses window-ended, open and unknown rows" and the second retry in "reopens once, ..." (NOT run).
- Lint: `corepack pnpm --filter @b2b-starter/backend lint` 0 errors, no warnings in touched files.
- Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit` 22 errors (baseline 22), none in touched files.
- Also update `shipment-tracking.spec.ts`: its seed already switches the company on through `createApiCustomerCompany` (task 03); added the refusal test using `setOrderApiEnabled`.
