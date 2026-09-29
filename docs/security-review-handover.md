# Security review handover: Medusa backend and storefront

Copy this document into the other solution and use the prompt below to start its
review. It preserves findings from the Nimbus Nordic solution so they can be
checked efficiently against a related codebase.

Prepared: 2026-09-20. Original reviewed revision: `42cf7c0` in
`AlphaSolutionsA-S/nimbusnordic-medusab2b`.

**These are findings in the source solution, not confirmed findings in the target
solution.** Check its current implementation, framework versions, deployment
configuration, and tests before assigning a final severity or reporting an issue.
Retain the original finding numbers below to make comparisons straightforward.

## Scope and exclusions

- Review the Medusa backend and Next.js storefront, including custom APIs,
  workflows, authentication, authorization, checkout, quotes, integration routes,
  server actions, and production dependencies.
- Exclude the separate CMS application. Original finding **1** concerned
  vulnerable Payload CMS dependencies and is intentionally omitted here.
- Still audit backend and storefront dependencies independently. Do not assume
  the original dependency versions, advisory counts, or patched versions apply.
- Finding **10** concerns a storefront authentication bypass. Check it if the
  target has a claims page or live-preview mechanism, even without a CMS app in
  its repository. Otherwise mark it not applicable.

## Prompt to give the reviewing agent

> Perform a security review of this solution's backend and storefront. Read this
> handover and the repository's AGENTS.md and relevant skills first. Use manual
> security reasoning as well as dependency advisories; do not limit the review to
> a scanner or these inherited findings.
>
> Establish the current commit and working-tree state, preserving existing edits.
> Treat each inherited finding as a hypothesis to verify against this codebase.
> Trace authentication, tenant membership, object ownership, body/query validation,
> and authorization through the actual route, middleware, workflow, and module
> service. Check both custom endpoints and relevant Medusa core endpoints/hooks.
> Verify framework behavior with the installed version rather than assuming it.
>
> Save a SECURITY-REVIEW.md report. For each inherited finding, mark it confirmed,
> already mitigated, not applicable, or unresolved, with evidence. For confirmed
> and newly discovered issues, include severity, exact file/line references,
> attacker prerequisites, a concrete abuse scenario, impact, recommended fix, and
> regression checks. Separate confirmed vulnerabilities from hardening suggestions
> and unverified deployment assumptions.
>
> Audit production dependencies and verify relevant advisories using authoritative
> sources. Do not copy the old solution's advisory counts or version recommendations.
> Use disposable local databases and synthetic accounts for active tests. Do not
> probe production, expose secrets, apply live migrations, deploy, or publish
> findings externally. The requested deliverable is a review; implement fixes only
> if separately requested. State any tests or checks that could not be completed.

## Inherited findings

### 2 — High: company administrator authorization is not tenant-scoped

**Source behavior:** `ensureRole` trusted an authentication provider's
`user_metadata.role === "company_admin"` instead of checking the customer's
employee membership and administrator flag for the requested company. It also
allowed access when the target company had no employees, to support signup.

**Impact:** a company administrator could exercise privileges in other companies.
The empty-company exception could allow an unrelated customer to establish the
first administrator of a company they did not own. Provider metadata is not an
adequate substitute for current, company-specific authorization.

**Look for:**

- `apps/backend/src/api/middlewares/ensure-role.ts`
- `apps/backend/src/api/store/companies/middlewares.ts`
- `apps/backend/src/workflows/employee/steps/set-admin-role.ts`
- The storefront signup sequence in `apps/storefront/src/lib/data/customer.ts`

**Recommended fix:** resolve the authenticated actor's employee server-side;
require `employee.company_id` to match the target and `employee.is_admin` for
administrative operations. Check a target employee belongs to that same company.
Remove the empty-company exception. Create a new company and its first
administrator together in a server-controlled workflow; prevent an already-linked
customer from using registration to gain another membership. Adapt signup clients
so they do not issue a separate privileged employee-creation request.

**Regression checks:** an administrator of A cannot change B; an ordinary member
cannot promote themselves; stale or forged provider roles grant no authority;
an unrelated customer cannot claim an empty company; legitimate signup still
creates exactly one initial administrator.

### 3 — High: direct company endpoints lack object-level authorization

**Source behavior:** company GET, POST, and DELETE endpoints accepted a company ID
without consistently enforcing membership or administration of that company.
Authentication alone did not establish access to the requested company.

**Impact:** a customer knowing another company's ID could read company information
or perform unauthorized updates/deletion.

**Look for:** `apps/backend/src/api/store/companies/[id]/route.ts`, its middleware,
and nested employees/approval-settings routes.

**Recommended fix:** require membership for reads and company-specific
administration for writes/deletion. Verify nested employee IDs against the company
in the URL. Mutations should use the validated request body, not `req.body`.

**Regression checks:** exercise GET, POST, and DELETE across two companies, plus
ordinary-member writes and a foreign employee ID under the caller's own company
URL. Include successful authorized reads/writes so a broken route is not mistaken
for effective authorization.

### 4 — High: quote operations do not consistently enforce customer ownership

**Source behavior:** customer acceptance, rejection, messaging, and preview
operations used a supplied quote ID without consistently checking that the
authenticated customer owned it.

**Impact:** a customer could inspect or change another customer's quote, inject
messages, or trigger order-related actions through the quote workflow.

**Look for:**

- `apps/backend/src/api/store/quotes/[id]/{accept,reject,messages,preview}/route.ts`
- `apps/backend/src/workflows/quote/workflows/customer-accept-quote.ts`
- `apps/backend/src/workflows/quote/workflows/customer-reject-quote.ts`
- `apps/backend/src/workflows/quote/workflows/create-quote-message.ts`
- Also check `create-request-for-quote.ts` for ownership of the source cart.

**Recommended fix:** derive the customer ID from the authenticated actor and
enforce ownership before reads or side effects. Pass the authorized result into
subsequent mutations. Keep merchant/admin authorization separate from customer
ownership checks. A customer must not create a quote from another customer's cart.

**Important framework lesson:** an HTTP regression test in the source solution
proved that adding `customer_id` beside `id` in the legacy
`useRemoteQueryStep.variables` object did **not** reliably apply that filter:
foreign quote rejection still returned 200. Use `useQueryGraphStep` with explicit
`filters`/`options`, or the documented nested `variables.filters` form where the
legacy helper remains necessary. Prove the behavior with the installed version.

**Regression checks:** customer B cannot accept, reject, message, or preview A's
quote, and no quote/order/message changes occur on denial. Test an owner operation
successfully. Also test creating a quote from a foreign cart.

The source's default quote field selection exceeded Medusa's three-relation depth
limit and returned 400 before reaching handlers. Tests used a supported explicit
field list, such as `?fields=id,status,draft_order_id`, to exercise authorization.
Do not treat unrelated validation errors as proof that an ownership check works.

### 5 — High: approval decisions lack authority over the target company

**Source behavior:** the store approval update route checked a broad administrator
role and approval type, but did not establish that the administrator belonged to
the company associated with the target approval's cart.

**Impact:** an administrator of one company could approve or reject another
company's purchase request.

**Look for:** `apps/backend/src/api/store/approvals/[id]/route.ts`, its middleware
and validators, and `apps/backend/src/workflows/approval/workflows/update-approval.ts`.

**Recommended fix:** resolve the approval, cart/company, and acting customer's
employee membership server-side. Require administration of the matching company
for store-side `admin` approvals. Derive `handled_by` from the authenticated actor;
restrict accepted decision values and keep merchant-only approval types separate.

**Regression checks:** foreign-company decisions fail without changing state;
ordinary members cannot decide; company administrators can decide their own
pending requests; a store customer cannot grant a sales-manager approval or spoof
the handling actor.

### 6 — High: checkout approvals can be skipped or invalidated by later cart changes

**Source behavior:** checkout blocked pending approvals but did not require all
configured approval types to exist and be approved. Missing or rejected approvals
could therefore pass that check. Cart mutation paths did not consistently prevent
changes after approval.

**Impact:** a buyer could bypass required authorization or approve one purchase
and then change its contents, quantities, delivery, or price-related inputs.

**Look for:**

- `apps/backend/src/workflows/hooks/validate-cart-completion.ts`
- `validate-add-to-cart.ts` and `validate-update-cart.ts` in the same directory
- `apps/backend/src/utils/get-cart-approval-status.ts`
- Cart item, bulk-item, promotion, shipping, and customer-assignment endpoints
- Approval creation, decision, aggregate-status, and retry workflows

**Recommended fix:** checkout must require an approved decision for every
configured type, using authoritative company settings. Missing, pending, rejected,
or incomplete sets must fail. Either freeze pending/approved carts across all
relevant mutation paths, or invalidate approvals whenever protected inputs change
and require fresh approval. Use workflow checks and consistent cart locking so
concurrent requests cannot bypass middleware-only checks.

The source patch chose to freeze pending/approved carts. Rejected carts could be
edited and resubmitted; old requests were replaced, and only pending requests could
receive a decision. This prevents reapproving an old rejected request after edits.

**Retry/rollback lesson:** when reusing an aggregate approval-status record, do not
recreate its existing cart link. Compensation must restore its previous status,
not delete the existing record. Test these paths; merely blocking bad requests is
not sufficient if legitimate resubmission stops working.

**Regression checks:** checkout without requesting approval; rejected approval;
one approved type with another required type absent/pending/rejected; all required
types approved; no approval requirement. Exercise add/update/delete/bulk items,
promotions, shipping, and customer changes. Test rejected-cart resubmission and
attempts to approve the obsolete request. Include concurrency tests where practical.

### 7 — Medium: spending limits do not account for accumulated spending

**Source behavior:** the spending-limit check compared the current cart total with
the employee's limit but did not include prior spending in the configured period.

**Impact:** an employee could exceed a periodic budget through several individually
allowed purchases.

**Look for:** `apps/backend/src/utils/check-spending-limit.ts`, checkout hooks,
employee spending limits, and company reset-frequency settings.

**Recommended fix:** first confirm whether the business rule is a per-order limit
or a cumulative period budget. For a cumulative budget, calculate authoritative
eligible spending for that employee and period, define cancellation/refund and
currency behavior, and serialize/reserve concurrent purchases so two checkouts
cannot both spend the same remaining allowance.

**Regression checks:** repeated purchases crossing the limit, simultaneous
checkouts, reset boundaries, and agreed refund/cancellation behavior.

**Source status:** this finding was outside the requested remediation scope and
was not fixed in the source work.

### 8 — High: cart/company association trusts client-supplied metadata

**Source behavior:** custom cart/company linking trusted `cart.metadata.company_id`
without independently establishing the customer's membership in that company.

**Impact:** a customer could attach a cart to another company. Trace downstream
effects on approvals, commercial data, pricing, and order attribution in the target
solution before making more specific impact claims.

**Look for:** search backend and storefront for `metadata.company_id`, cart/company
links, cart-created hooks/subscribers, and company values forwarded during checkout.

**Recommended fix:** derive the company from authenticated customer membership on
the server. Reject mismatches and validate existing links when transferring a cart
or completing checkout. Do not treat a linked company as authoritative if the link
was originally created from unverified client metadata.

**Regression checks:** create/update a cart with a foreign company ID; transfer a
cart across customers; omit/alter metadata; attempt checkout using a stale or
forged link. Verify authorized company attribution remains correct.

**Source status:** this finding was outside the requested remediation scope and
was not fixed. It remains relevant when evaluating the strength of approval fixes.

### 9 — High: Business Central operations can be exposed without authentication

**Source behavior:** customer authentication was commented out on the Business
Central store middleware. A duplicate matching entry with `middlewares: []` also
needed removal; uncommenting the authentication line alone was insufficient to
establish the intended middleware configuration.

**Look for:** `apps/backend/src/api/store/business-central/middlewares.ts`,
`operations/route.ts`, middleware aggregation, and integration operation dispatch.

**Impact:** anonymous callers could reach integration operations intended for
authenticated customers. Determine the exposed operations and their effects in
the target rather than assuming every operation is equally sensitive.

**Recommended fix:** enforce customer authentication for the entire route family,
remove conflicting duplicate entries, and verify the actual registered routes.
Then assess whether each operation also needs company/object authorization or
merchant-only access; login is not a substitute for those checks.

**Regression checks:** requests without a customer session/token receive 401;
authenticated intended use works; unrelated customer/company resources remain
inaccessible. Mock external integration calls during tests.

### 10 — Medium: storefront preview parameter bypasses the login requirement

**Source behavior:** a claims-page live-preview path trusted a client-controlled
`livePreview=true` query parameter to bypass normal account authentication.

**Impact:** a visitor could opt into a privileged rendering path by changing the
URL. Determine whether this exposes only public content, restricted claims content,
or draft content in the target; do not assume a greater disclosure than demonstrated.

**Look for:** storefront claims routes/components, account layouts, middleware,
server-side CMS/data fetchers, and every use of `livePreview` or preview parameters.

**Recommended fix:** retain ordinary account authentication and require a verified,
authorized preview session for any preview exception. A URL flag, iframe location,
or client-side check is not proof of authorization. Never expose server credentials
to make the preview work.

**Regression checks:** anonymous requests with and without preview parameters;
unauthorized versus authorized preview sessions; normal signed-in claims access;
checks against restricted/draft data where that functionality exists.

**Source status:** outside the requested remediation scope; not fixed. Mark this
not applicable if the target has no comparable preview path.

## Additional review areas

Use the findings as starting points, not a complete checklist. Also inspect:

- Server actions and API routes for IDOR, mass assignment, missing validation, and
  privilege checks based only on client-rendered UI.
- Authentication/session cookies, token handling, password reset, and logout;
  CORS/CSRF controls appropriate to the actual authentication mechanism.
- Price, quantity, discount, currency, payment, refund, quote, and order state
  transitions, including races, replay, and idempotency.
- SQL/command/template injection, unsafe rich text or HTML rendering, and SSRF in
  URLs passed to integrations or server-side fetchers.
- Upload authorization/type/size controls, secret exposure, sensitive logs,
  unauthenticated operational routes, and resource-exhaustion controls.
- Production dependency advisories and whether the affected functionality is
  reachable in the deployed application.

## Source remediation and verification status

The user requested fixes for original findings **1–6 and 9** in the source
solution. Backend/storefront changes for **2–6 and 9** have been implemented and
the focused security regressions pass. Findings **7, 8, and 10** were not included.
Validate any port independently against the target's implementation and versions.

Useful source artifacts to inspect, if available:

- `docs/security-remediation.md`: implementation and rollout notes.
- `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`:
  HTTP regression scenarios, including tenant isolation and quote ownership.
- `apps/backend/src/utils/__tests__/validate-cart-approvals.unit.spec.ts`:
  checkout approval cases.
- `apps/storefront/src/__tests__/lib/data/customer.test.ts`: signup sequencing.

Validation follow-up on **2026-09-20** recovered the previously unconfirmed HTTP
result and completed further checks. All **22 security HTTP regressions**, all
**21 backend source unit tests**, and the backend production build pass. All 16
company HTTP cases were verified across the combined run and a focused rerun;
all 7 company-sync cases passed in the recovered earlier log. The storefront signup
regression had already passed. HTTP testing caught and corrected the legacy quote
filter problem and a rejected-approval resubmission failure.

The storefront production build now passes with a disposable local backend and
empty catalog. Its earlier missing-backend failure is resolved for this validation
setup. This does not cover populated catalog rendering, staging integrations, or
browser checkout. The existing build configuration skips TypeScript validation.

The repository still has broader validation failures: backend/storefront
TypeScript diagnostics, storefront banner/product-tab tests, a Business Central
pagination mock that expects 10 batches against a 50-batch service limit, and
legacy quote HTTP fixtures that create unpublished products. See
`docs/security-remediation.md` for detailed results and release checks. These are
source-environment observations, not findings to assign automatically to the
target solution. The earlier execution-credit blocker no longer applies.

## Expected review output

Start the target report with its repository/revision, scope, inspected components,
and validation limits. Include an inherited-finding status table using IDs 2–10.
Give each confirmed or new issue its own evidence and remediation section. End
with prioritized next steps and the specific outstanding checks. Keep secrets and
real customer data out of reports, examples, and test fixtures.
