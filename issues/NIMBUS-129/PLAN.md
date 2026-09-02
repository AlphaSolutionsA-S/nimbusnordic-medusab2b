# NIMBUS-144 + NIMBUS-147: Receive normalized order JSON in Medusa / Define and validate the canonical order contract

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-144 and
https://alphasolutionsdk.atlassian.net/browse/NIMBUS-147 (both part of Epic
https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129)

## Objective

Give external B2B order systems a Medusa endpoint (`POST /orderapi/orders`) that authenticates
and validates a canonical order JSON payload, **synchronously** creates a real, header-only
Medusa order on success (or returns a structured error, with nothing created, on failure), and
then runs further enrichment and the future Business Central hand-off asynchronously via
Medusa's own domain-event primitives.

## Analysis

NIMBUS-144 and NIMBUS-147 are two ends of one pipeline and had to be planned together to avoid
inventing incompatible pieces. Key findings from codebase exploration:

- This repo has **no existing namespace outside `/admin` and `/store`**, and (at the time of the
  first planning pass) no existing scoped/API-key auth pattern beyond Medusa's own built-in
  strategies, and no existing "pending/staging" data pattern — several open questions had no
  in-repo precedent to copy and needed a resolved decision (see Decisions below).
- The existing `Company.business_central_customer_number` field
  (`apps/backend/src/modules/company/models/company.ts`) is exactly what customer/company
  matching needs, already nullable text, no migration required for it.
- `apps/backend/src/workflows/hooks/order-created.ts` shows an **existing** mechanism
  (`createOrderWorkflow.hooks.orderCreated`) that links a Medusa `Order` to a `Company` via
  `order.metadata.company_id` — this plan's order-creation step (Task 03) replicates that same
  link-creation call directly rather than relying on the hook, for reasons explained in the
  redesign section below.
- Both real EDI sample files (`order1.xml`, `order2.xml`) were used to pin down the "precise
  required/optional flags per field" that NIMBUS-147's SCOPE.md left open, and to build realistic
  test fixtures.
- A second research pass (during the redesign below) verified, directly against the installed
  `@medusajs/core-flows`/`@medusajs/framework`/`@medusajs/order`/`@medusajs/medusa` packages in
  `apps/backend/node_modules`: Medusa's standard `createOrderWorkflow` technically tolerates an
  empty `items` array but has an unguarded `region_id` resolution path that throws if no region
  resolves — a real runtime risk for a header-only order, not visible from its TypeScript types;
  the lower-level `container.resolve(Modules.ORDER).createOrders(...)` module-service call (what
  `createOrderWorkflow` itself calls internally) has no such risk and only strictly requires
  `currency_code`; `emitEventStep` (from `@medusajs/medusa/core-flows`) and Medusa's file-based
  subscriber convention (`src/subscribers/*.ts`, auto-discovered, no manual registration) are both
  real, documented Medusa v2 primitives, confirmed by reading the actual installed package
  source, not assumed.

## Execution Plan

1. **Task 01** — `orderIngestion` Medusa module: the canonical order contract (Task 02's schema
   lives here) plus a minimal `OrderExternalReference` dedupe-index data model (see the redesign
   below for why this shrank from a full audit/state table).
2. **Task 02** — The canonical order contract as a single strict zod schema,
   `CanonicalOrderSchema`, plus realistic EDI-derived test fixtures (see the redesign below for
   why this is now one schema, not two).
3. **Task 03** — `createOrderFromCanonicalPayloadWorkflow`: synchronous company matching,
   per-company duplicate check, and real header-only Medusa `Order` creation.
4. **Task 04** — The post-creation async event chain: `emitOrderIngestionCreatedEventWorkflow`
   (fired, unawaited, by the route), an `order-ingestion-created` subscriber, and
   `enrichOrderWorkflow`, which transitions `order.metadata.order_ingestion_state` and emits the
   `order_ingestion.ready_for_business_central` boundary event for a future NIMBUS-148.
5. **Task 05** — The actual `POST /orderapi/orders` route: Medusa secret-API-key auth
   (`authenticate("user", ["api-key"])`), query + body validation against Task 02's schema,
   awaiting Task 03's workflow, firing (without awaiting) Task 04's initial event, and returning
   the real order id.

## Decisions & Trade-offs

### Architectural redesign: synchronous order creation, event-driven post-processing (supersedes the original async design)

**What changed.** The plan originally had NIMBUS-144 do a fast/shallow synchronous check and hand
off asynchronously to a NIMBUS-147 workflow that did deep validation, company matching, and the
duplicate check — with actual Medusa order creation left entirely to a separate, later,
not-yet-scoped NIMBUS-149. After reviewing that plan, the user redirected it: canonical
validation, company matching, the duplicate check, **and** real Medusa order creation (header-only)
must all happen **synchronously**, so the response can report a real outcome (a real order id, or
a real rejection) instead of an "accepted for later processing" acknowledgment. Everything after
that — enrichment, and eventually Business Central integration — is now driven by genuine Medusa
domain events (`emitEventStep` + `src/subscribers/*.ts`) instead of a single fire-and-forget
workflow call.

**Why this is a real trade-off, not a strict improvement, and both directions are recorded:**
- *For the original (fully-async, no order creation) design*: it kept NIMBUS-144/147's scope
  narrowly aligned with the epic's own story boundaries (order creation was explicitly NIMBUS-149's
  job), and made the HTTP response trivially fast regardless of downstream processing cost.
- *Why it was changed anyway*: the response needs to be meaningful — returning "202 accepted,
  check back later" style semantics with a placeholder reference was already flagged in the
  original plan as an awkward compromise forced by NIMBUS-149 not existing yet. The user judged
  that compromise not worth keeping, and preferred pulling forward the minimal slice of order
  creation needed to make the response honest, over preserving strict story boundaries.

**Scope-crossing, recorded explicitly (same treatment as the auth reversal below — preserve the
reasoning, don't silently absorb it):** this plan's Task 03 now includes a synchronous,
header-only slice of what NIMBUS-149 ("Create and persist the Medusa order") was going to own as
its own separate, later, unscoped story. **NIMBUS-149 still has more to it that is NOT built
here**: this plan's order creation does not address NIMBUS-149's traceability/normalized-source-
information requirements, nor the Business-Central-integration-state fields NIMBUS-158's admin
widget will eventually need to display. Whoever scopes NIMBUS-149 in the future needs to
reconcile with what actually got built here (a bare `createOrders` call with `currency_code`,
`email`, and a `metadata` blob) rather than starting from a blank slate that assumes order
creation is still fully unbuilt and unscoped.

**Consequences that cascaded through every task:**
- **Task 01 shrank.** The old `IncomingOrder` model was a full audit/state-machine table for
  submissions awaiting async processing. Since validation and order creation are synchronous now,
  a rejected submission is never persisted at all (just returned as an error) — there's no
  "awaiting processing" state left to track. What survives is a much smaller
  `OrderExternalReference` dedupe-index table, needed only because the real `Order` entity has no
  native `external_order_number` column and filtering by a nested `metadata` JSON key via
  `query.graph()` was judged an unverified-reliable pattern not worth risking for the one
  correctness-critical duplicate check this integration cares about.
- **Task 02 shrank.** The old two-schema split (`OrderEnvelopeSchema` loose / `CanonicalOrderSchema`
  strict) existed specifically to let NIMBUS-144 respond fast while NIMBUS-147 validated deeply,
  asynchronously. With everything synchronous now, that split serves no purpose — one schema,
  used once, replaces it.
- **Task 03 is new content**, not an edit of the old "receive" workflow — it now does company
  matching, the duplicate check, AND real order creation as one synchronous workflow, using
  `Modules.ORDER` directly (not `createOrderWorkflow`) for the verified reasons in Task 03's own
  doc (region-resolution crash risk).
- **Task 04 is new content**, not an edit of the old "process" workflow — it's now the
  **post-creation** event chain (enrichment + the NIMBUS-148 boundary event), not
  validation/matching (that moved into Task 03).
- **Task 05's response contract changed**: from a placeholder `IncomingOrder.id` (explicitly
  flagged as forced by NIMBUS-149 not existing) to the **real Medusa order id** — this fully
  resolves that earlier flagged issue rather than needing further reconciliation.

**Important technical note, preserved from the redirect itself**: the reason this plan now uses
custom Medusa events/subscribers (Task 04) — after an earlier pass explicitly avoided them,
reasoning that this repo had zero existing usage — is a deliberate, explicit user decision, not a
reversal this plan re-litigated on its own. Verified Medusa v2 primitives (`emitEventStep`, the
default in-process local event bus, file-based subscriber auto-discovery) are documented in full
in Task 04's doc.

**Known limitation carried forward, not solved by this redesign**: no automatic recovery exists
if an order gets stuck mid-chain (e.g. the process crashes between emitting
`order_ingestion.order_created` and the subscriber's `enrichOrderWorkflow` completing). Storing
`order_ingestion_state` in `order.metadata` (rather than nothing, as the old design effectively
had for its own equivalent fire-and-forget gap) at least makes a **future** recovery job
possible — a scheduled job or admin action could scan for orders stuck past a threshold — but
building that job is explicitly out of scope here, same as before. Whoever builds it will face the
same JSON-metadata-filtering uncertainty flagged for Task 01's duplicate check.

**Known limitation, not solved**: no DB-level uniqueness constraint on
`OrderExternalReference(company_id, external_order_number)` — Medusa's model DSL as used
elsewhere in this repo only demonstrates single-column `.unique()`, and a compound unique index's
exact syntax wasn't a confirmed pattern worth guessing at. Two genuinely concurrent, identical
submissions could theoretically both pass the duplicate check before either commits. Flagged as a
follow-up hardening item.

### Auth (revised after team review, unaffected by the redesign above)

Medusa's built-in **secret API key** (`authenticate("user", ["api-key"])`, HTTP Basic auth), not
a bespoke header/env-var middleware. This reverses the plan's original recommendation, and both
sides of that conversation are worth keeping on record:

- **Original reasoning**: Medusa's secret-API-key strategy hard-codes to `actor_type: "user"` —
  verified directly in `@medusajs/framework`'s `authenticate-middleware.js`, which contains the
  literal comment "We only allow authenticating using a secret API key on the admin." A secret
  key therefore authenticates as a full Medusa admin user, an all-or-nothing credential with no
  per-route scoping, and this repo had zero existing usage of that strategy anywhere. That looked
  like too broad a blast radius for a single-purpose integration credential, so the plan proposed
  a narrower bespoke header check instead.
- **Why it was reversed**: this key is used exclusively by the Logic App (NIMBUS-146) —
  infrastructure the team controls directly (Azure Key Vault / Logic App secure connection
  settings) — and is never distributed to the external B2B customer systems themselves. The
  "leaked to an untrusted third party" concern that motivated the original recommendation doesn't
  apply to an internal service-to-service credential held at the same trust tier as every other
  secret this integration already depends on (BC client secret, Logic App connection
  credentials, etc.). Given that, reusing Medusa's native, admin-UI-manageable secret API key
  (create/rotate/revoke from `/admin/api-keys`, same as any other secret key in this system) is
  preferable to introducing and maintaining a second, bespoke, undocumented auth mechanism and its
  own env var. Full mechanics (exact `authenticate()` call, HTTP Basic auth requirement, why
  `/orderapi` living outside `/admin` has no CORS implications) are recorded in Task 05's
  implementation doc.

### Error status codes (resolved during the redesign)

`MedusaError.Types.NOT_FOUND` → `404` for an unrecognized `customerNumber`;
`MedusaError.Types.DUPLICATE_ERROR` → `422` for a duplicate `externalOrderNumber` within the same
company; `400` for any structural/schema validation failure (handled entirely by
`validateAndTransformBody`/`validateAndTransformQuery`, before Task 03's workflow ever runs).

## Verification

- [ ] `pnpm test:unit` (Task 02): `CanonicalOrderSchema` accepts both real-EDI-derived fixtures,
      rejects a payload missing `externalOrderNumber`, rejects an empty `lines` array, accepts a
      payload with no `billTo`/`shipTo`, rejects an unknown top-level field.
- [ ] `pnpm test:integration:modules` (Task 01): `OrderExternalReference` CRUD round-trip,
      filtering by `(external_order_number, company_id)`, confirms two different companies with
      the same `external_order_number` produce independent rows.
- [ ] `pnpm test:integration:http` (Task 03): `createOrderFromCanonicalPayloadWorkflow` creates a
      header-only order + company link + dedupe row on a happy path, rejects (404) an unrecognized
      customer number, rejects (422) a same-company repeat `externalOrderNumber`, and does NOT
      reject the same `externalOrderNumber` across two different companies.
- [ ] `pnpm test:integration:http` (Task 04): `enrichOrderWorkflow` transitions
      `order_ingestion_state` to `ready_for_business_central` directly, the real
      `order_ingestion.order_created` event triggers the same transition via the subscriber
      end-to-end, and the state-update step handles an order with no pre-existing ingestion
      metadata gracefully.
- [ ] `pnpm test:integration:http` (Task 05): the full `POST /orderapi/orders` route — `201` +
      real order id on a happy path, `401` on missing/invalid API key, `400` on a structurally
      invalid body, `400` on a missing `customerNumber` query param, `404` on an unrecognized
      customer (synchronously, no order created), `422` on a duplicate (synchronously), and the
      full pipeline eventually reaching `ready_for_business_central` after a successful POST.
- [ ] `pnpm build` and `pnpm lint` pass after all five tasks.
