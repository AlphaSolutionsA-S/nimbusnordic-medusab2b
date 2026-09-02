# Task 02: Idempotency Verification + Failure Handling

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 02
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-149 (from develop)
**Depends on:** NIMBUS-129 Task 03 (order-creation workflow)

---

## Context

NIMBUS-149's SCOPE requires:

1. **Idempotency:** "Order creation must not double-create a Medusa order for the same validated
   canonical order if invoked more than once (defense in depth alongside NIMBUS-147's per-company
   `externalOrderNumber` duplicate check upstream)."
2. **Failure handling:** "Order creation failures must be surfaced in a way that allows recovery
   rather than silently dropping a validated order."

NIMBUS-129 Task 03 already implements both mechanisms. This task verifies that they satisfy
NIMBUS-149's requirements and documents the behavior. **No code changes are expected** — this
is a verification and documentation task.

## Idempotency — Existing Mechanism

NIMBUS-129 Task 03's `matchCompanyAndCheckDuplicateStep` checks the `OrderExternalReference`
table for an existing `(company_id, external_order_number)` pair before creating the order:

```typescript
const duplicates = await orderIngestionService.listOrderExternalReferences({
  external_order_number: input.canonicalOrder.externalOrderNumber,
  company_id: company.id,
});

if (duplicates.length > 0) {
  throw new MedusaError(
    MedusaError.Types.DUPLICATE_ERROR,
    `Order '${input.canonicalOrder.externalOrderNumber}' was already accepted for this company`
  );
}
```

This is the "defense in depth" the SCOPE requires:

1. **Primary check (upstream):** NIMBUS-147's per-company `externalOrderNumber` duplicate check
   (runs before the canonical order reaches the order-creation workflow).
2. **Secondary check (this workflow):** The `OrderExternalReference` table lookup in
   `matchCompanyAndCheckDuplicateStep` — if the same `(company_id, external_order_number)` pair
   already has a row, the workflow throws `DUPLICATE_ERROR` before creating a second order.

**Verification:** The `OrderExternalReference` row is created in the same step as the order
(`createOrderAndReferenceStep`), so there is no window where a duplicate could slip in between
the check and the creation — they run in the same workflow step, sequentially, within the same
transactional context.

**Conclusion:** The existing mechanism satisfies NIMBUS-149's idempotency requirement. No
additional code is needed.

## Failure Handling — Existing Mechanism

NIMBUS-129 Task 03's `createOrderAndReferenceStep` has a compensation function that rolls back
all three artifacts on failure:

```typescript
async (compensationData, { container }) => {
  if (!compensationData) {
    return;
  }

  const orderModuleService = container.resolve<IOrderModuleService>(Modules.ORDER);
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK);
  const orderIngestionService = container.resolve<OrderIngestionModuleService>(
    ORDER_INGESTION_MODULE
  );

  await orderIngestionService.deleteOrderExternalReferences(compensationData.referenceId);
  await remoteLink.dismiss({ [Modules.ORDER]: { order_id: compensationData.orderId } });
  await orderModuleService.deleteOrders(compensationData.orderId);
}
```

On failure:

1. The `OrderExternalReference` dedupe row is deleted.
2. The Order↔Company remote link is dismissed.
3. The Medusa order is deleted.

The workflow engine propagates the error to the route handler (Task 05), which returns a 4xx/5xx
response to the caller. No partial artifacts are left behind — the compensation ensures the
system returns to the pre-creation state.

**Recoverability:** The caller (external system) can retry the submission. Because the
compensation deleted the `OrderExternalReference` row, the retry will not be rejected as a
duplicate — it will proceed through the workflow again. This is the "recoverable" behavior the
SCOPE requires.

**Conclusion:** The existing mechanism satisfies NIMBUS-149's failure-handling requirement. No
additional code is needed.

## What This Task Does

This task is a documentation-only task. The implementor should:

1. Read the existing `createOrderAndReferenceStep` and `matchCompanyAndCheckDuplicateStep` from
   NIMBUS-129 Task 03.
2. Verify that the idempotency check and compensation function are present and correct.
3. Verify that the test cases in Task 03 cover the duplicate-rejection and failure-rollback
   scenarios.
4. If any gap is found, add the missing test case to Task 03's test file (or to Task 03 of this
   story's Task 03).

No new files are created. No existing files are modified (unless a test gap is found).

## Impacted Files

None (documentation/verification only). If a test gap is found, the test file from NIMBUS-129
Task 03 or this story's Task 03 is updated.

## Open Items

- **Verify compensation ordering** — the compensation deletes the `OrderExternalReference` first,
  then dismisses the link, then deletes the order. If the order deletion fails (e.g. due to a
  foreign key constraint from the link), the compensation may not complete. Verify that the
  order can be deleted while the link exists, or that the link dismissal is not blocking.
- **Verify workflow error propagation** — confirm that a step's thrown error reaches the route
  handler as a `MedusaError` with the correct type (per NIMBUS-129 Task 03's note about potential
  workflow-engine error wrapping).
