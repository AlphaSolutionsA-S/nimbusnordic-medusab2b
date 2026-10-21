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
