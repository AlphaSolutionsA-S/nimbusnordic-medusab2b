# Fix brief 01: stale-snapshot case in check-shipments.spec.ts fails

**Issue:** NIMBUS-239 (task 02) · **App:** backend · **Found in:** finalization, `pnpm test:integration:http`

## Failure

`integration-tests/http/shipment-notice/check-shipments.spec.ts` ›
`checkShipmentsWorkflow › stores nothing for a stale snapshot after another run cancelled`
(around line 383):

```
expect(result).toMatchObject({ conflicts: 1, recorded: 0, errors: 0 });
- "conflicts": 1, "errors": 0
+ "conflicts": 0, "errors": 1
```

All other cases in the spec pass. The suite was changed in task 02 (commit 2a96ae7): the
`getShipmentLineVariants` stub and `storeAsAnotherRun` now pass size rows.

## Task

Find why this run now ends in `errors: 1` instead of a conflict (likely the variant stub or the
rows passed to the decision in the "another run cancelled" path, e.g. a `variant_missing` or a
read failure for the cancelled shipment's lines). Decide whether the defect is in the test setup or
in the production code (`check-shipments.ts`, `decide-shipment-notice.ts`); fix it where it is.
Do not weaken the assertion. If production code is wrong, add or adjust a unit test that shows it.

Run the spec alone to prove the fix:
`pnpm --filter @b2b-starter/backend test:integration:http -- integration-tests/http/shipment-notice/check-shipments.spec.ts`
(local Postgres; tests never call Business Central). Then lint and typecheck (baseline 22).

Record the cause and the fix under `## Outcome` in this file and list `### Files touched`.

## Outcome

**Cause (test setup).** The `getShipmentLineVariants` stub builds size rows from `bcShipments`,
which in this case still held the first two-line shipment (lines 10000, 20000). The stubbed shipment
read returned the stale snapshot, which also has item line 30000. With no size row for 30000,
`decideShipmentNotice` returned `variant_missing` (B-rule: an item line with no TRCShipmentLine row
is not recordable). The step recorded that as a failure (`errors: 1`) and never reached the store,
so the conflict was not counted. The production code behaved correctly. The sibling case "leaves an
open row due now after a store conflict" passed only because its stale snapshot has no line that is
missing from `bcShipments`.

**Fix.** The spec now registers the cancelled shipment as BC's current state
(`const cancelled = inBc(tracked, [...])` instead of `shipment(...)`), so the size read sees every
line of the stale snapshot, as a real BC would after the other run's read. The assertion is
unchanged. Production code is not touched, so no unit test was added.

**Results.** Spec alone (`check-shipments.spec.ts`): 22 passed, 0 failed. Lint: 0 errors, 13
warnings (existing, none in touched files). Typecheck: 22 errors (baseline 22).

### Deviations

None.

### Files touched

- `apps/backend/integration-tests/http/shipment-notice/check-shipments.spec.ts` (modified)
- `issues/NIMBUS-231/fix-01-stale-snapshot-spec.md` (modified)
