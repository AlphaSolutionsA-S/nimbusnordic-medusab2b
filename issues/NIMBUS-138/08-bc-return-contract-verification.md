# Implementation Task 08: BC Return Contract Verification

> **Depends on task 07 (the stubbed flow is complete and demoable).** This is a spike that verifies
> the **real** Business Central return-creation contract in a sandbox and produces `CONTRACT.md`,
> which binds task 09. It is intentionally **last-but-one**: no portal code depends on it, so it can
> run in parallel with tasks 01–07 and only blocks the final real-implementation swap.

## Why this is now at the end

The plan proceeds on the **assumed** contract documented in task 01. That unblocks the whole UI /
workflow / route slice. This task exists to replace that assumption with verified fact before we
turn off the stub. If the sandbox contract differs from the assumed body, the delta is absorbed in
task 09 (service seam) — tasks 02–06 are insulated by the `BCCreateReturnParams` / `BCReturnOrder`
seam.

## Objective

Confirm, against the target BC sandbox tenant, how a return order is created from a verified source
sales order, and capture it in `issues/NIMBUS-138/CONTRACT.md`.

## Investigation checklist

1. **Endpoint / action.** Confirm the actual mechanism (BC custom API/AL action, bound action, or
   automation API). Capture the exact URL template, HTTP method, and required company/customer
   scoping. Confirm there is **no** public `salesReturnOrders` writer being relied on.
2. **Request body.** Verify against the assumed shape:
   ```json
   { "requestId": "...", "sourceOrderNo": "...",
     "lines": [{ "sourceLineNo": 0, "quantityToReturn": 0, "returnReasonCode": "..." }] }
   ```
   Record any differences (field names, nesting, whether reason is per-line, whether `sourceOrderNo`
   is the document no. vs a GUID).
3. **Line identity.** Confirm whether NIMBUS-137's `BCOrderLine.sequence` equals BC's return line
   identifier (`sourceLineNo` / "Line No."). If not, record the correct source field so task 03's
   mapping can be corrected.
4. **Idempotency.** Confirm whether BC dedupes on `requestId` (header or body), and the lookup to
   reconcile an ambiguous outcome (query an existing return by `requestId` / source order).
5. **Return reasons.** Confirm whether BC exposes a return-reason source (endpoint/enum) or whether
   the codes are static config. This decides if task 09 replaces the dummy provider with a real
   fetch or promotes it to config.
6. **Response + error catalogue.** Capture the 2xx return-order body shape and the business-rule
   rejection shapes (already returned, invalid quantity, invalid reason, ineligible order state) so
   task 09 can classify definitive rejections vs ambiguous outcomes.
7. **Non-goals confirmation.** Confirm the action does NOT post a credit memo, return receipt,
   payment, or refund — only creates the return document.
8. **Permissions.** Record the BC permission set / app registration scope required for the write.

## Deliverable: `issues/NIMBUS-138/CONTRACT.md`

Sections: Endpoint & method; Scope resolution; Request schema (+ delta vs assumed); Line-identity
mapping; Idempotency & reconciliation lookup; Return-reason source; Response schema; Error catalogue
(BC shape → customer-safe message → definitive/ambiguous); Non-goals confirmed; Permissions;
Sandbox test customer/order used.

## Definition of done

- `CONTRACT.md` exists and answers every checklist item, or explicitly records the blocker if the
  BC action is not yet available in the sandbox.
- The assumed-contract delta (if any) is written down as the task-09 change list.
- `PROGRESS.md` records the outcome and hands over to task 09.
