# 02: Trusted company link at cart creation
**App:** backend · **Layer:** L4 hook, L6 middleware · **Depends on:** None

**Goal:** Cart creation requires a signed-in customer, and the company–cart link comes from that
customer's employee record, never from `metadata.company_id`.
**Files / areas:** `apps/backend/src/workflows/hooks/cart-created.ts`,
`apps/backend/src/api/store/carts/middlewares.ts`
**Seam contracts:** after creation, a cart owned by an employee has exactly one company link, to the
owner's current company; a cart owned by a non-employee has none. `POST /store/carts` without a
customer token answers 401.
**Test intent:**
- HTTP contract (`integration-tests/http/security/security-boundaries.spec.ts`): anonymous create
  answers 401 and no cart row exists afterwards.
- Signed-in employee creating with `metadata.company_id` set to a foreign company gets a cart linked
  to their own company (assert `cart.company.id` and `customer_id` types and values).
- Signed-in non-employee customer gets a cart with no company link.
- Hook compensation dismisses the link it created (integration or existing behaviour kept).
**Done when:** tests pass; lint and typecheck at or below baseline; the hook no longer reads
metadata.
**Verify after deploy:** company–cart link row (`links/company-carts.ts`) for one newly created cart; its `company_id`
equals the creator's `employee.company_id`.
**Also update:** `ai/architecture/rules.md` (`trust-no-client-company` baseline drops
`hooks/cart-created.ts`); `ai/skills/medusa-workflow-and-steps/project.md` ("Do not copy" drops
`cart-created.ts`); `docs/security-remediation.md` finding 8 line (task 05 writes it).

## Deviations
- Anonymous create is tested with a publishable key and no customer token only: without a publishable key every store route already answers 400 (framework publishable-key check runs first), so a "no credentials" case would not reach the new authentication.
- Added a test beyond the intent: running `createCartWorkflow` directly with no customer fails with `UNAUTHORIZED` "A signed-in customer is required to create a cart" and leaves no cart (the hook's own fail-closed check, behind the route authentication).
- Hook compensation is kept unchanged and not separately tested: `cartCreated` is the last step of core's `createCartWorkflow`, so no later step can fail and trigger it in a test; it still dismisses exactly the link the hook returned.
- `integration-tests/utils/admin.ts` `createStoreUser` takes an optional `email` (default unchanged) so the spec can create a second, non-employee customer.
- The HTTP spec was run against a disposable `postgres:17` container on `127.0.0.1:55499` (stopped afterwards), because the local dev Postgres container publishes no host port.
- The hook reads the owner's company with `query.graph` on `customer` → `employee.company_id`, commented as a narrow-lookup exemption from `data-core-read-workflows`.

## Done-when evidence
- Anonymous create 401, no cart row: `security-boundaries.spec.ts` › POST /store/carts › "answers an anonymous caller with 401 and creates no cart".
- Employee with forged foreign `metadata.company_id` linked to own company, `customer_id` and `company.id` strings with the expected values: "links an employee's cart to their own company, ignoring a forged metadata.company_id".
- Non-employee gets no company link: "creates a cart with no company link for a customer who is not an employee".
- Hook fails creation without a customer and the cart is rolled back: "fails cart creation without a customer and leaves no cart behind".
- Red first: all four new tests failed against the HEAD versions of `cart-created.ts` and `carts/middlewares.ts` (401 expected / 200 received; link mismatch; promise resolved); green after; whole spec 51/51 passed.
- Hook compensation dismisses its link: existing behaviour kept (compensation body unchanged); not provable in this task: no step runs after `cartCreated` to fail.
- Hook no longer reads metadata: `apps/backend/src/workflows/hooks/cart-created.ts` has no `metadata` access; company comes from `customer.employee.company_id`.
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in touched files).
- Typecheck: 22 errors, same file set as baseline (`tsc-backend-02.txt` vs `tsc-backend-baseline.txt` in the run folder).
- Also update `ai/architecture/rules.md`: `trust-no-client-company` baseline now `workflows/hooks/order-created.ts` only; `pnpm ai:check --fix` regenerated `AGENTS.md` and `.github/copilot-instructions.md` (still fails only on the pre-existing AGENTS.md size).
- Also update `ai/skills/medusa-workflow-and-steps/project.md`: "Do not copy" now lists only `hooks/order-created.ts`.
- Also update `docs/security-remediation.md` finding 8: left for task 05 as the task states.
- Also update existing tests: none stale; the quote specs' `cartSeeder` calls already send a customer token.
