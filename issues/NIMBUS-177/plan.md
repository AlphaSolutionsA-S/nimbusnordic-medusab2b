# Plan: Protect company-linked carts from access by cart ID alone

> Record of NIMBUS-177, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Key:** NIMBUS-177 · **Scope:** `scope.md` (approved 2026-10-20) · **Base branch:** develop
**Apps:** backend, storefront · **Skills used:** medusa-backend, medusa-api-route,
medusa-workflow-and-steps, medusa-storefront, nextjs-data-layer, secure-coding-owasp

## 1. Summary [High]

Every Store API request that reads or changes a cart, or that reaches a cart through a cart,
payment-collection or approval identifier, gets one backend check before the route runs: who is
signed in, whether they own the cart, whether the cart's company is still their company, and, for
a company administrator, whether the cart is under that company's approval. Today any caller with a
cart ID can read and edit an editable cart, and the core "set cart customer" route lets any signed-in
customer take over any cart (verified in installed Medusa 2.21.0). At Klaus's request the store
order routes that work by order ID get the same treatment: reading an order and creating a return
need the owner or an administrator of the source cart's company once its approval is approved and
while the owner is still a member, and order
transfer requests stay open to signed-in customers for orders without an account owner and no
longer return the order.

Three decisions shape it. First, the rule lives in one pure decision function, run by one workflow
that one guard middleware calls on every cart route; Medusa's workflow hooks cannot cover reads
(`GET /store/carts/:id` runs no workflow). Second, the company of a cart is the company–cart link,
written at creation from the owner's employee record, never from `metadata.company_id`; existing
carts are judged per request (owner set, link equals the owner's current company), so no data
migration runs and ambiguous carts are refused automatically. Third, sign-in is required for every
cart route, including creation, and a refused signed-in caller gets the same 404 as a missing cart.

How to review this plan: approving it is the human gate that allows dispatch. Sections carry a
review level; read High and Critical closely, and stop at each `Critical` flag (in sections 3, 6 and
7). The data model and state tables are High because past misses were found there. Task files hold
more depth but are not required reading. An uncertainty is often quicker to settle by asking the
planning agent in chat than by reading further.

## 2. Needs your decision [Critical]

Answered by Klaus Petersen on 2026-10-20 ("1 ok, 2 OK, 3 protect with this as well"):

1. Trusted recovery. **Answer:** no recovery tool; an ambiguous cart stays untouched (approval state
   frozen) and the customer starts a new cart.
2. Cart-scoped shipping options (`GET /store/shipping-options?cart_id=`, `POST
   /store/shipping-options/:id/calculate`). **Answer:** protected with the cart read check.
3. Store order routes by ID. **Answer:** brought into this plan and protected (task 06, flow F,
   section 6 order table). Verified in installed 2.21.0: `GET /store/orders/:id` is deliberately
   unauthenticated; `POST /store/orders/:id/transfer/request` lets any signed-in customer request any
   order that is not already theirs and returns the full order; `POST /store/returns` creates and
   completes a return for any `order_id` without sign-in.

   Follow-up answer ("can you leave request transfer open for all signed in", then "keep transfer
   open but dont return order"): **Answer:** order transfer request stays open to every signed-in
   customer as in core, but our route answers `200 { "success": true }` and never returns the order.
4. Former company members and their own orders. **Answer** ("4 ok"): an order's owner may always read
   their own order by ID, matching the core order list; the membership-loss rule stays a cart rule.

New, raised by the transfer answer:

5. Transfer cancel. Core lets only the customer who made a transfer request cancel it, and core's
   cancel response returns the full order. **Answer** ("D5 ok"): keep core's cancel rule and answer
   `200 { "success": true }` as for the request (flow F8).
6. Transfer of account-owned orders. **Answer** ("2 yes refuse"): a transfer request is refused when
   the order's customer (`order.customer_id`) is a customer with `has_account = true`; only orders
   with no customer or a guest customer can still be requested (flow F7).

Klaus Petersen approved the plan with these answers on 2026-10-20 ("3 the approved"). An external
review then found gaps in the approval routes and administrator order access (task 07, task 06
tests); Klaus Petersen approved the revised plan on 2026-10-20 ("plan approved").

Raised by the external review:

7. Returns for administrators. The order rule held by this plan: an order can be read by its owner
   and by any administrator of the source cart's company (not only the one who approved), provided
   the owner is still a member and the cart's admin approval is approved. **Answer:** option A
   (overriding the proposed owner-only default): the same administrators may also create returns
   for such an order. Core's return route records no actor, so the return carries no record of
   which administrator created it.

No decision is open.

## 3. Flows [High]

### A. Signed-in customer creates and uses a cart (tasks 01, 02, 03, 04)

1. A signed-out visitor adds a product to the cart; the storefront creates no cart and shows a
   translated "sign in to order" prompt.
2. A signed-in customer adds a product; the storefront asks the backend to create a cart.
3. The backend refuses creation without a valid customer token (401).
4. Core cart creation sets the cart's customer from the token (a client `customer_id` is rejected by
   the strict body schema; a body `email` cannot switch customer once the token is present).
5. The cart-created hook reads the customer's employee record and links the cart to that company;
   no employee record means no link. `metadata.company_id` is ignored for this.
6. The storefront stores the cart ID in its httpOnly cookie.
7. Every later cart request runs the guard: authenticate, then the access decision (B), then the
   existing frozen-cart checks, then the route.

### B. Guard decision on each protected request (tasks 01, 03)

1. Route-level authentication rejects a request without a valid customer session or bearer token
   (401) before any cart lookup.
2. The guard resolves the cart ID from the path, body (`cart_id`), query (`cart_id`) or, for payment
   sessions, from the payment collection's cart link. A collection with no cart is refused.
3. The guard workflow reads, fresh from the database: the cart's customer, its company link, its
   admin-type approvals, the owner's current employee company, and the caller's employee company and
   admin flag.
4. The decision function returns allow or refuse for the operation class of the route (section 6).
5. Refusal and a missing cart both answer 404 "Cart not found"; nothing about the cart is returned
   and the route never runs. `Critical`: the response must be byte-identical for both cases, or the
   check becomes an existence oracle.
6. Allowed responses carry `Cache-Control: private, no-store`.

### C. Administrator reviews and pays a colleague's cart (tasks 01, 03, 04)

1. The colleague submits the cart for approval; it freezes (existing behaviour).
2. The administrator opens Approvals; the list returns only carts with a verified association
   (owner set and still a member of the linked company), using the task 01 rule (task 07).
3. Each approval card reads the colleague's cart; the guard allows read because the caller is an
   administrator of the cart's company, the owner is still a member, and the cart has an admin
   approval.
4. The administrator approves through the existing decision route (server assigns `handled_by`);
   the decision is refused with the route's existing 403 unless the cart has a verified association
   (task 07).
5. The administrator opens checkout for that cart; reads, shipping-option listing and free-shipping
   nudges pass as read (B).
6. Payment collection, payment session and completion pass as pay only when an admin approval is
   approved. Any edit (items, addresses, shipping method, promotions) is refused to the
   administrator by the guard and to everyone by the frozen-cart check.

### D. Login, logout and account switch (task 04)

1. On login the storefront reads the cookie cart with the new account's token.
2. If the backend refuses or the cart is missing, the storefront clears the cart cookie; it never
   calls customer transfer and never rewrites cart metadata.
3. On logout the storefront clears token and cart cookies (existing) and revalidates cache tags.
4. A retained cart cookie from another account yields 404 on the next request; the storefront shows
   the translated "this cart is no longer available" notice where the cart was expected (cart page,
   checkout) and the next add-to-cart creates a new cart.
5. Cart, approval and shipping fetches are made with `no-store`, so no response is reused across
   accounts.

### E. Existing carts at rollout (tasks 01, 05)

1. Nothing is migrated. On first access the decision applies (B3–B4).
2. Owner set and company link equal to the owner's current company (or no link and no employee
   record): preserved, including approval state.
3. No owner, owner who is an employee but no link, or link to a company other than the owner's
   current company: refused for everyone; pending or approved carts stay frozen; the customer starts
   a new cart (decision 1).
4. The deployment note in `docs/security-remediation.md` states this, and that the translation keys
   from task 04 are imported before the storefront is released.
5. Existing orders need no migration either; the order rule (F) is evaluated per request.

### F. Reading an order and order side routes (tasks 04, 06)

1. After checkout the storefront redirects to the order confirmation page, which reads the order by
   ID with the caller's token; order history uses the existing customer-scoped list.
2. Route-level authentication rejects a signed-out caller (401) on the order read and return
   creation routes; core already does so for transfer request and cancel.
3. The order guard reads, fresh: the order's customer, its source cart (core order–cart link), that
   cart's company link and admin approvals, the owner's current employee company and the caller's
   employee company and admin flag.
4. The owner may read the order (decision 4). An administrator may read it only when the source
   cart is linked to the administrator's company, the owner is still a member, and the cart's admin
   approval is approved; this is the administrator who paid for the colleague's cart and lands on
   its confirmation page.
5. Return creation follows the same rule as reading (step 4): the owner, or a qualifying
   administrator (decision 7).
6. Refusal and a missing order answer the same 404; the order-company link written from metadata
   (finding 8) is not consulted.
7. Transfer request: any signed-in customer may call it (decision 3). Our route replaces core's
   handler and runs our workflow: a first step reads the order and its customer's `has_account`
   (404 for an unknown order, as core) and refuses with 400 `invalid_data` "Order cannot be
   transferred" when the order belongs to a customer with an account (decision 6); otherwise core's
   request-transfer workflow runs unchanged. Success answers `200 { "success": true }` with no order
   data. Core's remaining errors pass through: 400 for a cancelled order, a guest caller or an order
   with an active change. `Critical`: the refusal reuses core's status and error type for this route
   but not its wording, because core's own-order message names customer IDs. Because the refusal
   runs first, the caller's own order and another account's order now get the same answer, which
   hides the ownership hint core used to give. The new message does tell a caller that an existing
   order belongs to an account rather than a guest; that is one bit beyond core's errors, accepted
   as the price of the refusal.
8. Transfer cancel keeps core's rule (only the customer who made the request may cancel it), but
   core's handler returns the full order to that requester, which would undo step 7: request, then
   cancel, then read the order. Our route therefore replaces the cancel handler the same way, running
   core's cancel workflow and answering `200 { "success": true }` (decision 5).
9. Transfer accept and decline stay core: they need the request's token, which no store response
   contains and nothing sends (section 10).

## 4. What gets built [High]

**01 Cart access decision and authorization workflow.** A pure decision function (L5) that, given
plain data about the caller, the cart and the operation class, returns allow or refuse; it is the
single home of the cart-access rule and gets a row in the business-rule registry. A step (L3) that
reads the inputs through Query (a commented exemption from `data-core-read-workflows`; core-flows
has no cart read workflow) including the reverse lookup from a payment collection to its cart, and
fails with a 404 "Cart not found" on refusal or absence. A workflow (L4) that runs the step. Rules
enforced: section 6.

**02 Trusted company link at cart creation.** The cart-created hook (L4 hook) is rewritten to derive
the company from the cart customer's employee record and to fail creation when the cart has no
customer. The create-cart route gets route-level customer authentication (L6 middleware). This
removes the `trust-no-client-company` baseline for carts; the order-created hook keeps its baseline
(finding 8, orders, out of scope).

**03 Guard on every direct and indirect cart route.** One guard middleware factory (L6 middleware,
like the company-access middleware) that authenticates the customer, runs the 01 workflow with the
route's operation class, and sets the private no-store header. It is registered, ahead of the
existing frozen-cart middleware, on: `GET/POST /store/carts/:id`, `POST /store/carts/:id/customer`,
`POST /store/carts/:id/line-items`, `POST/DELETE /store/carts/:id/line-items/:line_id`,
`POST /store/carts/:id/line-items/bulk`, `POST/DELETE /store/carts/:id/promotions`,
`POST /store/carts/:id/shipping-methods`, `POST /store/carts/:id/taxes`,
`POST /store/carts/:id/complete`, `POST /store/carts/:id/approvals`, `POST /store/quotes`,
`POST /store/payment-collections`, `POST /store/payment-collections/:id/payment-sessions`,
`GET /store/shipping-options`, `POST /store/shipping-options/:id/calculate`,
`GET /store/free-shipping/prices`. Customer transfer becomes owner-only, so a cart can no longer be
claimed. The existing security regression spec gets the access matrix.

**04 Storefront sign-in, cart lifecycle and messages.** Data functions (S2): cart creation and
add-to-cart require a token and otherwise return a stable sign-in-required code; retrieving the
cookie cart distinguishes "none" from "no longer available"; login clears an inaccessible cart
cookie and stops calling transfer and the metadata update; signup stops calling transfer; cart,
approval and shipping fetches use `no-store`. Feature components (S4): the add-to-cart controls
show a translated sign-in prompt; cart page and checkout show a translated unavailable notice. The
cart-mismatch banner and the transfer action are removed, since no unowned cart is reachable. New
keys go into `messages/*.json` for admin import. Order fetches (confirmation, order detail, order
history) also use `no-store`; a refused order keeps today's not-found page.

**05 Documentation of the access rules and rollout.** `docs/security-remediation.md` gets the cart
and order access rules, the rollout behaviour for existing carts, the translation import step and
the after-deploy check; finding 8 is marked as fixed for carts and open for the order–company link,
which store order access no longer consults.

**06 Order access decision and guard.** A second pure decision function (L5) for orders, beside the
cart one and sharing its "owner is still a member of the cart's company" predicate, gets its own
registry row. A step and workflow (L3, L4) read the order's customer and, through the core
order–cart link, the source cart's company link and admin approvals (Query exemption as in 01), and
fail with the order-not-found 404. The guard factory from 03 gets an order variant (L6 middleware)
with route-level customer authentication, registered on `GET /store/orders/:id` (`read`) and
`POST /store/returns` (`return`, order from body `order_id`), and sets the private no-store header.
Two project route files (L6) replace core's handlers for `POST /store/orders/:id/transfer/request`
and `/transfer/cancel`: each answers `200 { "success": true }` without returning the order, and
core's authentication and validation middlewares still run. Cancel runs core's cancel workflow with
the inputs core passes. Request runs a new workflow (L4): a check step (L3) reads the order's
customer and refuses account-owned orders through a pure decision function (L5, registry row), then
core's request-transfer workflow runs as a step. Token-gated transfer accept and decline stay as
they are. Rules: section 6 order table. The HTTP tests include a real cart completion: an
administrator approves and pays a colleague's cart, then that administrator and a second
administrator of the same company read the resulting order, and an administrator creates a
return for it.

**07 Approval list and decisions respect the verified association.** Today the approvals list
(`GET /store/approvals`) returns company carts, with items and cart fields, found through the stored
company link alone, and the approval decision step checks the administrator against that link but
not the owner's current membership. Both now apply the task 01 "verified association" predicate
(the one home of the rule): the list read moves into a workflow (L4) whose step (L3) reads the
carts with their owners' current employee company and keeps only verified carts, and the route
(L6) shapes the unchanged response from it; the decision validation step (L3) refuses with its
existing 403 when the association is not verified. Rules enforced: an ambiguous cart is neither
shown to nor decidable by any administrator, and its approval state stays untouched.

## 5. Data model [High]

No tables, columns, links or migrations are added.

| Entity / field | Meaning | Existing callers | Owner | Written by | Stored / derived | Mutable until | Retention | Index |
|---|---|---|---|---|---|---|---|---|
| `cart.customer_id` | Cart owner; the only ownership fact | core cart routes, `create-approvals.ts`, `create-request-for-quote.ts`, `validate-cart-completion.ts` | Cart module | core create from the token; core transfer (now owner-only, so effectively never changes) | stored | never after creation (transfer is a no-op for the owner) | cart lifecycle, unchanged | core |
| company–cart link (`links/company-carts.ts`) | The cart's company; trusted only when equal to the owner's current company | approvals list route, `validate-company-approval.ts`, `create-approvals.ts`, `validate-cart-completion.ts` | link table (company × cart) | cart-created hook from the owner's employee record (task 02); legacy rows from client metadata | stored | not changed by this plan; legacy rows are judged, not rewritten | deleted with the cart link lifecycle (unchanged) | link table |
| `cart.metadata.company_id` | Legacy hint; still copied to the order for order-created (finding 8) | `hooks/order-created.ts` via order metadata; storefront create | cart metadata | storefront at creation; owner via cart update | stored | while the cart is editable | cart lifecycle | none |
| `employee.company_id`, `employee.is_admin` | Current membership and admin authority | `validate-company-access.ts`, `validate-company-approval.ts` | Company module | company management workflows, BC sync | stored; read per request | any time; access re-evaluated per request | membership policy, unchanged | existing |
| `approval.type`, `approval.status` (via cart–approval link) | Whether a cart is under admin review or approved | approval workflows, validators | Approval module | approval workflows | stored | existing approval lifecycle | existing | existing |
| Caller identity (`auth_context.actor_id`) | Signed-in customer | all store routes | Medusa auth | framework from JWT (1 day) or session | derived per request | — | token lifetime | — |
| `order.customer_id` | Order owner, copied from the cart at completion | core order routes and list, `create-request-for-quote.ts` | Order module | core cart completion; ingested orders have none | stored | core transfer accept only (token) | order lifecycle, unchanged | core |
| order–cart link (core `order_cart`) | The order's source cart; route to the trusted cart company and approvals | core payment compensation | core link | core cart completion | stored | never | core | link table |
| order–company link (`links/order-company.ts`) | Order's company; written from metadata for storefront orders (finding 8), server-side for ingested orders | BC order sync, order API | link table | `hooks/order-created.ts`, order ingestion | stored | not changed | unchanged | link table |
| `_medusa_cart_id` cookie | Pointer to the active cart; grants nothing | storefront data layer, storefront middleware (`?cart_id=`) | storefront | server actions; middleware | browser | cleared on logout, on login when inaccessible, after order | 7 days (1 day via middleware) | — |

Cardinality: a company has many carts and a cart at most one company link; a cart has many approvals,
the current ones are the non-deleted rows, and the admin path looks only at type `admin`.

## 6. Business rules as state tables [High]

Operation classes (wire values of the seam between tasks 01 and 03): `read`, `owner`, `pay`.

| Class | Routes |
|---|---|
| `read` | cart retrieve, shipping-option list and calculate, free-shipping prices |
| `owner` | cart update, line items (add, update, delete, bulk), promotions, shipping methods, taxes, customer transfer, approval request, quote request |
| `pay` | payment collection, payment session, complete |

"Verified association": the cart has an owner, and either the cart has a company link equal to the
owner's current employee company, or the cart has no link and the owner has no employee record.

| Caller | Cart state | read | owner | pay | Side effects |
|---|---|---|---|---|---|
| Anonymous | any | 401 | 401 | 401 | none |
| Signed in, no cart or refused | any | 404 | 404 | 404 | none; identical body |
| Owner | verified association, caller is the owner | allow | allow, then frozen-cart check (pending/approved refused 403) | allow, then existing approval and spending checks | actor is the owner |
| Owner who left or changed company | link ≠ current company | 404 | 404 | 404 | none |
| Same-company colleague, not admin | verified | 404 | 404 | 404 | none |
| Same-company admin, cart has an admin approval (any status) | verified, owner still a member | allow | 404 | allow only if an admin approval is `approved` | payment session created with the admin as customer (existing core behaviour) |
| Same-company admin, no admin approval | verified | 404 | 404 | 404 | none |
| Foreign-company customer | any | 404 | 404 | 404 | none |
| Anyone | ambiguous: no owner, employee owner without link, link ≠ owner's company | 404 | 404 | 404 | cart and approvals untouched |
| Anyone | payment collection with no cart link | — | — | 404 | none |

`Critical`: the admin `pay` path depends on the approval status alone; a rejected or pending admin
approval must never pass, and an approved cart remains immutable because the frozen-cart check still
runs on every `owner` route.

Orders (task 06). Classes `read` (`GET /store/orders/:id`) and `return` (`POST /store/returns`);
both follow the same rule (decision 7). "Source cart" is the cart linked to the order by core's
order–cart link.

| Caller | Order state | read | return | Side effects |
|---|---|---|---|---|
| Anonymous | any | 401 | 401 | none |
| Signed in, refused or no order | any | 404 | 404 | none; identical body |
| Owner (`order.customer_id` = caller) | any, including after leaving the company (decision 4) | allow | allow | return created with existing core behaviour |
| Same-company admin | source cart linked to admin's company, owner still a member, admin approval `approved` | allow | allow | return created with existing core behaviour; no actor recorded (core route passes none) |
| Same-company admin | any other case (no source cart, no or unapproved admin approval, owner left) | 404 | 404 | none |
| Colleague, foreign-company customer | any | 404 | 404 | none |
| Anyone but the owner | ingested order without customer | 404 | 404 | none |

Order transfer (not guarded by the order rule; decision 3):

| Caller | Request | Cancel | Side effects |
|---|---|---|---|
| Anonymous | 401 (core) | 401 (core) | none |
| Signed in, order owned by a customer with an account (including the caller) | 400 "Order cannot be transferred"; no order change | 400 from core (no active request) | none |
| Signed in, order with no customer or a guest customer | core validation, then `200 { "success": true }` | core: only the requester, then `200 { "success": true }` | request: an order change in status requested with a transfer token, which blocks every other order change on that order until cancelled or declined; event `order.transfer_requested` with no subscriber |
| Signed in, unknown order | 404 | 404 (core) | none |

Why this admin rule: the only approval relationship an order has is through its source cart, and
the storefront sends the administrator to the order confirmation page right after paying an approved
colleague cart (flow C). The order–company link is not used because storefront orders get it from
client metadata (finding 8).

Approval list and decisions (task 07):

| Caller | Cart | List | Decide | Side effects |
|---|---|---|---|---|
| Company admin | verified association, admin approval pending | shown | allow (existing rule: admin-type, pending only) | approval status changes; `handled_by` from the token |
| Company admin | owner left the company, or link differs from owner's current company | not shown | 403 | approval and approval status unchanged |
| Company admin | cart linked to another company | not shown | 403 (existing) | unchanged |
| Non-admin member | any | 403 (existing) | 403 (existing) | unchanged | Creation (flow A): refused without a token; the link is
written only by the hook.

## 7. Security-property matrix [Critical]

| Property | Control | Trust root | Failure behaviour | Negative test (task) |
|---|---|---|---|---|
| Trust anchor | route-level customer authentication on every cart route | framework-verified JWT (`jwtSecret`) or server session | 401, no lookup | anonymous on every route (03); anonymous create (02) |
| Company isolation | link must equal caller's current employee company | company module records, server-written link | 404 | foreign-company customer on every class (03) |
| Customer isolation | owner path requires `cart.customer_id` = caller | cart module record | 404 | same-company colleague (03) |
| Admin exception, narrow | admin read only with admin approval; pay only when approved; never `owner` | `employee.is_admin`, approval records | 404 | admin without approval; admin with pending approval paying; admin editing approved cart (03); decision cases (01) |
| No takeover or downgrade | transfer owner-only; client `customer_id` rejected; metadata ignored | cart record, employee record | 404 / 400 | non-owner transfer leaves `customer_id` unchanged; forged `metadata.company_id` at creation links the owner's own company (02, 03) |
| Replay and disclosed IDs | check repeated on every request; ID is never a credential | current token plus current records | 404 | replayed cart ID under another account (03) |
| Cross-instance | no in-memory state; fresh Query read per request | shared Postgres | missing records fail closed | none needed (no local state); stated in 05 |
| Browser binding / CSRF | storefront calls the backend server-side with the bearer token from an httpOnly SameSite=strict cookie; Next.js 15.5 server actions reject a mismatched Origin; backend session cookie is SameSite=lax in production; store CORS | framework controls (verified, section 9) | request rejected | none new (framework behaviour; not retested) |
| Logout / account switch | cookies cleared; inaccessible cart cookie cleared on login; `no-store` fetches; `Cache-Control: private, no-store` on guarded responses | current token | old cart answers 404 | stale cookie under a second account (03 backend, 04 storefront) |
| Approval integrity | guard complements frozen-cart and approval checks | approval records | 403 / 400 as today | existing frozen-cart and approval regressions stay green (03) |
| Approval routes respect the association | list filter and decision check use the task 01 predicate | company records, cart owner, link | not listed / 403 | list omits a cart whose owner left and a legacy mismatched cart, with no items or cart fields in the body; deciding either answers 403 and leaves approval status unchanged (07) |
| Personal data on failure | identical generic 404 body; no IDs echoed; storefront logs messages only | server response | no cart, customer or company data | body equality between refused and missing cart (03) |
| Order isolation | order guard for read and return: owner, or admin of the source cart's company with an approved admin approval and the owner still a member | order and cart records, company records; never the order–company link | 401 / 404 | signed-out, non-admin colleague, foreign-company customer, admin of another company, admin with no approval, admin with a pending or rejected approval, admin after the owner left, on order read and return creation; returns table unchanged after refusal (06) |
| No order data through transfer routes | project handlers for transfer request and cancel answer `{ "success": true }` only | core transfer workflows and their validation | core errors as today | guest-order request and own-request cancel return no order fields; signed-out 401 (06) |
| No transfer of account-owned orders | refusal step before core's request workflow | order record and its customer's `has_account` | 400, no order change | another account's order and the caller's own order both refused with the same body, no order change created (06) |
| Indirect access | collection → cart reverse lookup; body/query `cart_id` resolved before the route | link records | 404 | payment session for another customer's collection; quote, free-shipping, shipping options with a foreign cart (03) |

Known limit (unchanged): a bearer token stays valid until its one-day expiry after logout; logout
removes it from the browser only.

## 8. Decisions [High / Medium]

New in this plan:
- Returns follow the order read rule (decision 7, option A): owner or qualifying administrator.
- The approvals list and approval decisions use the same verified-association predicate as the cart
  guard (external review findings 2 and 3, confirmed in `api/store/approvals/route.ts` and
  `workflows/approval/steps/validate-company-approval.ts`); the list read moves out of the route
  into a workflow so the route does not branch on the rule.
- Guard middleware plus one decision function, not core workflow hooks: `GET /store/carts/:id`
  calls `refetchCart` with no workflow (verified, installed `carts/[id]/route.js`).
- Per-request judgement instead of a data migration or reconciliation script; legacy forged links are
  inert because both the owner and admin paths require the owner's current company to match.
- Customer transfer becomes owner-only: core `transferCartCustomerWorkflow` checks no ownership
  (verified, `core-flows/dist/cart/workflows/transfer-cart-customer.js`).
- Refusal is 404 with the missing-cart body for signed-in callers, 401 for anonymous callers.
- Payment collections without a cart link are refused (none are used by this storefront).
- Products' `cart_id` pricing context stays public: it reads only the cart's region and shipping
  country (verified, `utils/middlewares/products/normalize-data-for-context.js`).
- Storefront keeps sending `metadata.company_id` at creation, because the order-created hook still
  reads it (finding 8 for orders stays separate).
- Guarded responses set `Cache-Control: private, no-store`; storefront cart fetches use `no-store`,
  so the plan does not depend on Next.js or CDN caching defaults.
- Orders get their own decision function and guard variant rather than widening the cart rule:
  the inputs differ (order owner, source cart) and order reads have no frozen state.
- Order transfer request stays open to signed-in customers (decision 3); project route files
  replace core's request and cancel handlers so neither returns the order. Overriding the handler
  keeps core's middlewares and workflow (verified: a project route file overrides the core one,
  middlewares accumulate); the order guard is not applied, because core's own validation is the
  rule Klaus chose. The `fields` query parameter is still accepted by core's validator and ignored.
- Account-owned orders cannot be transferred (decision 6). The rule is a small pure decision
  function with its own registry row; our workflow runs its check step, then core's
  request-transfer workflow through `runAsStep`. Core's request workflow has no hook to attach the
  check to (verified: it creates none), so a wrapping workflow is the OOTB-first option.
- Token-gated transfer accept and decline are unchanged.
- `POST /store/returns` requires the owner or a qualifying administrator (decision 7); the
  storefront uses Business Central returns and has no caller of this route.
- Cart-mismatch banner and `transferCart` are removed: with sign-in required no unowned cart is
  reachable.
- Does the framework already do this? No: core store cart routes run only the global optional
  authentication and validators (verified, `medusa/dist/api/store/carts/middlewares.js`,
  `framework/dist/http/router.js`). No framework internals are called; the guard uses Query and the
  public authenticate middleware.

From the scope: sign-in before creating or using a purchasing cart; carts are personal; admin
approval-review and completion exception; verified existing carts preserved, ambiguous refused;
`handled_by` stays server-assigned; no new audit retention.

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| Global store auth | every `/store` request runs `authenticate("customer", ["bearer","session"], { allowUnauthenticated: true })` before route middlewares; an anonymous call continues without `auth_context` | `framework/dist/http/router.js` |
| Route-level `authenticate` | without `allowUnauthenticated` answers 401 when no actor; JWT verified with `ignoreExpiration=false` | `framework/dist/http/middlewares/authenticate-middleware.js` |
| Middleware order | all middlewares of a matcher register before its route handler; core middleware files load before project files and accumulate; a project route file overrides the core one | `router.js`, `routes-sorter.js`, `routes-loader.js`, `medusa/dist/loaders/api.js` |
| Method-scoped matcher | registered with `app[method](matcher)`, exact path; methodless entries use `app.use` (prefix) | `router.js` |
| Cart create | customer from `auth_context.actor_id`; strict body has no `customer_id`; with a customer id the email lookup cannot switch customer; `cartCreated` hook receives the created cart | `medusa/dist/api/store/carts/route.js`, `validators.js`, `core-flows/dist/cart/workflows/create-carts.js`, `steps/find-or-create-customer.js` |
| Cart update email | keeps the existing customer when the cart has one | `core-flows/dist/cart/workflows/update-cart.js` |
| Transfer | no ownership check; replaces customer and email | `transfer-cart-customer.js` |
| Payment routes | collection created from body `cart_id`; sessions by collection id with `customer_id` from the token; `cart_payment_collection` filterable by `payment_collection_id` | `payment-collections/route.js`, `[id]/payment-sessions/route.js`, `core-flows/dist/cart/steps/compensate-payment-if-needed.js` |
| Shipping options | list and calculate run against a required `cart_id` | `shipping-options/route.js`, `validators.js` |
| Store order routes | `GET /store/orders/:id` has no authentication (comment in route: the ID is the credential) and reads through `getOrderDetailWorkflow` excluding draft orders; `GET /store/orders` is authenticated and filtered by `customer_id`; transfer request and cancel authenticate; accept and decline are token-checked | `medusa/dist/api/store/orders/middlewares.js`, `route.js`, `[id]/route.js`, `[id]/transfer/*/route.js`, `core-flows/dist/order/workflows/transfer/*.js` |
| Transfer request validation | refuses only cancelled orders, guest callers and transfer to the current owner; any other signed-in customer can request any order, and core's handler then returns the full order (default store retrieve fields: email, items, shipping and billing addresses, payment collections, metadata) | `transfer/request-order-transfer.js`, `medusa/dist/api/store/orders/[id]/transfer/request/route.js`, `orders/query-config.js` |
| Transfer side effects | request creates an order change in status requested with a random token in its action details and emits `order.transfer_requested`; no subscriber for that event exists in installed Medusa or this repo; a requested change makes the order module refuse any further order change on that order ("already has an existing active order change") | `request-order-transfer.js`, `@medusajs/order` `order-module-service.js`, grep of `medusa/dist` and `apps/backend/src` |
| Account flag | `customer.has_account` is a boolean defaulting to false; `order.customer_id` is nullable text; core's request workflow defines no hook | `@medusajs/customer` `dist/models/customer.js`, `@medusajs/order` `dist/models/order.js`, `request-order-transfer.js` |
| Transfer token exposure | store order fields cannot select order changes (not in the allowed fields), so no store response carries the token | `orders/query-config.js`, `utils/allowed-fields.js` |
| Transfer cancel and accept | cancel: only the requesting customer (or an admin user) may cancel, and core's handler returns the full order; accept: token must match, then the order's customer becomes the requester | `transfer/cancel-order-transfer.js`, `transfer/accept-order-transfer.js`, `[id]/transfer/cancel/route.js` |
| Store returns | `POST /store/returns` has no authentication and creates and completes a return for body `order_id` | `medusa/dist/api/store/returns/route.js`, `middlewares.js` |
| Order–cart link | `order_cart` resolves through Query with `order_id` and `cart_id` | `core-flows/dist/cart/steps/compensate-payment-if-needed.js` |
| Cart link fields in Query | `cart.company.id`, `customer.employee.company_id/is_admin`, `cart.approvals.*` resolve | existing use in `validate-company-approval.ts`, `validate-cart-completion.ts`, covered by passing approval regressions |
| Session cookie | SameSite=lax and Secure in production | `framework/dist/http/express-loader.js` |
| JWT lifetime | default `jwtExpiresIn` 1 day | `framework/dist/config/config.js` |
| Next.js server actions | Origin checked against Host / `x-forwarded-host` (15.5.18) | `next/dist/server/app-render/action-handler.js` |

No row is UNVERIFIED.

## 10. Open risks and gates [Medium]

- Admin checkout replaces the admin's own cart cookie with the colleague's cart (existing
  storefront middleware `?cart_id=` behaviour); after payment the admin starts a new cart. Owner:
  Klaus Petersen; non-blocking.
- Not in scope, found while checking: the store quote fields include `*customer.employee.company`,
  which returns every company field, including the financial fields the cart field list
  deliberately leaves out (`api/middlewares.ts` comment), to the quote's owner. Owner: Klaus
  Petersen; non-blocking, separate issue.
- The order–company link stays metadata-derived for storefront orders (finding 8); store order
  access no longer uses it, but Business Central order sync does. Owner: Klaus Petersen;
  non-blocking, separate issue.
- Order transfer left open (decisions 3, 5, 6), what remains after this plan. Owner: Klaus
  Petersen; non-blocking, accepted:
  - No order data is returned. A signed-in customer can still learn from the status whether an
    order ID exists (404 versus 400) and, from the message, whether it belongs to an account. Order
    IDs are long random identifiers.
  - Orders owned by an account can no longer be blocked or taken over through transfer.
  - Orders with no customer (orders created through the order API) or a guest customer can still
    get a transfer request from any signed-in customer who knows the ID. While it is pending, Medusa
    refuses every other change to that order until the requester cancels or a merchant cancels or
    declines it in Admin. The token is in no store response and nothing sends it; if it were
    accepted, the requester would become the order's customer and gain owner access to it.
- Translation keys must be imported in every environment before the storefront release, or
  customers see raw keys. Owner: release manager; blocking for release, not dispatch.
- Baseline: backend and storefront typecheck and some tests fail today (`verification.md`); tasks
  hold at or below it.
