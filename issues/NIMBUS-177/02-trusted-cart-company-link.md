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
