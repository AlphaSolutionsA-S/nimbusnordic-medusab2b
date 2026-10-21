# Automated test for retrying given-up shipments fails on develop

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-208 (relates to NIMBUS-130, NIMBUS-191)
- Severity: Minor
- Area: Backend, contract test `apps/backend/integration-tests/http/admin/shipment-tracking.spec.ts` (Admin shipment-tracking retry, shipment-notice check workflow)
- Reported by: Klaus Petersen (found by the NIMBUS-177 task-dispatcher during the full-suite run)
- Reported at: 2026-10-21T18:19:00Z

## Summary
One of the backend's automated tests for the Admin shipment-tracking page fails on the `develop`
branch. The test covers retrying a shipment that gave up: after an admin retries it, the next
shipment check should look it up in Business Central again, and give up only three days after the
retry. The check itself runs as expected; the test fails because it still expects the Business
Central lookup to be called the way it was before the shipment-check deadlines were added
(NIMBUS-130). The other five tests in the file pass. This failure is not one of the known, recorded
test failures, so it hides real regressions in this area until it is fixed. No customer-facing
behaviour is known to be affected.

## Steps to reproduce
1. Check out `develop` at e4f7351.
2. Start a local Postgres and set `BUSINESS_CENTRAL_DISCOVERY_URL` to an allowed test value
   (`apps/backend/integration-tests/global-setup.ts`).
3. Run `pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/admin/shipment-tracking.spec.ts`.

Not re-run at triage (another agent holds the checkout); evidence is the dispatcher's run below.

## Expected
All six tests pass, including "checks a retried row next run and gives up only three days after
reopening".

## Actual
That test fails at line 136:

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)

- Expected
+ Received

  ["SS-RETRY-10"],
+ 1792606801408,

Number of calls: 1
  > 136 |       expect(read).toHaveBeenCalledWith([row.shipment_number]);
```

`Tests: 1 failed, 5 passed, 6 total`. The spy `read` on `getShipmentsByNumbers` was called once with
the right shipment number plus a second argument, the run's deadline in epoch milliseconds
(1792606801408 = 2026-10-21T18:20:01Z, which matches the `deadline: Date.now() + 60_000` the test
passes the workflow). The assertion only allows one argument.

## Environment
- OS: Windows 11 (developer machine)
- Browser / runtime: Node 22, Jest via `medusaIntegrationTestRunner`, throwaway Postgres container
- Build / commit: `develop` at e4f7351
- Tenant / data context: test fixtures only (company `C-RETRY`, BC order `SO-RETRY`)

## Evidence
- `./logs/shipment-tracking-develop-e4f7351.txt`: result section of the failing run.
- `apps/backend/src/workflows/shipment-notice/steps/check-shipments.ts:196` (develop):
  `shipments = await bc.getShipmentsByNumbers(numbers, deadline);`
- `apps/backend/src/modules/business-central/service.ts:1259` and `types.ts:254` (develop):
  `getShipmentsByNumbers(numbers: readonly string[], deadlineMs?: number)`.
- Commit a25c893 "NIMBUS-130: Enforce shipment request deadlines" (2026-10-20) added the
  `deadline` argument and updated `integration-tests/http/shipment-notice/check-shipments.spec.ts`,
  `discover-shipments.spec.ts` and `shipment-reads.unit.spec.ts`, but not
  `integration-tests/http/admin/shipment-tracking.spec.ts`, which commit 84259bd
  "NIMBUS-191: Add Admin shipment tracking recovery" (2026-10-19) had added.
- Not in the baseline in `ai/architecture/verification.md` (which lists quote HTTP specs, one BC
  module test, 3 storefront and 1 CMS test).

Likely a stale assertion rather than a product defect, but not confirmed: the flow should confirm
that passing the deadline is the intended contract before changing the test (`verification.md`:
change what a stale test asserts, never delete it).

## Analysis
*(Leave empty initially. Fill in `analysis.md` when investigation starts and link from here.)*
