# Deviation report: Restrict store quote response fields

> Record of NIMBUS-207, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Reviewed on 2026-10-24 against merge-base `016ec41258802ef833109d25470e44924e6869b2`, through `18b2598` (implementation `59accdc`). The approved plan is implemented; no mechanical wiring changes are requested. This is source review approval, with the HTTP verification gap requiring a decision at the final human gate.

## Deviations from scope and plan

- Creation has no messages under the existing contract. Tests assert an empty array on creation and populated staff/customer author records on the remaining six response routes. Acceptable.
- The quote compatibility fixture explicitly publishes its product and assigns its sales channel through the Admin API, asserting both before cart creation; the shared seeder ignores its `data` argument. Its region also includes the US. Acceptable fixture corrections; shared helpers and production writes are unchanged.
- Both scoped HTTP suites and the final full module/HTTP suites stop in global setup because `BUSINESS_CENTRAL_DISCOVERY_URL` is missing. BC and database configuration are absent from the Process and Windows User scopes. No guard or authentication bypass was made. This leaves the planned HTTP privacy and runtime compatibility evidence unavailable; see the human decision below. The NIMBUS-236 login baseline could not be re-measured because startup stops earlier.
- The registry introduction was shortened to keep regenerated AI instructions within their existing size limit. Acceptable; no rule or limit was weakened.
- Lint used task-local `XDG_CONFIG_HOME` because Medusa's normal user configuration was outside writable sandbox access. Acceptable; lint still ran and reported its existing warnings.

## Consolidation changes

The consolidation pass made no implementation or test changes. It checked security-path coverage, duplication, dead code and plan adherence, and recorded final verification. Production changes remain confined to `apps/backend/src/api/store/quotes/query-config.ts`.

## Findings

- **Medium — verification gap:** `apps/backend/integration-tests/http/security/security-boundaries.spec.ts:233` and `apps/backend/integration-tests/http/quotes/quotes.spec.ts:94` contain the planned HTTP privacy/ownership and storefront compatibility cases, but none ran against PostgreSQL. Real-library middleware tests establish selection behavior, not actual linked-record serialization, action responses or browser display. The human must decide whether to permit push with this gap or require the guarded integration run first.
- **Low — existing type limitation, accepted in the plan:** storefront quote response types remain broader than the narrowed runtime projection. No storefront source changes were needed by the inspected consumers, but typechecking alone cannot establish compatibility. The HTTP compatibility case and controlled release check remain the evidence needed.
- No new design or mechanical wiring defect found. Both exported query configurations use one normalized exact-path allowlist; sensitive customer/employee/company and author parents are excluded. All seven existing response routes receive these configurations through the existing middleware registrations. Company/name and author/name leaves match the plan, and retained item/order selections and valid sorting/state fields remain allowed. Relation depth four is local to quotes.
- Ownership and mutation preconditions remain in the existing customer-scoped queries and workflows; authentication, storage writers, state transitions, sessions, locks, retention, encryption and Admin routes are unchanged. No migration, new module, dependency, cross-app import, new UI text, client secret or new logging was introduced.
- The installed field parser and exact allowlist implementation corroborate the plan's normalization and exact-path assumptions; public middleware tests exercise this reliance. Production uses the existing public framework middleware, with no new internal framework imports or custom sanitizer.
- The company visibility rule remains owned by the company projection and is registered in `ai/architecture/decisions.md`; quotes apply a narrower fixed projection without implementing a second role rule. Current store-access, order-API and API-route guidance was updated. No stale current-behavior description was found in the reviewed affected documentation; historical cases stay frozen.
- No new dead export, duplicate route/module, generated-file dependency, blanket cast or service-mocking seam found. Existing quote configuration exports remain consumed. Working tree was clean at review start. No standalone architecture checker is configured; the relevant layer, boundary and whole-branch checks were reviewed directly.

## Tests

Evidence below comes from task/finalization results; this review did not repeat builds, tests or lint. Logs are under `.scratchpad/NIMBUS-207-20261024-1440/`.

- **Passed:** 20/20 source tests against public Medusa `validateAndTransformQuery`, covering both configurations, safe defaults, explicit/additive/prefix-star/suffix-star/bare-parent widening attempts, colleagues and unlisted relations, safe leaves, retained draft-order state, allowed/forbidden sorting, local relation depth, repeated requests and ten concurrent calls. All 20 failed before implementation.
- **Passed:** final backend units, 71 suites / 880 tests. Generated JavaScript duplicates are included in those totals; they are not 880 distinct source tests. Backend build passed. Lint had zero errors and 13 existing warnings. Backend typecheck retained exactly the same 22 diagnostic lines as the measured baseline. Storefront typecheck had 58 diagnostics in untouched code; no green typecheck is claimed. AI instruction checks and diff whitespace checks passed.
- **Present, execution blocked:** both employee roles across create/list/retrieve/preview/accept/reject/messages under default, additive malicious and explicit malicious selections; exact company and populated author objects; colleague exclusion; foreign list/read/action/preview denial with unchanged quote/message storage and no private values in refusal bodies. Existing foreign-action tests remain.
- **Present, execution blocked:** product-backed nonempty quote compatibility assertions for own contact/spending data, message names/references, item/variant/product data, numeric totals/summary and preview values, alongside retained existing action contracts. The reviewed fixture now explicitly publishes and links the product before cart creation.
- Branch additions: **310 test lines / 28 production lines** (4 test lines / 5 production lines removed), about 11:1. The HTTP matrix reuses assertions across roles, selection forms and endpoints; the middleware/HTTP layers prove different properties. No material source-test duplication was found. The final full-suite count's generated duplicates are disclosed above; there is no target ratio.
- **Not verified:** any HTTP/database result, deployed leak closure, quote action delivery or storefront browser compatibility. No deployment was performed.

## Open questions

1. Before push, do you approve proceeding with the recorded HTTP/database verification gap, or require the changed quote/security suites to pass in the established guarded integration environment first? Recommended: obtain that scoped HTTP evidence before merge/release. Either choice retains the controlled after-deploy verification below; no test guard or authentication relaxation is authorized.
   **Answer:** Klaus Petersen authorized "push and merge to develop" on 2026-10-24 after the HTTP/database gap was presented. Proceed with the recorded gap; retain the controlled after-deploy verification and do not weaken guards.
2. After considering that limitation, may the dispatcher continue to final documentation/cleanup, commit the final records and push/open the PR? Implementation/plan approval is already resolved; this is the repository's separate final push gate. No push has occurred.
   **Answer:** Klaus Petersen explicitly authorized finalization, push, PR creation and merge to develop on 2026-10-24: "push and merge to develop". Respect required checks and branch protections.

## Verify after deploy

Task 01 — Restrict quote projections and prove response compatibility:

**Verify after deploy:** With one controlled non-admin employee's owned quote containing customer/staff messages, inspect GET list/detail/preview and post-message response: company name only, author names only, no forbidden company/colleague fields even with malicious fields; confirm quote detail and conversation display. Record the controlled quote ID at release, without customer data or credentials.

Release evidence must record the actual controlled responses and display result separately from local test results. The HTTP privacy matrix additionally covers both roles and all seven response routes and should run when the guarded integration environment is available.
