# Protect company-linked carts from access by cart ID alone

**Date:** 2026-10-20
**Status:** Scoped — approved by Klaus Petersen on 2026-10-20
**Type:** Story
**Priority:** Medium
**Issue:** [NIMBUS-177](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-177)
**Key:** NIMBUS-177
**Case folder:** issues/NIMBUS-177/
**Base Branch:** develop

## Background

A disclosed cart ID must not give someone access to a company's purchase preparations or allow them to change the purchase. The intended deliverable is server-enforced cart access throughout the B2B storefront, while authorized customers and approvers retain their normal flows.

Existing approval protection prevents changes to pending and approved carts, but does not establish who may read an editable cart. Cart identity, customer ownership, company membership and approval authority are distinct checks. Knowing an ID or supplying company metadata is not proof of any of them.

Current code also supports an administrator approving a colleague's cart and then proceeding to payment for it. The approved policy preserves this completion authority while keeping carts personal to their owners.

This remains full-pipeline work because it changes company authorization and the storefront/backend contract. It does not authorize implementation or planning.

## Requirements

### Functional

1. Authorize each read and mutation of a protected cart on the backend before returning protected data or causing side effects. This includes direct API calls that bypass the storefront.
2. Cover built-in cart retrieval, details, customer transfer, item add/update/delete, promotions, shipping methods, taxes and completion, plus the custom bulk line-item route. Include any installed cart operation discovered during planning that has equivalent access. Creation must establish the approved ownership/company policy.
3. Check indirect entry points that accept cart, approval or payment-collection IDs. Any route that exposes protected cart data or changes the protected purchase must enforce equivalent authority; protecting only `/store/carts/:id` is insufficient. Keep public product, region and general shipping-option discovery available as before.
4. Derive the customer identity from validated authentication and company membership/role from server-owned records. Client metadata, email, cart ID, cookie cart ID and publishable API keys cannot grant access, change ownership or downgrade a protected cart into a guest cart.
5. Preserve authorized cart creation, normal editing, login/cart association, cart restoration, approval review and checkout. A supplied cart ID must not let a different account claim an existing customer's cart.
6. Preserve approval rules: pending and approved carts remain immutable; rejected carts can be edited and resubmitted. Read permission does not grant edit, approval or checkout permission. Approval actors continue to be assigned by the server.
7. Apply the agreed guest and colleague policies below consistently in API and storefront behavior. Explain loss of access through translated storefront messages without exposing another customer's purchase.
8. Define rollout treatment for existing carts, including missing ownership, missing or conflicting company data, old browser cart cookies and pending/approved carts. Do not resolve ambiguous records by trusting client-provided values.

### Non-functional

- Refuse access by default when authentication, ownership or required company membership cannot be established. Failure must expose no cart contents, company/customer personal data or purchase side effects.
- Authorization must work across backend instances and must re-evaluate current membership/role; server-local memory and a previously opened page cannot grant continuing access.
- Avoid shared caching of protected responses between customers. Logout and account switching must not display the previous account's cart through retained cookies or caches.
- Use the framework's authentication and browser security controls. Planning must verify their installed behavior, including middleware ordering and indirect routes, before relying on them.
- Document the resulting access rules and rollout procedure in current architecture/security documentation. Existing case folders remain historical records.

## Business rules

Klaus Petersen approved these business rules and the scope on 2026-10-20.

| Action or state | Allowed / refused / outcome |
|---|---|
| Anonymous caller presents a company-linked cart ID | Refused for reads and mutations, regardless of approval state. |
| Authenticated customer from another company presents the ID | Refused, including customer transfer and indirect payment or approval paths. |
| Cart owner is still a member of the cart's company | May read; may edit only when existing cart/approval state permits. |
| Another ordinary member of the same company | Refused for personal carts; company membership alone does not imply cart sharing. |
| Company administrator reviews a colleague's approval request | Allow the purchase details needed for that company's approval review, the existing authorized decision and completion/payment for the approved purchase; no general editing of the colleague's cart. |
| Pending or approved cart | Remains immutable even for an otherwise authorized reader. Existing authorized completion of an approved cart remains available. |
| Rejected cart | Authorized owner may edit and resubmit under existing approval requirements. |
| Customer loses company membership or changes company | Refuse access to the former company's protected cart, including when the customer originally owned it. |
| Caller supplies or changes customer/company metadata | Cannot grant authority, transfer ownership or remove protection. |
| Guest cart and association after login | Sign-in is required before creating or using a purchasing cart. Association/restoration after login requires verified ownership and company membership; a supplied cart ID cannot establish either. |
| Existing cart has verified owner/company data | Preserve the cart and its approval state; apply current authentication, membership and state checks on access. |
| Ownership/company data is absent or conflicts on an existing protected cart | Refuse protected access until trusted recovery establishes authority; users start a new cart if recovery is unavailable. Never silently make the cart public or make pending/approved carts editable during recovery. |
| Mutation or approval performed by a customer | The acting identity is the authenticated customer; existing approval `handled_by` stays server-assigned. New general audit retention is not part of this scope. |

## Data model (draft)

This is a conceptual inventory, not a decision to add tables or migrations. The planner must identify the authoritative cart-to-company representation and reconcile legacy metadata before choosing storage changes.

| Entity / field | Key and meaning | Owner | Who writes | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| Cart ID | Identifies a purchase preparation; not an access credential | Medusa Cart module | Core cart creation | Stored | Links to personal/purchase data | Existing cart lifecycle; no new retention proposed |
| Cart customer | Customer associated with the cart; transfer requires separate authority | Medusa Cart module | Authorized server-side cart creation/association | Stored | Yes, customer identifier | Existing cart lifecycle |
| Protected cart company | Company whose purchase data is protected; existing company–cart module link requires trusted provenance | Company–cart module link; ownership across modules respected | Trusted server flow only in target behavior; current creation uses metadata | Stored link; authoritative use to be verified | Yes, company/purchase relationship | Same as cart; preserve verified carts, refuse ambiguous carts pending trusted recovery |
| Existing `metadata.company_id` | Legacy company hint; not an authorization trust root | Cart metadata | Existing callers; currently client-influenced | Stored | Company identifier | Existing cart lifecycle; reconciliation: ? |
| Customer–employee–company relationship and `employee.is_admin` | Current membership and company administrator authority | Company module, linked to Medusa Customer | Authorized company-management flows | Stored; access verdict derived per request | Yes | Existing membership policy |
| Approval, type, status and `handled_by` | Which purchase is reviewed, required authority, decision and actor | Approval module | Existing authorized approval workflows | Stored | Yes, purchase/employee data | Existing approval lifecycle |
| Authenticated actor | Customer established by validated session/token | Medusa authentication | Authentication system | Derived per request | Yes | Existing credential/session lifetime |
| Browser cart ID | Convenience pointer to the active cart | Storefront cookie | Storefront server actions | Stored in browser | Purchase identifier | Existing cookie policy; clear/detach on loss of access |

## Security properties (draft)

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Trusted identity | Framework-validated customer authentication on protected access | Validated session/token, not request metadata | Reject anonymous/invalid credentials before disclosure or side effects |
| Company isolation | Resolve current membership and protected cart company server-side | Company-owned membership records and verified cart association | Refuse foreign or former-company access |
| Customer isolation | Enforce personal ownership and narrowly scoped administrator approval/completion permission | Persisted ownership and server-owned administrator role | Same-company unauthorized customer is refused |
| No cart takeover or downgrade | Require sign-in for creation and protect transfer and metadata changes as well as reads | Existing cart ownership and verified company association | No unauthorized reassignment, guest fallback or partial mutation |
| Replay and disclosed IDs | Repeat authorization for every request; possession of an ID grants nothing | Current credentials plus current ownership/membership | Replayed ID under unauthorized identity fails; valid credential lifetime remains the framework's policy |
| Cross-instance behavior | Each instance obtains authoritative access data; no local-only grants | Shared persisted records and verified auth configuration | Missing/unavailable authority fails closed |
| Browser binding / CSRF | Verify existing session/token transport, cookie attributes, origin/CSRF behavior and server actions | Framework primitives and trusted storefront server boundary | Cross-site request cannot exercise authority through an unverified browser path |
| Logout / account switch | Detach stale cart references and avoid cross-user cache reuse | Current authenticated actor and request-scoped access check | Next protected request fails without credentials; another account sees no prior cart |
| Approval integrity | Access checks complement existing frozen-cart and decision checks | Approval state and authorized server-assigned actor | No frozen-cart edit or unauthorized approval; no personal data in errors |
| Personal data on failure | Generic errors and redacted diagnostics | Server response/logging policy | No cart/address/company details, credentials or full bodies disclosed |
| Indirect access | Resolve each related resource back to the protected purchase before access | Verified cart/payment/approval relationship | A different identifier cannot bypass protection |

Framework guarantees here are requirements to verify during planning, not claims already proved against a running system. Token revocation/rotation redesign is outside scope; the plan must state existing logout and token-expiry limits.

## Affected apps

- Backend: built-in and custom Store API cart access, company/approval authorization, related indirect routes and security tests.
- Storefront: authenticated cart lifecycle, login/association, approval preview, logout/account switching, translated access errors and private caching as needed by the approved rules.
- CMS: no changes expected.

## Proposed structure

1. Establish the authoritative ownership/company policy and existing-cart rollout, then protect all direct and indirect backend entry points.
2. Align storefront cart/login/approval flows and recovery messages with that policy.
3. Verify the access matrix against real framework routes, preserve approval/checkout regressions, and document rollout and deployed checks.

The planner determines the final task split after verifying the installed framework. No implementation tasks or tracker sub-tasks are created during scoping.

## Acceptance and verification

- For each protected operation, demonstrate an authorized success and anonymous, foreign-company and unauthorized same-company refusal under the personal-cart and administrator exception rules. Check response disclosure and unchanged persisted data, not just HTTP status.
- Cover editable, rejected, pending, approved and completed cart reads; preserve state-specific mutation/completion rules. Verify forged company/customer metadata, customer transfer, indirect resource IDs, removed membership, stale cart cookies and account switching.
- Exercise built-in routes with the real installed Medusa middleware/authentication, including bulk additions and payment preparation paths that reference a protected purchase. Test authorized administrator approval review separately from general cart editing.
- Verify sign-in is required before purchasing cart creation/use, then verify a normal customer purchase and administrator approval/payment flow through the storefront. Verify existing carts with trusted ownership/company data remain available and ambiguous carts are refused until trusted recovery or replaced by a new cart.
- After deployment, read a controlled protected cart as its owner and approver, then attempt anonymous/foreign access and mutation. Record actual responses and persisted cart state. Test results before deployment prove logic and wiring, not delivered protection.

## Open questions

No business decisions remain open. Sign-in before purchasing cart creation/use, personal carts with the administrator approval/completion exception, and preservation of verified existing carts with trusted recovery or a new cart for ambiguous cases are approved. The planner must still verify the technical dependencies and complete the draft data/security tables.

## Dependencies

- Scope, business rules and data inventory approved on 2026-10-20. Implementation planning requires a separate explicit handoff instruction.
- Planner verification of installed Medusa 2.21.0 route coverage, authentication ordering, cart transfer behavior and related payment/approval paths; documentation alone cannot prove the security boundary.
- Existing open finding 8 (client-influenced company metadata) must not be used as an authorization foundation. Correcting the association needed for this cart boundary belongs here; wider order-company propagation is separate unless planning proves it necessary.
- Related search in Jira found NIMBUS-179 (closed, shared locking), but no separate duplicate cart-access issue. Its shipped behavior must be assessed from current code; do not infer delivery from issue state or historical cases.
- Public discovery changes, spending-limit policy, payment-provider protocol changes, new general cart-sharing features, authentication-system redesign and order API/Business Central behavior are outside scope.

## Research references

Light code awareness only; no implementation design or live security probe was performed.

- `apps/backend/src/api/store/carts/middlewares.ts` and `src/workflows/approval/steps/validate-cart-edit.ts`: current approval edit locks, not customer/company access checks.
- `apps/backend/src/api/middlewares.ts`: cart company field selection does not establish authority.
- Installed `apps/backend/node_modules/@medusajs/medusa/dist/api/store/carts/middlewares.js` and `carts/[id]/route.js`: GET and mutation route definitions lack customer authentication except customer transfer; full effective middleware behavior remains for planning to verify. Payment-collection middleware also exposes collection/session preparation paths requiring assessment.
- `apps/backend/src/links/company-carts.ts`, `src/links/employee-customer.ts`, `src/workflows/company/steps/validate-company-access.ts`: existing relationships and membership source. `src/workflows/hooks/cart-created.ts` currently builds the company link from `cart.metadata.company_id`; the stored link alone does not prove trusted provenance.
- `apps/storefront/src/lib/data/cart.ts`, `customer.ts`: optional-auth cart support, login metadata update before transfer and cart-cookie clearing on logout. Current guest support in data functions does not decide business permission for guest purchasing.
- `apps/storefront/src/lib/data/approvals.ts` and `src/app/[countryCode]/(checkout)/checkout/page.tsx`: administrator approval redirects to the colleague cart's payment step using an explicit cart ID.
- `apps/backend/src/workflows/approval/steps/create-approvals.ts`, `validate-company-approval.ts` and `src/api/store/approvals/middlewares.ts`: existing source-cart ownership and administrator/company checks to preserve.
- `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`, storefront cart/customer/approval tests and `docs/security-remediation.md`: existing regression coverage and recorded metadata trust gap.
- Official [cart update documentation](https://docs.medusajs.com/resources/storefront-development/cart/update) describes authenticated customer transfer; [Store API reference](https://docs.medusajs.com/api/store) describes ID-based cart access. Installed source and real route tests remain necessary evidence for security guarantees.

## Documentation

- [docs/architecture/store-access.md](../../docs/architecture/store-access.md) — Store cart and order access: rules, route guards, approvals, storefront cart lifecycle (created)
- [docs/security-remediation.md](../../docs/security-remediation.md) — access rule tables and rollout (updated earlier on the branch)

AI base files updated: none
