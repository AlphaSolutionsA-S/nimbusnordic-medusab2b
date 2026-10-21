# 07: Approval list and decisions respect the verified association
**App:** backend · **Layer:** L3 step, L4 workflow, L6 route · **Depends on:** 01

**Goal:** Administrators neither see nor decide approvals for carts whose owner is no longer a member
of the linked company, or whose link differs from the owner's current company.
**Files / areas:** `apps/backend/src/api/store/approvals/route.ts`, a new list workflow and step
under `workflows/approval/`, `workflows/approval/steps/validate-company-approval.ts`
**Seam contracts:** uses the task 01 verified-association predicate (no second implementation);
`GET /store/approvals` response shape (`carts_with_approvals`, `count`, pagination fields) unchanged
apart from the omitted carts; `POST /store/approvals/:id` refusal stays 403 `Forbidden`.
**Test intent:**
- HTTP (`security-boundaries.spec.ts`): the list omits a cart whose owner was removed from the
  company and a cart linked to the company whose owner belongs to another company; the body
  contains none of their ids, items or emails; a verified colleague cart is still listed.
- Deciding either omitted cart's pending approval answers 403 and leaves approval and approval
  status unchanged.
- Existing approval regressions stay green ("allows the company administrator to decide a pending
  approval", "denies deciding another company approval", rejected-then-edited cases).
**Done when:** tests pass; lint and typecheck at or below baseline; the list route body holds no
filtering logic.
**Verify after deploy:** Approvals page for one administrator: a controlled cart whose owner left
is absent.
**Also update:** `ai/architecture/decisions.md` cart-access row (consumers: approvals list and
decision); `docs/security-remediation.md` approval bullet (task 05).

## Deviations
- The unreachable "caller has no company" branch of `GET /store/approvals` now answers
  `{ carts_with_approvals: [], count: 0 }` instead of `{ approvals: [], count: 0 }`: the route's
  `ensureCompanyAccess(true, false)` already refuses a caller with no employee record, and one
  result shape keeps the workflow typed. Every reachable response shape is unchanged.
- The route reads the caller from `auth_context.actor_id` (as the decision route does) instead of
  `app_metadata.customer_id`; both hold the customer id for a customer token.
- The step passes the client `status` value to the `approval_status` filter through one named
  narrowing (`approvalStatusFilter`), replacing the old route's `any` filter objects; the
  `as any` on the approval type filter was dropped (not needed).
- `seedCart` in the security spec gained an optional `email` argument so the leak check can look
  for each omitted cart's email.
- `docs/security-remediation.md` approval bullet updated here (one sentence); task 05 may extend it.

## Done-when evidence
- List omits a cart whose owner left and a cart linked to a company its owner is not in, with none
  of their cart ids, line ids, approval ids or emails in the body; the verified colleague cart is
  listed with its approval and `count` 1: `security-boundaries.spec.ts` › cart access guard ›
  approval list and decisions › "lists only carts with a verified association and leaks nothing of
  the others".
- Deciding either omitted approval (approved and rejected) answers 403 and leaves the approval and
  its approval status pending: same describe, "refuses deciding the approval of a cart whose owner
  left the company and leaves it pending" and "... linked to a company the owner is not in ...".
- Existing approval regressions green: full `security-boundaries.spec.ts` run, 66 passed, 0 failed
  ("allows the company administrator to decide a pending approval", "denies deciding another
  company approval", "cannot approve a previously rejected request after its cart is edited",
  "replaces rejected approvals when an edited cart is submitted again", rejected-cart edit cases).
- One home for the rule: both `steps/list-company-approval-carts.ts` and
  `steps/validate-company-approval.ts` call `hasVerifiedCartAssociation` from
  `workflows/cart/utils/cart-access.ts`; no second implementation.
- List route body holds no filtering logic: `api/store/approvals/route.ts` runs
  `listCompanyApprovalCartsWorkflow` and spreads its result (check: file read, 21 lines).
- Lint: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in the
  touched files). Typecheck: 22 errors, baseline 22.
- Also update `ai/architecture/decisions.md`: cart-access row consumers now name the approvals
  list workflow and the decision step (`pnpm ai:check --fix` regenerated the tier0 blocks; it still
  reports the pre-existing AGENTS.md size problem).
- Also update `docs/security-remediation.md`: approval bullet states that list and decisions cover
  only verified carts.
