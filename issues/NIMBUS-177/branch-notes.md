# Branch notes: NIMBUS-177

## 01 Cart access decision
- `apps/backend/src/workflows/cart/utils/cart-access.ts`: `canAccessCart(operation, facts)`, `hasVerifiedCartAssociation({ customer_id, company_id }, ownerCompanyId)`, types `CartOperation`, `CartAccessFacts`, `CartAccessCart`. `ownerCompanyId` is the owner's current `employee.company_id`, `null` when the owner has no employee record. Tasks 06 and 07 reuse `hasVerifiedCartAssociation`; do not re-derive it.
- `workflows/cart/workflows/authorize-cart-access.ts`: `authorizeCartAccessWorkflow`, input `CartAccessInput` (from `steps/validate-cart-access.ts`), result is the resolved cart id. Run as `authorizeCartAccessWorkflow(req.scope).run({ input })`, `result` is the id.
- Every refusal (including both or neither id given, collection with no cart link) throws `MedusaError` NOT_FOUND `Cart not found`; a failed workflow rejects with a serialised object, so the guard should map on `.type`/`.message`, not `instanceof`.
- Cart read fields: `customer_id`, `company.id`, `approvals.type`, `approvals.status`, `customer.employee.company_id`; caller from `customer` entity `employee.company_id`, `employee.is_admin`. These typecheck against the generated types; runtime shape still unverified until task 03's HTTP matrix.
- Collection → cart: `query.graph({ entity: "cart_payment_collection", fields: ["cart_id"], filters: { payment_collection_id } })` (same call as core `compensate-payment-if-needed.js`).
- Running jest/lint here: `pnpm` is not on PATH in this shell; `corepack pnpm --filter @b2b-starter/backend ...` works from Git Bash.
- `pnpm ai:check` fails on `AGENTS.md` size (pre-existing, over 32768 bytes); `--fix` still regenerates the tier0 blocks.
