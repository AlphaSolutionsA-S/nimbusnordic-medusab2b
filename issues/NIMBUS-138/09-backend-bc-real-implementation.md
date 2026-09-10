# Implementation Task 09: Replace Stubs with Real BC Implementation

> **LAST task. Depends on task 08 (`CONTRACT.md`).** Swaps the task-01 stub for the real BC HTTP
> call and the dummy return-reason provider for the verified source. By design this touches **only**
> the BC service (`service.ts`) — the workflow, routes, and storefront built in tasks 02–07 stay
> unchanged because they sit behind the `BCCreateReturnParams` / `BCReturnOrder` / `BCReturnReason`
> seam.

## Project Environment

- **App root:** `apps/backend`
- **Build command:** `pnpm build`
- **Test command:** `cd apps/backend && pnpm test:integration:modules`, `pnpm test:integration:http`
- **Test location:** `apps/backend/src/modules/business-central/__tests__/`
- **All exact URLs, field names, and error shapes below come from `CONTRACT.md`.**

## Scope

1. Replace `createReturnFromSalesOrder` (remove the `// STUB` body) with the real call.
2. Replace or reconfigure `listReturnReasons` per `CONTRACT.md` (real fetch, or promote the dummy
   list to config if BC confirms static codes).
3. Apply any assumed-contract delta from task 08 (field renames, line-identity mapping fix). If the
   delta changes the seam types, update `types.ts` and the task-03 mapping accordingly — otherwise
   the change is contained in `service.ts`.
4. Make `BusinessCentralAmbiguousOutcomeError` actually reachable (timeout / 5xx / empty body).

## Code Skeleton: `apps/backend/src/modules/business-central/service.ts`

```typescript
async createReturnFromSalesOrder(
  params: BCCreateReturnParams
): Promise<BCReturnOrder> {
  // IMPLEMENT (bind exact values from issues/NIMBUS-138/CONTRACT.md):
  // 1. discoveryUrl = getDiscoveryUrl(); tenantId = getTenantId(discoveryUrl);
  //    { clientId, clientSecret } = getClientCredentials();
  //    accessToken = await requestToken(...).
  // 2. Resolve target company/customer scope per CONTRACT.md (reuse
  //    getCustomerId(discoveryUrl, accessToken, params... ) if the action is customer scoped).
  //    If scope cannot be resolved -> MedusaError NOT_FOUND (no existence leak).
  // 3. Build the verified action URL from CONTRACT.md. Do NOT construct a public
  //    "salesReturnOrders" URL. Enforce HTTPS + the existing BC host allowlist.
  // 4. POST the CONTRACT.md body (requestId as the idempotency key — header or body per contract)
  //    with Authorization: Bearer {accessToken}.
  // 5. Classify the response:
  //    - 2xx parseable return-order body -> map to BCReturnOrder and return.
  //    - Definitive BC business-rule rejection (per CONTRACT.md catalogue) -> MedusaError
  //      INVALID_DATA with a customer-safe message (no raw BC text/tokens/URLs/IDs).
  //    - Timeout / 5xx / empty-or-unparseable body -> throw
  //      BusinessCentralAmbiguousOutcomeError(message, params.requestId).
  // 6. If CONTRACT.md defines a reconciliation lookup, add a private helper
  //    findReturnByRequestId(...) and query it before re-submitting on retry.
  // 7. Never log the bearer token, client secret, full BC response, or PII.
}

async listReturnReasons(): Promise<BCReturnReason[]> {
  // IMPLEMENT per CONTRACT.md: either fetch the real BC return-reason source (token +
  // GET + map to { id, description }) OR, if BC confirms static codes, keep a config-backed
  // list and remove the STUB comment. No fabricated network calls.
}
```

## Test Cases (module tests, mock `global.fetch`)

- **TC-1 Successful return creation:** token + (optional) scope + action mocked 2xx with a valid
  body → resolves to the mapped `BCReturnOrder`; request URL matches the contract path and carries
  the `requestId`.
- **TC-2 Definitive validation rejection:** contract business-rule-rejection shape → `MedusaError`
  `INVALID_DATA`, customer-safe, no BC internals.
- **TC-3 Ambiguous outcome:** timeout / 5xx / empty body → `BusinessCentralAmbiguousOutcomeError`
  carrying the `requestId`.
- **TC-4 Idempotent reconcile (if contract defines a lookup):** ambiguous-then-retry finds the
  existing BC return via `requestId` and returns it rather than creating a second.
- **TC-5 Reasons (if real fetch):** mocked reasons response → mapped `{ id, description }[]`.
- **Regression:** the task-03/04 workflow + HTTP tests still pass unchanged with the real service
  mocked at the `fetch` boundary.

## Final verification (fold into the task-07 checklist, now against real BC)
- [ ] Sandbox scenarios (full, partial, already-returned, invalid quantity, invalid reason,
  ineligible state, idempotent retry) pass on a dedicated non-production customer/order.
- [ ] Ambiguous-then-retry yields **exactly one** logical BC return.
- [ ] No credit memo / return receipt / payment / refund is posted (confirmed BC-side).
- [ ] `pnpm build` + `pnpm lint` pass; all module + HTTP tests green.

## Implementation Steps

1. Bind `CONTRACT.md` values; implement the real `createReturnFromSalesOrder` and `listReturnReasons`.
2. Apply any seam-type delta (rare) and fix the task-03 line mapping if `sequence` ≠ `sourceLineNo`.
3. Update/extend `__tests__/return-stub.spec.ts` → real-service tests (TC-1..TC-5); keep workflow +
   HTTP tests green.
4. Run `pnpm test:integration:modules`, `pnpm test:integration:http`, `pnpm build`, and the sandbox
   scenarios. Update `PROGRESS.md`.
