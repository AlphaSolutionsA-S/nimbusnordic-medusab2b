# NIMBUS-207: Restrict store quote response fields

## Summary [High]

Store quote responses will expose company name only and message-author first and last names only. One backend task narrows the default projection and applies Medusa's native exact-path allowlist to every store quote response. Existing ownership checks, quote actions and storefront displays remain unchanged; no migration or storefront code change is planned.

How to review this plan: approval permits dispatch. Read High sections closely and stop at Critical flags; data and state tables are High because missing details have caused defects. Task files provide optional depth. Questions in chat may resolve uncertainties faster than further reading.

## Needs your decision [Critical]

- **Answer:** Approved by Klaus Petersen on 2026-10-24 ("approved, go"), including the route-local relation-depth setting; dispatch authorized.

## Flows [High]

### A. Read or change an owned quote (task 01)
1. A signed-in customer lists, creates, retrieves, accepts, rejects, previews or messages an owned quote using existing authentication and ownership controls.
2. The shared server-side query configuration selects permitted quote data, company name and author names; no administrator-only company fields or colleague records are selected.
3. Existing workflows perform requested mutations; the existing preview supplies order-preview data. The storefront receives its existing contact, spending-limit, item, total and message fields.

### B. Request additional fields (task 01)
1. An authenticated customer sends explicit, additive or wildcard field selections on a store quote endpoint.
2. Medusa silently strips paths outside the server allowlist, including parent company/customer/employee/author wildcards and deeper colleague paths. Sorting by an unallowed field returns 400.
3. A permitted request continues through the existing ownership controls (A1). No selection permits access to another customer's quote.

## What gets built [High]

### 01. Restrict quote projections and prove response compatibility

The L6 query configuration will enumerate safe customer and employee scalar fields, company name, and first/last names for both message-author relations. Both list and retrieve configurations will use one explicit permitted field set, including valid existing quote sort fields and the draft-order state field requested by existing tests. Unrelated existing order/item selections remain available, with only their exact normalized paths allowed. The store quote configurations will set relation depth to four locally because their existing product expansion needs four relations; the global limit stays unchanged.

Real-library middleware regression tests and HTTP contract/security tests will cover normal responses and widening attempts across all seven response routes. Current architecture documentation and the company-visibility business-rule registry will be updated. The worker will confirm the unchanged storefront consumers against the resulting response and report any unrelated baseline failures separately.

## Data model [High]

No table, relation, index, encryption, retention or deletion mechanism changes. All fields remain mutable under their existing owner; this task only selects a read projection. Company and employee data are stored by the company module, with BC-managed company values written by BC sync; customer/user data remain owned by Medusa; quote/messages by the quote module. Relation rows remain owned by existing module links. No browser gains a new write permission. One customer has one employee/company association; a quote has many messages, each with its existing customer or merchant author reference.

| Field / entity | Existing reader and meaning | Storage / owner / writer | Quote response |
|---|---|---|---|
| Company `name` | Quote detail company label | Stored / company / BC sync or existing company creation | Name only |
| Company `id` | No quote UI reader | Stored / company / server creation | Excluded |
| Company credit limit, blocked status, reset frequency | Company administrator profile | Stored / company / BC sync | Excluded for every quote caller |
| Company BC sync timestamp | Sync diagnostics | Stored / company / BC sync | Excluded |
| Company contact, address, VAT, BC customer number, Order API flag and other columns | Company profile/Admin; no quote UI reader | Stored / company / existing server flows | Excluded |
| Company employees relation | Company profile colleagues | Stored relation / company and customer links / existing server flows | Excluded, including spending limits |
| Own customer email, phone, first/last names | Quote detail contact | Stored / Medusa customer / existing customer flows | Explicit scalar fields |
| Own employee spending limit and role | Quote detail spending limit; role retained per scope | Stored / company / existing employee flows | Explicit scalar fields |
| Message author first/last names | Quote conversation labels | Stored / Medusa user or customer / existing profile flows | Names only, no author-record ID/email/metadata |
| Message ID, text, item/customer references and timestamps | Message rendering and alignment | Stored / quote / existing message workflow | Existing message fields retained |
| Quote IDs, status, timestamps, draft-order/cart/order-change data | List, detail, preview, accept/reject and existing HTTP specs | Stored or existing core-computed order totals / existing module owners and workflows | Existing safe contract retained |

No added application encryption or retention claim is made; underlying storage settings are unchanged. Quote scalar IDs needed for existing operations, including `draft_order_id`, remain permitted. Message `customer_id` identifies the message sender for existing UI styling; it is distinct from returning the whole author record.

## Business rules as state tables [High]

| Current state | Event and precondition | Outcome | Other rows / sessions / actor |
|---|---|---|---|
| Owned quote, employee or administrator | Any existing store quote response | Company name only; author names only | Reads do not write or record an actor; sessions unchanged |
| Owned quote | Caller asks for forbidden data | Paths silently omitted; invalid sort returns 400 | No new side effects or actor |
| Foreign quote | Read, preview or mutation | Existing refusal; no foreign payload | Existing mutation denial leaves quote/messages unchanged |
| Existing actionable owned quote | Create, accept, reject or message under existing workflow preconditions | Existing state transition; narrowed response | Existing workflow actor and writes unchanged; no new permissions |

## Security-property matrix [Critical]

| Property | Control | Trust root | Failure | Negative test |
|---|---|---|---|---|
| Owner only | Existing caller/customer filters and workflow checks | Medusa authenticated customer context | Existing 404/refusal | Retain foreign action/preview negatives; add foreign list/retrieve isolation with field requests |
| No company financial/internal data for either role | Explicit scalar projection plus allowlist | Server config | Fields absent | Seed nonempty forbidden fields; both roles, all response routes |
| Fields cannot widen response | Native exact-path allowlist; no sensitive parent relations allowed | Server config and verified installed library | Forbidden fields stripped; invalid sort 400 | Explicit/additive/star-prefix/star-suffix paths, parent wildcards, unlisted relation |
| No colleagues | No employee collection or deeper company path allowed | Same server config | Relation absent | Request company employees and their spending limits |
| Author privacy | Only first/last name leaves selected for author relations | Same server config | ID/email/metadata absent from author records | Seed staff/customer authors; attempt both author wildcard forms and explicit email |

Authentication trust anchor, replay, cross-instance sessions, CSRF and logout are unchanged. Filtering has no mutable shared authorization state (repeated/concurrent probe below). No new logging or error payload is introduced; refusal must not contain foreign customer/company data.

## Decisions [High]

### New in this plan
- Use explicit scalar leaves for customer/employee as well as company/authors: verified exact matching also admits a relation's scalar wildcard when its bare relation is allowed. This avoids alternate parent selections bypassing the projection.
- Retain `created_at`/`updated_at` for existing quote sorting and `draft_order.is_draft_order` for the existing accept contract; verified allowlists also govern the sort field.
- Use store-quote-local `storeRelationsLimit: 4`: verified existing `draft_order.items.variant.product.*` needs four relations; defaults currently exceed three. A fixed allowlist bounds the paths exposed. No global limit change.
- Reuse public Medusa query middleware; no custom sanitizer or workflow is needed. Production code will not call framework internals. Internal functions were inspected/probed only as verification evidence.
- Keep existing broad storefront response types outside this backend fix; runtime consumers need only retained fields. Their pre-existing overstatement is a non-blocking limitation, not proof of response compatibility.

### From the scope [Medium]
- Company name only, with no company ID; author records names only; preserve own contact/spending data and quote UI; native filtering behavior; no ownership/write changes (scope answers, 2026-10-21).
- Register company field visibility at its existing company-projection owner; Medium priority; Admin routes unchanged (approved scope).

## Framework assumptions [Medium]

Verified against installed **2.21.2**, the package.json version; the scope's 2.21.0 reference predates this checkout. Paths below are relative to `apps/backend/node_modules/@medusajs/framework/dist/http/`.

| Primitive | Verified input, output and side effects | Evidence |
|---|---|---|
| Field parsing / allowed filtering | Defaults or caller field string; modifiers and both wildcard forms normalized; only exact allowlist paths survive; forbidden paths silently stripped; invalid sorting throws | `utils/field-filtering/{field-parser,field-validator}.js`, `utils/get-query-config.js`; probe |
| Query middleware | Public validator produces `req.queryConfig`; same configs reach all seven store quote routes; relation-depth validation follows filtering | `utils/validate-query.js`; project `store/quotes/middlewares.ts` and all routes inspected |
| Relation limit | Whole-relation depth counts every segment; scalar leaf excludes last segment; local override applies to store route | `utils/relations-limit.js`, `utils/validate-query.js`; depth-three rejection/depth-four success probe |
| Repeated/concurrent config evaluation | Same absent/default input yields same output; no mutation of shared allowlist/default arrays observed | `field-filter-probe.cjs`: repeated calls and ten concurrent calls passed on 2026-10-24 |

Probe also passed five forbidden expansion forms, permitted company-name selection, valid `-created_at` sort and forbidden sort rejection. This proves query-configuration behavior only, not HTTP/database delivery. Official Medusa allowed-fields/query documentation corroborates configuration signatures; security conclusions use installed source and the runnable probe. No UNVERIFIED vendor row remains.

## Open risks and gates [Medium]

- Resolved, owner Klaus Petersen: concrete plan approved and dispatch authorized on 2026-10-24; no new business question remains.
- Non-blocking, owner worker/dispatcher: HTTP authentication baseline NIMBUS-236 and legacy quote fixtures may prevent a complete passing HTTP run. Re-measure; report separately, never relax authentication or delete assertions. Test infrastructure exists (Jest, HTTP runner and PostgreSQL fixtures).
- Non-blocking, owner worker: preview uses `draft_order_id` internally. Preserve default preview behavior and test it with a real owned quote; report any pre-existing caller-field-dependent preview failure separately rather than silently expanding scope.
- Non-blocking, owner release operator: after deployment inspect a controlled employee's owned quote response and quote detail/conversation display; no deployed result is claimed by local checks.

Architecture review complete — all applicable checklist items passed: medusa-backend, medusa-api-route and secure-coding-owasp, together with Tier 0. Workflow/module/lock/vendor-write checklist items are not applicable because none changes. Documentation exceeds the approximate one-task size budget to retain the mandatory data/security/framework review tables.
