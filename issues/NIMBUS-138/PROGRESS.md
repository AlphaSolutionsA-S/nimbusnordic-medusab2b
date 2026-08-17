# NIMBUS-138 Progress

## 2026-08-17 - Scoping complete

**Outcome:** Created the technical scope for `NIMBUS-138` (`Create BC connection for
return`). The scope establishes that the public Business Central v2.0 API documents
writable sales orders/lines and credit memos, but does not document the requested
sales-return-order resources. The story is therefore gated on a target-tenant BC custom
API/action that creates return orders from a verified source order within BC. The scope
defines company-scoped authorization, strict payload ownership, idempotency, sandbox
contract testing, non-goals, acceptance criteria, dependencies, and required BC decisions.

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-138` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-138\SCOPE.md` before
planning. Do not write portal return code until the target BC sandbox metadata/operations
have verified the return-document contract. Treat a tenant BC custom API/action that
creates the return order from a verified source sales order as a hard prerequisite; do not
assume a public `salesReturnOrders` endpoint or substitute a sales order/credit memo.
Reuse the authenticated customer-to-company resolution from
`apps\backend\src\api\store\bc-orders\route.ts`, keep all mutations in a Medusa
workflow, and plan persistent idempotency/reconciliation for ambiguous BC write outcomes.
Plan source-order ownership checks, strict line/quantity validation, mocked BC-boundary
tests, and the storefront entry flow that depends on NIMBUS-137 order detail. Keep Jira
business-facing and technical plans only under `issues\NIMBUS-138\`.