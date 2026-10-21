# 05: Document cart access rules and rollout
**App:** docs · **Layer:** none (documentation) · **Depends on:** 02, 03, 04, 06, 07

**Goal:** Current security documentation states who may read, change and pay a cart, how existing
carts are treated at rollout, and what to check after deploy.
**Files / areas:** `docs/security-remediation.md`
**Seam contracts:** none
**Test intent:** documentation only; no tests. The reviewer checks each statement against plan
sections 6 and 7 and the merged code.
**Done when:** the API behaviour section lists the cart rules (sign-in, owner, admin exception, 404
on refusal, transfer owner-only, indirect routes) and the order rules (owner, approving
administrator for both reading and creating returns, transfer request and cancel open to signed-in customers with no
order in the response, account-owned orders not transferable, and the residual transfer exposure
from plan section 10; returns carry no record of which administrator created them), the approvals list and decisions limited to
carts with a verified association; a rollout subsection covers no migration,
preserved verified carts, refused ambiguous carts with "start a new cart", the translation import
before storefront release, and the stated token-expiry limit; finding 8 reads fixed for carts, not
used by store order access, and still open for the order–company link that Business Central order
sync reads; regression coverage names the new cart and order matrices.
**Also update:** none found beyond this file (the `documentation-writer` updates
`docs/architecture/` after ship).
