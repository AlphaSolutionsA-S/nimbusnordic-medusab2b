# 01: Cart access decision and authorization workflow
**App:** backend · **Layer:** L5 decision fn, L3 step, L4 workflow · **Depends on:** None

**Goal:** One pure rule that decides whether a caller may perform an operation class on a cart, and
a workflow that loads its inputs fresh and refuses with a 404 indistinguishable from a missing cart.
**Files / areas:** `apps/backend/src/workflows/cart/` (new domain: `utils/`, `steps/`, `workflows/`)
**Seam contracts:**
- Workflow `authorizeCartAccessWorkflow`, input `{ customer_id: string; operation: "read" | "owner" | "pay"; cart_id?: string; payment_collection_id?: string }`
  (exactly one of the ids); output the resolved `cart_id`. Refusal and absence both fail with
  `MedusaError` NOT_FOUND, message `Cart not found` (never the id).
- The rule is plan section 6 (verified association; owner, admin-read, admin-pay paths).
**Test intent:**
- Unit (decision fn, plain data): owner allowed for all classes; owner who left or changed company
  refused; colleague refused; admin read allowed only with an admin-type approval; admin pay allowed
  only with an approved admin approval (pending and rejected refused); admin never allowed `owner`.
- Unit: ambiguous carts refused for everyone (no owner; employee owner without link; link differs
  from owner's company); non-employee owner with unlinked cart allowed; non-employee caller with a
  linked cart refused; sales-manager approvals give the admin nothing.
- Integration cases come through task 03's HTTP matrix; no call-order mocks of Query.
**Done when:** unit tests pass; lint and backend typecheck at or below baseline; the decision
function imports nothing but types.
**Also update:** `ai/architecture/decisions.md` (new row: cart access, owning file, consumers: cart
guard middleware); none found among existing tests.

## Deviations
- Step file and id are `steps/validate-cart-access.ts` / `validate-cart-access` (`validateCartAccessStep`), not a name equal to the workflow id: mirrors `authorize-company-access` / `validate-company-access` and avoids a step and workflow sharing one id.
- Input carrying both `cart_id` and `payment_collection_id`, or neither, fails with the same NOT_FOUND `Cart not found` (fail closed on a broken seam call), rather than preferring one id.
- Besides `canAccessCart`, the decision file exports `hasVerifiedCartAssociation` so tasks 06 and 07 reuse the predicate instead of re-deriving it; it has its own unit cases.
- Added test cases beyond the intent: admin of another company refused; non-admin colleague with an approved admin approval refused; admin refused once the owner left; each ambiguous case checked for both owner and admin callers.
- `pnpm ai:check` still reports `AGENTS.md` over 32768 bytes (Codex limit). Pre-existing: the file was 33656 bytes at HEAD; the new registry row adds a little. Needs a human decision on trimming the Tier 0 set; not fixed here.

## Done-when evidence
- Unit tests pass: `apps/backend/src/workflows/cart/__tests__/cart-access.unit.spec.ts`, 63 passed (owner, colleague and outsiders, company administrator, ambiguous carts, `hasVerifiedCartAssociation`).
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors, no findings in `src/workflows/cart/`.
- Backend typecheck: 22 errors, identical set to the baseline (`tsc-backend-01.txt` vs `tsc-backend-baseline.txt` in the run folder); none in the new files.
- Decision function imports nothing but types: `utils/cart-access.ts` has a single `import type` from `types/approval`.
- Refusal and absence give the same `MedusaError` NOT_FOUND `Cart not found` (one `cartNotFound()` helper in the step): not provable in this task, unit scope covers the decision only; HTTP body equality is task 03's matrix.
- Also update `ai/architecture/decisions.md`: new row "Cart access and verified cart–company association" (owning file, verdict via `authorizeCartAccessWorkflow`, consumer cart guard middleware); `pnpm ai:check --fix` regenerated `AGENTS.md` and `.github/copilot-instructions.md`.
- Also update existing tests: none found (the rule is new; no test asserts cart access by id).
