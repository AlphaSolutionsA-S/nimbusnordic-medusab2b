# Fix brief: draft orders in the order transfer check (gate answer D2)

**Issue:** NIMBUS-204 (order access guard and transfer)
**App:** backend (`@b2b-starter/backend`)
**Decided by:** Klaus Petersen, 2026-10-21 (deviation report, open question 2, answer (a)).

## Problem

`apps/backend/src/workflows/order/steps/validate-order-transferable.ts` reads the order without
`is_draft_order: false`. The order guard (`steps/validate-order-access.ts`) and core's store order read
both filter out draft orders, so a draft order answers 404 there. In the transfer check, a draft order
is read and judged like a placed order: an account-owned draft is refused with 400 and a guest draft
goes on to core's transfer workflow.

## Required behaviour

The transfer check reads the order with `is_draft_order: false`, so a draft order gets the same
404 `Order not found` the check already gives for an unknown order (no id in the message). Nothing else
changes: account-owned placed orders are still refused with 400 `Order cannot be transferred`; guest and
no-customer placed orders still reach core's request workflow and answer `{ "success": true }`.

## Test intent (test-first)

In `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`, `order access guard`
block (runner and DB notes in `branch-notes.md`; container `nimbus177-testdb` on 127.0.0.1:55499 may be
stopped — start it as the notes say and stop it afterwards):

1. A signed-in customer requests a transfer of a draft order (seed one through the order module with
   `is_draft_order: true`, for an account-owned customer and for a guest/no-customer case if cheap):
   answers 404 with the same body as an unknown order, and no order change row is created. Fails
   before the change (today it answers 400 or 200).
2. The existing transfer tests stay green (account-owned refusal, guest/no-customer request and cancel,
   unknown order 404).

## Also update

- `docs/security-remediation.md` order-transfer text: only if it states how drafts are handled; one
  short clause at most.
- `issues/NIMBUS-177/06-order-access-guard.md`: one `## Deviations` line for this follow-up.
- No `ai/` changes at all (AGENTS.md has 69 bytes of headroom).

## Done when

- Test 1 fails first, then passes; the full `security-boundaries.spec.ts` passes.
- Backend lint 0 errors; backend typecheck at or below baseline (22).
- `### Files touched` listed.
