# Receive Orders Through JSON and XML

- **Date:** 2026-08-21
- **Type:** Epic
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-129/
- **Updated by:** scoper agent
- **Outcome:** Scope approved; Jira epic and stories NIMBUS-144 through NIMBUS-149 were aligned, and NIMBUS-158 was created for the Medusa Admin status-and-retry widget. Implementation planning is the next stage.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-129 from the approved scope in issues/NIMBUS-129/SCOPE.md. Update the existing scope only if planning uncovers a required clarification, produce the implementation plan and task manifest for the Medusa backend/admin and Azure APIM/Logic App work, and preserve the approved story boundaries for NIMBUS-144 through NIMBUS-149 and NIMBUS-158.

- **Date:** 2026-08-21
- **Updated by:** scoper agent
- **Outcome:** Scope clarification approved: NIMBUS-147 defines an XML representation compatible with Azure API Management's `xml-to-json` policy, and NIMBUS-145 uses that policy for the actual XML-to-canonical-JSON transformation (https://learn.microsoft.com/en-us/azure/api-management/xml-to-json-policy).
- **Handover to:** implementation-planner agent
- **Handover prompt:** Plan NIMBUS-129 from the approved scope in issues/NIMBUS-129/SCOPE.md, treating the Azure API Management `xml-to-json` policy as the required XML transformation facility for NIMBUS-145 and ensuring the NIMBUS-147 contract is compatible with it.

- **Date:** 2026-09-02
- **Updated by:** orchestrating assistant (epic-wide consistency check after NIMBUS-144/147 rework)
- **Outcome:** Reviewing real EDI sample files against the approved NIMBUS-144/147 designs
  surfaced that Medusa has no product catalog behind these order items, so NIMBUS-149's Medusa
  order is now header-only (no `OrderLineItem` records) — canonical line data passes through
  for NIMBUS-148's Business Central order-line creation instead. This epic's Proposed Structure
  (item 6) was corrected to match. NIMBUS-149's Jira description ("Medusa order with its order
  lines") was also corrected. Notes for NIMBUS-148 (owns EAN→item lookup and BC line building,
  not just "send the order"), NIMBUS-158 (its widget needs to surface the retained canonical
  line data since the Medusa order page will show no native line items), and NIMBUS-146 (minor
  ownership wording — matching is NIMBUS-147's job, not "when the order is created") were added
  as Jira comments for persistence, pending those stories' own scoping.
  **Resolved 2026-09-02:** the epic and NIMBUS-148 both described returning the Business
  Central order identifier synchronously to the caller ("Return the Business Central identifier
  on success"), but the approved NIMBUS-144 design returns 201 + a Medusa order reference
  immediately, with BC delivery happening asynchronously afterward. User confirmed: keep the
  async design as-is — the calling system never receives the Business Central order identifier,
  at any point, by any mechanism. It is retained internally and surfaced only to internal
  operations via NIMBUS-158's admin widget. No callback/webhook/polling mechanism to the
  external system is needed. Epic SCOPE.md, the epic's Jira description, and NIMBUS-148's Jira
  description were corrected to match.
- **Handover to:** implementation-planner agent, once the user is ready to plan NIMBUS-144
  and/or NIMBUS-147 (146/148/149/158 remain unscoped locally, with corrective Jira comments/
  description fixes in place for when they are scoped).

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Planned NIMBUS-144 and NIMBUS-147 together (explicitly excluding NIMBUS-145,
  146, 148, 149, 158, which remain unscoped). Produced a combined implementation plan covering:
  a new `orderIngestion` Medusa module (`IncomingOrder` data model as the async-processing state
  machine), the canonical order contract as two zod schemas (loose envelope for NIMBUS-144,
  strict canonical for NIMBUS-147), a `receiveOrderWorkflow` (NIMBUS-144's fast/shallow
  idempotency check), a `processIncomingOrderWorkflow` (NIMBUS-147's deep validation/company
  matching/duplicate check), and the `POST /orderapi/orders` route wiring them together with a
  custom API-key middleware. The async hand-off from 144 to 147 is a plain non-awaited workflow
  invocation from route-handler code (no event bus/subscriber — none exists in this repo).
  Several previously-open questions were resolved and flagged explicitly rather than guessed
  silently: the endpoint path, the auth mechanism, the idempotency scoping, and — most
  importantly — that the 201 response's "Medusa order reference" is necessarily this project's
  own `IncomingOrder.id` (not a Medusa core Order id), since NIMBUS-149 doesn't exist yet; this
  needs reconciliation whenever NIMBUS-149 is scoped. Full detail in
  `issues/NIMBUS-129/PLAN.md`, task files `01`–`05`, and `manifest.md`. Base branch confirmed as
  `develop` (already recorded in both stories' SCOPE.md). Backend test infrastructure already
  exists — no scaffolding gate was needed. Plan is awaiting user approval before dispatch.
- **Handover to:** user, for plan approval, then implementor agent for execution.
- **Handover prompt:** Review `issues/NIMBUS-129/PLAN.md` and the five task files
  (`01-order-ingestion-module-implementation.md` through
  `05-order-api-route-implementation.md`) plus `manifest.md`. Once approved, invoke the
  implementor agent with: "Implement NIMBUS-129's order-ingestion plan (NIMBUS-144 +
  NIMBUS-147) from issues/NIMBUS-129/manifest.md, in task order 01 through 05." NIMBUS-145,
  146, 148, 149, and 158 remain out of scope for this dispatch and should not be touched.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Reversed Task 05's auth mechanism after user review, before final approval. The
  bespoke `x-orderapi-key` header + `ORDER_INGESTION_API_KEY` env-var middleware is replaced
  with Medusa's built-in secret API key (`authenticate("user", ["api-key"])`, HTTP Basic auth,
  managed via `/admin/api-keys`). The original recommendation was based on that strategy
  hard-coding to `actor_type: "user"` (full admin scope, verified against
  `@medusajs/framework`'s `authenticate-middleware.js`); the user's accepted counter-argument is
  that this key is used exclusively by the Logic App (NIMBUS-146) — an internal Azure credential
  never distributed to external customer systems — so the "leaked to an untrusted third party"
  concern doesn't apply, making Medusa's native, already-built secret key preferable to a second
  bespoke mechanism. Updated `issues/NIMBUS-129/05-order-api-route-implementation.md` (full
  auth section, middleware/route skeletons, all HTTP test cases), `PLAN.md` (Decision #1
  rewritten to preserve both sides of the reasoning, not just the final answer), and
  `manifest.md` (env/config changes section). No other task or design element was changed. Full
  detail, including verified mechanics of Medusa's secret-API-key middleware (HTTP Basic auth
  requirement, why `/orderapi` outside `/admin` has no CORS implications), is in Task 05's doc.
- **Handover to:** user, for a final approval pass on this revision, then implementor agent.
- **Handover prompt:** Same as the previous entry — re-read `issues/NIMBUS-129/PLAN.md` and
  `05-order-api-route-implementation.md` for the revised auth design before approving dispatch.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Major architectural redesign, requested by the user after reviewing the plan a
  second time — bigger than the auth change, and holds dispatch pending re-approval. Canonical
  validation, company matching, the per-company duplicate check, and real Medusa order creation
  (header-only, no `OrderLineItem` records) now all happen **synchronously** inside the request,
  replacing the earlier fully-async design. The response now returns the real Medusa order id (or
  a structured `404`/`422`/`400` error with nothing created) instead of the earlier design's
  explicitly-flagged placeholder `IncomingOrder.id` stopgap — that flagged issue is now fully
  resolved rather than needing future reconciliation. Post-creation processing (enrichment, and
  the future NIMBUS-148 hand-off) is now driven by genuine Medusa domain events
  (`emitEventStep` + a `src/subscribers/*.ts` file, verified against this repo's actual installed
  Medusa v2.18.0 packages) rather than a single fire-and-forget workflow call — this is a
  deliberate, explicit user directive, not something this plan second-guessed despite an earlier
  pass correctly finding zero event/subscriber precedent in this repo. This redesign pulls a
  synchronous, header-only slice of NIMBUS-149 ("Create and persist the Medusa order") into this
  plan — explicitly flagged: NIMBUS-149 as a story still has unaddressed requirements
  (traceability, NIMBUS-158's integration-state fields) that its future scoping needs to
  reconcile with what actually got built here. Task 01 shrank (the old `IncomingOrder`
  audit/state table collapsed to a minimal `OrderExternalReference` dedupe-index model, since
  rejected submissions are no longer persisted at all). Task 02 shrank (the old two-schema
  envelope/canonical split collapsed to one schema, since there's no longer a fast/deferred-deep
  split to serve). Tasks 03 and 04 are new content, not edits, of the previous 03/04 (old files
  deleted, new files with different names and content created) — see
  `issues/NIMBUS-129/manifest.md`'s "Task file renames" note. Full reasoning recorded in
  `issues/NIMBUS-129/PLAN.md`'s "Decisions & Trade-offs" (the redesign section), preserving both
  what changed and why, same treatment as the earlier auth reversal.
- **Handover to:** user, for a fresh approval pass on this redesign (not assumed approved), then
  implementor agent.
- **Handover prompt:** Re-read `issues/NIMBUS-129/PLAN.md` and all five task files
  (`01`–`05`) in full — this is a genuine architectural change, not an incremental diff from the
  previously-presented plan. Once approved, invoke the implementor agent with: "Implement
  NIMBUS-129's order-ingestion plan (NIMBUS-144 + NIMBUS-147) from
  issues/NIMBUS-129/manifest.md, in task order 01 through 05." NIMBUS-145, 146, 148, 149, and 158
  remain out of scope for this dispatch and should not be touched.

- **Date:** 2026-09-02
- **Updated by:** implementation-planner agent
- **Outcome:** Redesigned plan approved by the user (synchronous canonical validation + company
  matching + duplicate check + header-only order creation in Task 03; async event-driven
  post-processing chain in Task 04 via `emitEventStep` + a `src/subscribers/*.ts` file; the
  NIMBUS-149 scope-crossing explicitly recorded in `issues/NIMBUS-129/PLAN.md`'s "Decisions &
  Trade-offs"). Implementation planning for NIMBUS-144 + NIMBUS-147 is complete:
  `issues/NIMBUS-129/PLAN.md`, `manifest.md`, and task files `01-order-ingestion-module-implementation.md`
  through `05-order-api-route-implementation.md` are the approved, current state — do not treat
  any earlier PROGRESS.md entry's design description as current; only this plan's latest files
  reflect what should be built. **Implementor dispatch is intentionally held — pending, on user
  request** — not triggered automatically as part of this approval.
- **Handover to:** implementor agent, on request (not yet triggered).
- **Handover prompt:** Implement NIMBUS-129's order-ingestion plan (NIMBUS-144 + NIMBUS-147) from
  `issues/NIMBUS-129/manifest.md`, executing tasks in dependency order: 01 (Order Ingestion
  Module — canonical contract + `OrderExternalReference` dedupe-index model), 02 (Canonical Order
  Contract — single `CanonicalOrderSchema`), 03 (Synchronous Validate + Create Order Workflow —
  company matching, per-company duplicate check, header-only Medusa order creation via
  `Modules.ORDER` directly, replicating the existing order-created hook's link-creation logic),
  04 (Post-Creation Async Event Chain — `emitEventStep`-based event emission, the
  `order-ingestion-created` subscriber, `enrichOrderWorkflow`, and the
  `order_ingestion.ready_for_business_central` boundary event left without a subscriber for a
  future NIMBUS-148), then 05 (the `POST /orderapi/orders` route itself — Medusa secret-API-key
  auth, synchronous response with the real order id or a `404`/`422`/`400` error). Each task file
  contains verbatim code skeletons and full test skeletons — follow them exactly rather than
  inventing alternative type shapes or import paths. Flagged, not-fully-specified items to
  respect rather than silently resolve during implementation: Task 04's enrichment step content
  (`// IMPLEMENT:` block in `enrich-order.ts`) and the residual uncertainty around whether a
  thrown `MedusaError` survives Task 03's workflow engine unwrapped (verify via the tests, adjust
  only if a test actually fails). NIMBUS-145, 146, 148, 149, and 158 remain out of scope — do not
  touch them or attempt to build their internals. After implementation, update this PROGRESS.md
  with the outcome and hand over per this repo's normal Definition of Done / code-review /
  commit-message conventions.

- **Date:** 2026-09-16
- **Updated by:** implementing assistant (Claude Opus 5)
- **Outcome:** Implemented NIMBUS-144 + NIMBUS-147 in full from `manifest.md`, tasks 01–05 in
  dependency order, on branch `feature/NIMBUS-129-order-ingestion` (from `develop`). All five
  tasks are marked DONE in `manifest.md` and in their own task files. What exists now:
  the `orderIngestion` module (`OrderExternalReference` dedupe-index model + migration
  `Migration20260916091913`, registered in `medusa-config.ts`), the single `CanonicalOrderSchema`
  contract with EDI-derived fixtures, `createOrderFromCanonicalPayloadWorkflow` (synchronous
  company matching + per-company duplicate check + header-only Medusa order creation via
  `Modules.ORDER` with the Order↔Company link replicated from the existing hook), the async event
  chain (`emitOrderIngestionCreatedEventWorkflow`, the repo's first `src/subscribers/` file, and
  `enrichOrderWorkflow` emitting the `order_ingestion.ready_for_business_central` boundary event
  with no subscriber, as planned), and the `POST /orderapi/orders` route behind
  `authenticate("user", ["api-key"])`.
  **Test results:** Task 02 unit 6/6, Task 01 module 3/3, Task 03 HTTP 4/4, Task 04 HTTP 3/3,
  Task 05 HTTP 7/7. Backend `pnpm build` succeeds; `pnpm lint` passes repo-wide with 0 errors
  (12 warnings, all in pre-existing files, none in new code).
  **Four plan deviations, each forced by an observed failure, all recorded in `manifest.md`'s new
  "Deviations From the Plan Found During Implementation" section:** (1) the shared fixtures file
  moved from `__tests__/` to `__fixtures__/` because this repo's `test:integration:modules` glob
  treated it as an empty test suite and failed the run; (2) the model's planned `export default`
  was dropped (it made MikroORM register the entity twice — `Duplicate entity names are not
  allowed`), now matching this repo's `models/index.ts` convention; (3) the flagged
  workflow-error uncertainty is **confirmed real** — the engine rejects with a serialized plain
  object, not a `MedusaError` instance, so Task 03's tests assert `.rejects.toMatchObject({ type
  })` rather than `.toThrow()`; **the route needed no change**, because Medusa's `errorHandler`
  keys off `err.type || err.name` rather than `instanceof` (verified in the installed package and
  by Task 05's 404/422 tests passing); (4) `currency_code` persists lowercase (`"dkk"`).
  **Left deliberately unimplemented, as the plan directs:** the `// IMPLEMENT:` enrichment block
  in `enrich-order.ts` (content is an unresolved product decision), and any subscriber for
  `order_ingestion.ready_for_business_central` (that is NIMBUS-148's).
  A full `pnpm test:integration:http` run afterwards confirms all three new suites pass together
  with the rest of the suite loaded (`orderapi/orders.spec.ts`,
  `order-ingestion/create-order-workflow.spec.ts`,
  `order-ingestion/enrich-order-event-chain.spec.ts` — all PASS).
  **Pre-existing, unrelated failures observed and not touched** (none caused by this work):
  (a) `src/modules/business-central/__tests__/service.spec.ts` — one failing test
  ("stops filling from salesInvoices after the round-trip guardrail even if the page stays
  short", `TypeError: Cannot read properties of undefined (reading 'ok')`); nothing in
  business-central was modified. (b) Three HTTP suites fail in the full run —
  `http/companies/companies.spec.ts`, `http/quotes/quotes.spec.ts`, and
  `http/admin/quotes/quotes.spec.ts` (24 tests). These fail on an **admin-auth 401 during
  seeding** (`regionSeeder`'s `POST /admin/regions` with `adminHeaders` returns 401), not on
  anything order-ingestion touches. Verified causally, not assumed: `src/api/middlewares.ts` was
  temporarily reverted to its pre-change state and `http/admin/quotes/quotes.spec.ts` failed
  **identically** (same test, same 401, same seeder line), so registering `orderApiMiddlewares`
  is not the cause. These three suites need their own investigation, separate from this work.
  **Not done here:** nothing is committed — the work sits uncommitted on the feature branch,
  awaiting review. The NIMBUS-158 admin widget, and the DB-level compound-unique hardening for
  `(company_id, external_order_number)` noted in PLAN.md, both remain open.
- **Handover to:** user, for review of the working tree and a decision on committing/PR.
- **Handover prompt:** Review the uncommitted changes on `feature/NIMBUS-129-order-ingestion`
  (2 modified files — `apps/backend/medusa-config.ts`, `apps/backend/src/api/middlewares.ts` —
  plus the new `order-ingestion` module, `order-ingestion` workflows, `orderapi` API namespace,
  `src/subscribers/order-ingestion-created.ts`, and three new integration-test directories), then
  commit with `NIMBUS-144:` / `NIMBUS-147:` references per the commit-messages skill. Before
  closing either story, follow the definition-of-done skill and add the mandatory closing comment
  to each Jira issue (both are now **In Progress**). Manual verification of the live endpoint
  still needs a Secret API key created at `/admin/api-keys` — see Task 05's "Manual Verification"
  section for the exact curl.

- **Date:** 2026-09-16
- **Updated by:** implementing assistant (Claude Opus 5)
- **Outcome:** Follow-on change **outside the NIMBUS-144/147 manifest scope**, made at the user's
  direction after a review question about whether `currencyCode` should be required on the
  canonical order contract. Two options were on the table: relax the contract so `currencyCode`
  becomes optional and falls back to the matched company, or fix the company data at its source
  so the currency is always populated. The user chose the second — fix the sync — so the API
  contract is **unchanged** (`currencyCode` stays required in `CanonicalOrderSchema`).
  `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts` now resolves a blank
  Business Central customer Currency Code to an explicit local-currency (LCY) code instead of
  writing `null` to `Company.currency_code`. The rationale: in Business Central a blank Currency
  Code on a customer does not mean "unknown", it means the customer transacts in local currency —
  the normal state for domestic customers — so persisting `null` lost real information. Source of
  the LCY value is the new optional `BUSINESS_CENTRAL_LCY_CODE` env var, defaulting to `DKK`,
  following the same `process.env.X ?? DEFAULT` pattern the module already uses for
  `BUSINESS_CENTRAL_DISCOVERY_URL`. Added to `apps/backend/.env.template`. The BC service's
  `getCustomer` was deliberately **not** changed — it still reports faithfully what BC returned
  (`currencyCode: string | null`); the LCY decision belongs to the sync step that decides what to
  persist. New test in `integration-tests/http/customers/company-sync.spec.ts` ("resolves a blank
  Business Central currency code to the local currency (LCY)") pre-sets the company to `SEK`
  before syncing, so it proves the fallback actually ran rather than observing the test helper's
  seeded `DKK` default. That suite passes 7/7; backend `pnpm build` clean (same 12 pre-existing
  warnings, none in changed files).
  **Known gap, not solved:** companies synced *before* this change keep a null `currency_code`
  until their next sync. Sync is on-demand (triggered from the storefront routes
  `/store/companies/:id` and `/store/customers/me/company/sync-business-central`), not scheduled,
  so backfill is driven by customer activity rather than guaranteed. A one-off backfill under
  `src/migration-scripts/` would close this if the order API is ever changed to depend on
  `Company.currency_code`; it is not needed today, because the canonical contract still requires
  `currencyCode` on the payload.
  **Also flagged, not acted on:** nothing validates a payload's `currencyCode` against the
  matched company's currency. A sender submitting `EUR` for a customer BC holds as `DKK`
  currently creates a mismatched order silently. Worth a decision when NIMBUS-148 builds the
  Business Central hand-off.
- **Handover to:** user, for review together with the NIMBUS-144/147 work (still uncommitted).
- **Handover prompt:** Review the currency-sync change in
  `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts` alongside the
  order-ingestion work. Confirm `DKK` is the correct LCY default for this tenant before this
  reaches a deployed environment, and set `BUSINESS_CENTRAL_LCY_CODE` explicitly in each
  environment if any tenant's local currency differs.

- **Date:** 2026-09-16
- **Updated by:** implementing assistant (Claude Opus 5)
- **Outcome:** Contract change to NIMBUS-147, decided by the user during review: `itemNumber` and
  `description` on a canonical order line are now **optional** (they were required). A line's
  required set is now `lineNumber`, `eanNo`, `quantity`, `unitPrice`. Rationale: the item is
  identified by `eanNo` alone — NIMBUS-148 resolves that EAN against Business Central, whose item
  master supplies the description that actually lands on the BC sales-order line. Two supporting
  findings from the real EDI samples: `ItemNo` is byte-identical to `CustItemNo` on all five
  lines across both files (both carry the *customer's* SKU coding, e.g. `FLS-NIM-VESPERMNA-XL`,
  not a Nimbus/BC item number), and nothing in the ingestion path reads either field — the
  canonical payload is stored as an opaque blob in `order.metadata.canonical_order`.
  **Recorded because it was contested:** the assistant argued for keeping `description` required,
  on the grounds that NIMBUS-158's admin widget has no other source for a human-readable line
  label (these orders are header-only, with no `OrderLineItem` records and no Medusa product
  catalog). The user overruled it with the operational context: that widget is consulted only
  when the Medusa→Business Central integration *fails*, and an EAN is sufficient to identify an
  item in that situation. **Standing guidance for NIMBUS-158:** display `description` and
  `itemNumber` when present, but never assume they exist — the widget must render from `eanNo`
  alone when they are absent.
  Changed: `canonical-order-schema.ts` (both fields `.optional()`, with a comment explaining
  why), two new unit cases (a line carrying only `eanNo` + `lineNumber` + `quantity` +
  `unitPrice` is accepted; a line with no `eanNo` is still rejected), and Task 02's doc field
  list. `pnpm test:unit` passes 14/14. The `currencyCode` question raised in the same review was
  resolved differently — see the preceding entry: the contract kept it required and the BC
  company sync was fixed instead.
  **Reviewed but NOT changed, still open for a decision:** a set of format/consistency
  validations the contract currently lacks — `eanNo` accepts any non-empty string rather than a
  13-digit GTIN; `lineNumber` uniqueness within an order is unvalidated; `currencyCode` accepts
  any non-empty string rather than 3-letter ISO; all date fields (`orderDate`,
  `requestedDeliveryDate`, `requestedShipmentDate`) are free-form strings; `eanNo` uniqueness
  within an order is unvalidated (may be legitimate — same item, different delivery dates); and
  no check compares a payload's currency against the matched company's Business Central currency.
  These were presented to the user and not yet acted on.
- **Handover to:** user, for a decision on the outstanding validation items above, and for review
  of all still-uncommitted work on `feature/NIMBUS-129-order-ingestion`.
- **Handover prompt:** Decide which of the listed format/consistency validations to add to
  `CanonicalOrderSchema` (all are schema-level and would return `400` before anything is
  created), then review and commit the branch.

- **Date:** 2026-09-16
- **Updated by:** implementing assistant (Claude Opus 5)
- **Outcome:** Closed out the five field-validation gaps that were left open in the preceding
  entry. User decisions, applied to `CanonicalOrderSchema`:
  (1) **`eanNo` must be exactly 13 digits**, kept as a `string` (not a number — leading zeros
  must survive). (2) **A repeated `eanNo` across lines stays legal** — explicitly declined, not
  overlooked: the same item may appear on several lines, e.g. with different shipment dates.
  (3) **`lineNumber` must be unique within an order**, enforced by a `.refine` on the `lines`
  array. (4) **`currencyCode` must be 3 letters** (ISO 4217), case-insensitive since Medusa
  lowercases `currency_code` on persist. (5) **All date fields must be `DD-MM-YYYY`** —
  `orderDate`, `requestedDeliveryDate`, `requestedShipmentDate`, via a shared
  `CanonicalDateSchema`. The date rule also range-checks the real calendar, because the pattern
  alone accepts `31-02-2026`; `29-02-2028` passes and `29-02-2027` does not.
  **Fixture correction made necessary by (5), worth noting because it was a latent error:** the
  fixtures carried ISO dates (`2026-08-27`) while claiming to be derived from the EDI samples,
  which actually use `<DocumentDate>27-08-2026</DocumentDate>`. The components were transposed.
  They are corrected to `27-08-2026` / `26-08-2026`, matching `order1.xml` / `order2.xml`
  exactly. Task 05's manual-verification curl was corrected the same way.
  **Tests:** five new unit cases covering each rule (13-digit EAN rejection across four malformed
  shapes; duplicate `lineNumber` rejected while repeated `eanNo` is accepted; non-ISO currency
  rejected; malformed and impossible dates rejected with a leap-year positive case; the optional
  date fields held to the same rule). `pnpm test:unit` 21/21. The three order-ingestion HTTP
  suites pass; backend `pnpm build` and repo-wide `pnpm lint` both clean (0 errors, same 12
  pre-existing warnings).
  **Test-infrastructure observation, not a defect in this work:** running the three
  order-ingestion HTTP suites in one jest process intermittently fails all cases in the last
  suite with `Exceeded timeout of 60000 ms for a hook` — the `medusaIntegrationTestRunner`
  bootstrap, not any assertion. The same suite passes 7/7 when run alone, and all three passed
  together in an earlier full-suite run. If this recurs in CI, raise the hook timeout rather than
  chasing a logic bug.
- **Handover to:** user, for review and commit of the still-uncommitted branch.
- **Handover prompt:** All five validation questions are now resolved and implemented; the
  canonical contract is final unless further review changes it. Review and commit
  `feature/NIMBUS-129-order-ingestion`, then follow the definition-of-done skill and add closing
  comments to NIMBUS-144 and NIMBUS-147 before transitioning either to Done.

- **Date:** 2026-09-16
- **Updated by:** implementing assistant (Claude Opus 5)
- **Outcome:** `unitPrice` on a canonical order line is now **optional** (user decision). A line's
  required set is now just `lineNumber`, `eanNo`, `quantity`. Reasoning: NIMBUS-147's SCOPE.md
  justified keeping `unitPrice` by distinguishing "computed totals are derived outputs" from
  "calculation inputs" — but `unitPrice` is itself derived, by Business Central, from (customer,
  item, quantity, date) through sales prices / price lists / customer price groups. The user
  supplied the decisive fact: **these orders are keyed into BC by hand today, and BC already
  applies the customer's price in that manual process**, so the automated path should mirror it
  rather than assert a price of its own. The contract was also internally inconsistent — every
  other BC-priced line field (`discountPercent`, `discountAmount`, `discountAppliedBeforeTax`,
  `taxCode`, `taxPercent`) was already optional, leaving `unitPrice` the lone required exception
  among its own siblings. This is the same pattern as the earlier `currencyCode` question: BC,
  not the submitter, is the authority.
  Net effect across this review pass: the submitter-owned facts on a line are **which item
  (`eanNo`), how many (`quantity`), and when (`requestedShipmentDate`)**, plus `lineNumber` as
  the sender's identity for the line. Everything else is traceability or a stated expectation.
  **Binding guidance recorded for NIMBUS-148** (in Task 02's doc, so it reaches that story):
  a submitted `unitPrice` is a *stated expectation, not an instruction*. It must **not** be set
  explicitly on the BC sales-order line — let BC price the line exactly as it does for a manually
  keyed order. Setting it explicitly overrides BC's contract price, so a stale price in a
  customer's ordering system would silently beat the negotiated one. Use the submitted value only
  to detect and flag a discrepancy. This sits alongside the earlier guidance for NIMBUS-158
  (display `description`/`itemNumber` when present, never assume they exist).
  **Trade-off accepted and recorded:** when a sender omits `unitPrice`, Medusa retains no price
  for that line at all — the metadata blob carries only EAN and quantity until BC prices the
  order. Judged acceptable because the admin widget is a failure-case tool.
  Changed: `canonical-order-schema.ts` (`unitPrice` optional, with the rationale as a code
  comment) and two unit cases — a line carrying only `lineNumber`/`eanNo`/`quantity` is accepted,
  and a submitted `unitPrice` is still accepted and preserved. `pnpm test:unit` 27/27.
- **Handover to:** user, for review and commit of the still-uncommitted branch.
- **Handover prompt:** The canonical contract is settled after this pass. Review and commit
  `feature/NIMBUS-129-order-ingestion`, then follow the definition-of-done skill and add closing
  comments to NIMBUS-144 and NIMBUS-147 before transitioning either to Done. Note that two pieces
  of binding downstream guidance now live in Task 02's doc — the `unitPrice` no-override rule for
  NIMBUS-148 and the optional-display rule for NIMBUS-158 — and should be carried into those
  stories when they are scoped.
