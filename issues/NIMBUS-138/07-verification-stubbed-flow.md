# Implementation Task 07: Verification — Stubbed End-to-End Flow

> **Depends on tasks 01–06.** This is the **demoable milestone**: the full vertical slice works
> against the task-01 stubs (no real BC). Real BC (tasks 08–09) has not run yet, so BC-side
> assertions are explicitly deferred and called out below.

## Project Environment

- **Backend build/test:** `cd apps/backend && pnpm build`, `pnpm test:integration:modules`,
  `pnpm test:integration:http`
- **Storefront build:** `cd apps/storefront && pnpm build`
- **Repo-wide:** `pnpm build`, `pnpm lint` from root.

## Verification checklist

### Build & lint
- [ ] `pnpm build` passes for `apps/backend` and `apps/storefront`.
- [ ] `pnpm lint` passes repo-wide.

### Backend module tests (stub + workflow)
- [ ] BC service stub: deterministic return order, reasons provider shape, input guard (task 01).
- [ ] Workflow: partial success (stub), cross-company `NOT_FOUND`, quantity-exceeds `INVALID_DATA`,
  unknown reason `INVALID_DATA`, idempotent retry short-circuit (task 03).

### Backend HTTP tests
- [ ] Unauthenticated → 401; reasons GET happy path → 200; missing BC number → 400; strict-payload
  rejection → 400; cross-company source order → 404; create happy path → 200 (task 04).

### Idempotency (stub-level)
- [ ] Two identical create requests produce **one** `bc_return_request` record (same `request_id`)
  and one logical return — asserted at the persistence + workflow level against the stub.

### Security / authorization
- [ ] Company/customer scope is derived only from `req.auth_context` + the employee-company link;
  body values never influence authority.
- [ ] Cross-company and unauthenticated requests cannot create or disclose returns.
- [ ] No BC tokens, customer IDs, endpoint URLs, or raw BC exception text appear in responses or
  logs (trivially true for the stub, but assert the error-mapping paths).

### Manual storefront walkthrough
- [ ] Order-detail page shows the return-entry panel with eligible lines, bounded quantity inputs,
  and per-line reason dropdowns populated from the dummy provider.
- [ ] Submitting shows the stub return number/status without implying a refund/credit was posted.

## Explicitly deferred to tasks 08–09 (do NOT assert here)
- Real BC endpoint/contract verification (task 08 → `CONTRACT.md`).
- Ambiguous-outcome reconciliation against real BC timeouts/5xx.
- Confirmation that no credit memo / return receipt / payment / refund is posted BC-side.
- `sequence === "Line No."` mapping confirmation.

## Definition of done

- All (non-deferred) checklist items pass.
- `issues/NIMBUS-138/PROGRESS.md` records the stubbed-flow verification outcome and hands over to
  task 08 (contract verification).
- The feature stays behind a flag / not customer-enabled until tasks 08–09 complete.
