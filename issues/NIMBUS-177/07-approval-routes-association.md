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
