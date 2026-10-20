# Branch notes: NIMBUS-130

## Task 01: shipment notice contract

- `apps/backend/src/modules/order-ingestion/shipment-notice-contract.ts` (pure, zod 4 via
  `@medusajs/framework/zod`): `ShipmentNoticeEnvelopeSchema`, `ShipmentNoticeSchema`,
  `ShipmentNoticeLineSchema`, `ShipmentNoticePartySchema`, `ShipmentNoticeShipToSchema`,
  `ShipmentNoticePayloadSchema` + type `ShipmentNoticePayload` (task 05 builds, task 02 stores),
  `ShipmentNoticeErrorBodySchema` (union of `MedusaErrorBodySchema` and `GatewayErrorBodySchema`),
  `SHIPMENT_NOTICE_STATUSES` / `ShipmentNoticeStatus`.
- All objects are `.strict()`: a mapper must emit exactly the contract keys, with `null` (never
  `undefined` or a missing key) for empty values; `lines` needs at least one line; `quantity` ≥ 0.
- `recorded_at` must be UTC with `Z` (`Date#toISOString()` fits); dates are `YYYY-MM-DD`; cursors
  are decimal strings (convert the integer `sequence` with `String()`).
- Example envelope: `__fixtures__/shipment-notice-fixtures.ts` (`shipmentNoticeEnvelopeExample`),
  identical to `issues/NIMBUS-130/artifacts/shipment-notices.example.json`.
- Artifacts for task 10: `shipment-notice-schema.xsd` (roots `shipment_notice_response` and
  `error_response`, no namespace, nulls omitted), JSON and XML examples of success and both error
  shapes (`error-service.*`, `error-gateway.*`). The service's `code` is not rendered in XML.
- Verified: Medusa error body is `{ code, type, message }` with `code` dropped when undefined
  (`@medusajs/framework` 2.21.2 `dist/http/middlewares/error-handler.js`); Zod errors give
  `{ type: "invalid_data", message }`.
- Validation scripts (re-runnable after a contract change) are in the run scratchpad:
  `validate-json-artifacts.js <repoRoot>` and `validate-xml-artifacts.ps1 -Artifacts <dir>`.

## Task 02: shipment notice storage

- Types and input shapes: `modules/order-ingestion/shipment-notice-storage.ts`
  (`StoreShipmentNoticeInput`, `StoreShipmentNoticeResult`, `ShipmentTrackingSchedule`
  (`action: "reschedule" | "close"`), `ShipmentTrackingDiscovery`, `ShipmentTrackingRow`,
  `ShipmentNoticeRow`, `ShipmentPollState`, `CompanyShipmentNoticeQuery`, close-reason constants).
- `orderIngestion` service methods: `storeShipmentNotice`, `upsertShipmentTracking` →
  `{ inserted, updated }`, `listDueShipmentTracking({ now, limit })`,
  `rescheduleShipmentTracking(bcShipmentId, …)` / `closeShipmentTracking(bcShipmentId, …)` → `false`
  when the row is not open, `listGaveUpShipmentTracking({ limit, offset })` → `{ rows, count }`,
  `reopenShipmentTracking(id, actorId)` (`NOT_ALLOWED` → 400 unless `gave_up`, `NOT_FOUND`),
  `retrieveShipmentPollState()` (null before first run), `initializeShipmentPollState(now)` →
  `{ state, created }`, `setShipmentPollCursor("lead" | "trail", date)`,
  `setShipmentPollBackoff(date | null)`, `listCompanyShipmentNotices({ company_id, limit, after | since })`
  (returns up to `limit + 1` rows; use `after: 0` for the start).
- The store throws `NOT_FOUND` if the poll state row or the tracking row is missing: tests and
  workflows must initialize state and upsert tracking first. It writes tracking only on `stored`.
- `sequence` and cursors are `integer` (int4) columns; raw rows come back as `number`, timestamps as
  `Date`, `payload` as parsed JSON. Convert `sequence` with `String()` for the wire.
- Every method takes an optional last `{ transactionManager }` context; passing one runs it inside
  the caller's transaction (verified: `@medusajs/utils` 2.21.2 `inject-transaction-manager.js`).
- Module specs run with `pnpm --filter @b2b-starter/backend test:integration:modules -- <path>`
  (local Postgres works here); the runner builds the schema from the models, not the migration.
- `medusa db:migrate` hangs after applying here (link-sync prompt); check the DB instead.

## Task 03: BC line map at submission

- Read the map with `parseBcIntegrationState(order.metadata[BC_INTEGRATION_STATE_METADATA_KEY]).bc_lines`
  (`modules/order-ingestion/bc-integration-state.ts`): `BcOrderLineMapEntry[] | null`, entries
  `{ line_number, ean_no: string | null, bc_sequence: number | null }`. `null` = older order, no map.
- Only accepted lines are in the map; `bc_sequence` can be null (BC 201 body without `sequence`),
  so a shipment line with no matching entry must be handled, not assumed impossible.
- The map always belongs to the current `bc_order_number` (both replaced together when an attempt
  creates a BC order, including an all-lines-rejected one, which records an empty map).
- Adapter: `BCCreatedSalesOrder.acceptedLines: BCAcceptedSalesOrderLine[]` (`types.ts`) beside the
  existing `acceptedLineNumbers`; test fixtures of `BCCreatedSalesOrder` need both.
- `AdminBcIntegration` omits `bc_lines` (the Admin spec asserts exact keys and no `ean_no`).
- `sales-order-create.spec.ts` is not `*.unit.spec.ts`: run it with
  `pnpm --filter @b2b-starter/backend test:integration:modules -- <path>` (no DB needed).
- `send-order-to-bc.spec.ts` plus the subscriber spec take about 10 minutes locally; run them in
  the background with a timeout above 600 s.

## Task 04: BC shipment reads

- Service methods (`IBusinessCentralModuleService`): `countShipments({ after, until })` → number,
  `listShipmentHeaders({ after, until })` → `BCShipmentHeader[]` (ascending, whole window or throw),
  `getShipmentsByNumbers(numbers)` → `BCShipment[]` (unknown numbers absent, `[]` → no request).
- Types in `modules/business-central/types.ts`: `BCShipmentWindow`, `BCShipmentHeader`, `BCShipment`
  (`shipmentMethodCode`, `yourReference`, `sellTo`/`billTo` `BCShipmentParty`, `shipTo`
  `BCShipmentShipTo`, `lines`), `BCShipmentLine`, `BCShipmentLineType` (`item | comment | other`).
- Every text field is `string | null` (empty → null); dates `YYYY-MM-DD` or null; `lastModifiedDateTime`
  is BC's ISO string (parse it if you need a `Date`). Lines come unsorted, as BC returns them.
- Throttling: `BusinessCentralThrottledError` (`modules/business-central/shipment-reads.ts`, importable
  without the service) with `retryAfterSeconds: number | null`; apply the plan's "at least 1 min" in
  the caller. Other failures (incl. 20 s timeouts) are `MedusaError` `UNEXPECTED_STATE`.
- The token cache lives on the service instance (a container singleton), so it survives across runs.
- Workflow tests stub these three methods on the resolved `businessCentral` service; no fetch mocking.
- `service.spec.ts` "round-trip guardrail" fails on HEAD too (baseline), not a regression.

## Task 05: decision and schedule

- `workflows/shipment-notice/utils/match-shipment-order.ts`: `matchShipmentToOrder(header,
  candidates, goLiveAt)` (generic: returns the candidate object you passed) with
  `ShipmentOrderCandidate { company_id, business_central_customer_number, order_id,
  external_order_number, bc_state }` (`bc_state` = `parseBcIntegrationState(...)`);
  `isCurrentBcOrder(bcOrderNumber, state)` for task 07's `superseded` check.
- `utils/decide-shipment-notice.ts`: `decideShipmentNotice({ shipment: BCShipment, order: { order_id,
  external_order_number, bc_order_number, posting_date, bc_lines }, latest })`, `latest` =
  `{ revision, content_hash, listed_bc_line_numbers }` or null (build the list from the latest
  notice's `payload.lines[].bc_line_number`). Returns `record | nothing | unpairable(sequence)`.
- `utils/shipment-check-schedule.ts`: `initialShipmentSchedule({ postingDate, lastModifiedDateTime })`
  for discovery's `next_check_at`/`recheck_until`; `scheduleShipmentCheck(row, outcome, now)` →
  `ShipmentTrackingSchedule` (pass as `tracking` to the store, or to reschedule/close). Outcomes:
  `checked` (nothing or shipped/revised stored), `cancelled`, `superseded`, `conflict`,
  `failed { error }` (error code only). Compute it before the store: a "record" uses `checked`, or
  `cancelled` when the decision's status is `cancelled`.
- Hash is sha256 hex over net > 0 lines only; a `cancelled` revision stores the hash of no lines.
- `pnpm ai:check` fails locally on AGENTS.md size (CRLF on disk); see task 05 deviations.

## Task 06: discovery scan

- `workflows/shipment-notice/workflows/discover-shipments.ts`: `discoverShipmentsWorkflow`,
  input `{ deadline: Date }`, result `DiscoverShipmentsResult` `{ headers, matched, tracked,
  lead_lag_ms, trail_lag_ms, complete }`; lags = run start − cursor after the run.
- It does not check `bc_backoff_until` (task 08 skips the run); on throttling it sets the back-off
  (`max(Retry-After, 60 s)`) and returns `complete: false` without throwing. Any other BC or DB
  error rejects the workflow (cursor kept at the last complete window), so wrap it if checks must
  still run.
- The scan loop lives in `steps/scan-shipment-windows.ts` (used twice with `.config({ name })`:
  `scan-lead-shipment-windows`, `scan-trail-shipment-windows`). Deadline is checked with
  `Date.now()` before each BC request; tests spy `Date.now` to pass it mid-window.
- Pure helpers in `utils/discovery-window.ts`: `shipmentScanBounds`, `halveShipmentWindow`,
  `shipmentTrackingForHeaders`, constants `SHIPMENT_SETTLING_MS`, `SHIPMENT_TRAIL_LAG_MS`,
  `SHIPMENT_WINDOW_HEADER_BUDGET`, `SHIPMENT_MIN_BACKOFF_SECONDS`.
- Order candidates: companies via Query (`companies`, filter on `business_central_customer_number`),
  references via `listOrderExternalReferences`, order metadata via a commented narrow
  `query.graph` on `order` (the same read task 07 needs for `isCurrentBcOrder`).
- Step results carry dates as ISO strings. Integration spec
  `integration-tests/http/shipment-notice/discover-shipments.spec.ts` (about 2 min) has a
  window-honouring BC fake and a `seedApiOrder` helper (company + order with BC state + reference);
  `createCompanies` needs every `ModuleCreateCompany` field or it adds typecheck errors.

## Task 07: shipment checks

- `workflows/shipment-notice/workflows/check-shipments.ts`: `checkShipmentsWorkflow`, input
  `{ deadline: Date }`, result `CheckShipmentsWorkflowResult` `{ checked, recorded, unchanged,
  conflicts, errors, backlog_due, oldest_due_age_ms, status }`; `SHIPMENT_CHECK_BATCH_SIZE` (200) is
  exported from `steps/prepare-shipment-checks.ts`.
- It never throws for a per-shipment or BC problem (they become `errors` and `last_error` codes);
  only DB errors reject. It does not check `bc_backoff_until` itself; a throttled run sets it.
- `backlog_due` / `oldest_due_age_ms` are measured after the checks: use them as-is for the
  stalled-progress warning.
- Step names `prepare-shipment-checks`, `check-shipments`, `set-shipment-check-backoff`,
  `measure-shipment-backlog` do not collide with the discovery workflow's. The workflow id is also
  `check-shipments` (same as its step); harmless standalone, but give it a `.config({ name })` if
  nesting with `runAsStep` complains.
- The spec takes about 2 min (250-row batch test); knex "Connection ended unexpectedly" console
  lines in its output are pool noise, not failures. Check for stale jest processes holding the DB
  before re-running.

## Task 08: polling job

- `jobs/poll-shipment-notices.ts`: default `pollShipmentNoticesJob(container)`, `config`
  (`shipment-notice-poll`, every minute), `SHIPMENT_NOTICE_POLL_LOCK_KEY`, `..._LOCK_TTL_SECONDS`.
  It never throws (Medusa's job wrapper would log `error.message`).
- The job is disabled under `NODE_ENV=test` via `defineFileConfig`; a spec imports and calls it.
  Any later job needs the same guard or it fires inside every integration spec.
- `workflows/poll-shipment-notices.ts`: `pollShipmentNoticesWorkflow` (no input) →
  `ShipmentPollSummary` (`utils/shipment-poll.ts`); discovery and checks via `runAsStep` (step
  names `discover-shipments-as-step`, `check-shipments-as-step`, no collision).
- Verified: inside `when()`, a skipped sibling's result is `undefined` to a later `when` condition
  and `transform`; the poll spec covers both skip paths.
- Pure helpers: `isShipmentPollBackedOff`, `shipmentPollDeadline`, `shipmentPollLogLines`.
- `integration-tests/http/shipment-notice/poll-shipment-notices.spec.ts` takes about 75 s.

## Task 12: shared company resolution

- `workflows/order-ingestion/steps/resolve-company-by-customer-number.ts`:
  `resolveCompanyByCustomerNumberStep({ customer_number })` → `{ company_id }` (step id
  `resolve-company-by-customer-number`), `CUSTOMER_NOT_FOUND_MESSAGE` ("Customer not found").
  Task 09 imports it from there; it logs the warn line itself, so the caller adds no logging.
- Over HTTP the unknown-number body is exactly `{ type: "not_found", message: "Customer not found" }`
  (no `code`), asserted in `orders.spec.ts` TC-5 and the security spec.
- The duplicate check is now `steps/check-duplicate-external-order.ts`
  (`checkDuplicateExternalOrderStep({ company_id, external_order_number })`).
- The security spec's `beforeEach` registers a store user and company; an order API case there just
  needs its own secret key (`ApiKeyType.SECRET`, header `Basic <token>`).
- A logger spy works: `jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "warn")` sees
  the step's warn line in an `inApp` integration spec.

## Task 09: read endpoint

- Exact Medusa contract for task 10: `GET /orderapi/shipment-notices?customerNumber=&after=|since=&limit=`.
  It returns 200 with the envelope; errors are 400 `{ type: "invalid_data", message }`, 401
  (no or non-secret key), and 404 `{ type: "not_found", message: "Customer not found" }`.
- Query schema: `api/orderapi/shipment-notices/validators.ts`. Medusa's `zodValidator` calls
  `.strict()` on the schema itself; a zod 4 `.refine` survives that (probed). `after` must match
  `^(0|[1-9]\d{0,14})$`; `since` needs `Z` or an offset; `limit` is coerced, 1–200, default 50.
- Workflow `listShipmentNoticesWorkflow` (`workflows/shipment-notice/workflows/list-shipment-notices.ts`),
  input `{ customer_number, limit, after: string | null, since: string | null }`, returns the
  `ShipmentNoticeEnvelope`.
- Pure helpers `utils/shipment-notice-page.ts`: `companyShipmentNoticeQuery` (caps `after` at the
  int4 maximum; an uncapped value is a Postgres out-of-range error, which becomes a 500) and
  `shipmentNoticePage`.
- Test seeding: `integration-tests/utils/shipment-notices.ts`: `orderApiSecretHeaders`,
  `createApiCustomerCompany`, `storeShipmentNoticeRevision` (initializes the poll state and tracks
  the shipment on revision 1), and `EXAMPLE_SHIPMENT_NOTICE_PAYLOAD`.
- The HTTP spec takes about 1–2 min; the security spec about 2 min.

## Task 10: APIM operation and Logic App workflow

- Artifacts in `issues/NIMBUS-130/artifacts/`: `apim-policy.xml` (operation `GET
  /shipment-notices/{token}`), `logic-app-workflow-definition.json` (workflow `shipment-notices` in
  the NIMBUS-146 Logic App, reusing its four app-level parameters), `parameters.json`,
  `deployment-instructions.md`, `test-calls.md`. APIM named values `nimbus-shipment-logicapp-*`.
- The XML rendering is generic (property → element, null omitted, arrays → wrapper with
  `shipment_notice`/`line`, else `item`): a new contract field appears in XML without a policy
  change, but needs an XSD change in task 01's artifact.
- If the policy changes, re-run the recreated harness in
  `.tmp/NIMBUS-130-20261019-resume/task10-render/`: `gen.ps1 -Artifacts <artifacts dir>`, then
  `dotnet run --project <harness dir> -- <artifacts dir>` (Newtonsoft 13.0.3 from the local NuGet
  cache; `da-DK`; 69 checks PASS). `node <harness dir>/validate-workflow.cjs <repo root>` evaluates
  the URL expression and compares token lookup/401 branches with NIMBUS-146 (29 checks PASS).
- Pitfalls: no `//` comments inside attribute expressions (an attribute may be normalized to one
  line); `set-body` is not allowed directly in `on-error` (use `return-response`); `DateTime.Kind` /
  `ToUniversalTime` are not on APIM's allow-list (`DateTimeOffset` is); `JObject.Parse` turns ISO
  date-time strings into dates.
- No Azure deployment happened: expression acceptance, actual query forwarding and gateway error
  status remain the manual checks in `test-calls.md`. Backend baseline on resumption: 22 errors;
  task 10 changes no backend code.

## Task 11: Admin shipment recovery

- `/admin/shipment-tracking` lists closed/gave_up rows, with `company_name` resolved via Query;
  pagination defaults to 20/0, limit 1–200, unknown query keys rejected. Fields are fixed.
- `/admin/shipment-tracking/:id/retry` runs `reopenShipmentTrackingWorkflow` from
  `workflows/shipment-notice/workflows/reopen-shipment-tracking.ts`; its single step uses the
  existing atomic storage reopen method. Empty strict body/query and strict shtr_ id params.
- Default Admin auth remains installed. Verified installed authenticate middleware and HTTP:
  bearer/session actors identify users; secret-key actors identify the API key (stored as actor).
- Page `/app/shipment-tracking` uses `admin/hooks/api/shipment-tracking.tsx`; successful retry
  invalidates the `['shipment-tracking']` query prefix and pending actions are disabled.
- Tests authenticate Admin bearer requests through real `/auth/user/emailpass`: hand-signed
  fixtures using environment secrets were rejected by the running app's loaded configuration.
- HTTP six passed; RTL four passed; security three credential cases passed. Typecheck exactly matches all 22
  baseline diagnostics; lint has zero errors / 13 existing warnings. Logs `task11-*.log` in the
  resumption scratchpad. Live deployment/UI verification remains a later gate.

## Consolidation and finalization (2026-10-19)

- Consolidated against `1b6e33ab5de42272f71dbd6cd10cc4df8e1e5af7..84259bd`: no source changes needed.
  Company resolution, tracking schedules, state constants and back-off steps already have shared
  homes. Contract exports are intentional; no duplicate units, dead APIs or uncovered inter-task
  security path requiring a code change were identified. Compiled `.medusa` Jest duplicates are
  generated output, not duplicate source tests; leave unrelated Jest configuration unchanged.
- Branch line counts (`git diff --numstat`, backend `.ts`/`.tsx`): test files +4,322/-39;
  fixtures/test helpers +266/-0; source including generated migration +3,510/-90.
  Excludes generated migration JSON, case artifacts, Markdown and scratch files.
- Final evidence in `.tmp/NIMBUS-130-20261019-resume/`: unit 389/389, Admin 41/41;
  modules 369 passed/2 failed (source/generated duplicate of documented BC listOrders round-trip
  guardrail); build passed; lint zero errors/13 existing warnings. Counts include generated tests.
- Corrected complete HTTP run: 181 passed/31 failed, 15/18 suites passed. Of the failures, 23 were
  one companies startup-hook timeout; unchanged scoped rerun passed all 23 with unchanged timeout.
  Remaining eight quote failures have the documented unpublished-product fixture/cartSeeder 400
  signature; causal fixtures and routes equal merge-base (see `http-process-db-audit.md`). No fresh
  merge-base test execution was performed. Initial `final-http.log` was interrupted and is not a
  completed check; `final-http-correct-env.log` sets synthetic JWT before Jest configuration loads.
- Typecheck: 22 diagnostics, exactly the resumption baseline. Independently compared every failing
  line plus its following eight lines with merge-base: all 22 snippets occur verbatim there.
  Nineteen concern incomplete company fixtures, two untyped container calls, one optional JWT
  secret. Company module, `src/types`, affected shared helpers, package manifest, tsconfig and lock
  file are unchanged from merge-base. This supports pre-epic causes, not merely resume equality;
  no fresh merge-base compiler execution was performed. No diagnostic was suppressed.

Security matrix evidence (plan section 7):

| Property | Branch evidence and remaining limit |
|---|---|
| Known gateway token only | Task 10 offline workflow harness compares GlobalLists lookup and both 401 branches with existing order workflow; 29 checks. Live unknown/disabled token calls and confirmation Medusa was not called remain in `artifacts/test-calls.md`; no Azure deployment occurred. |
| Secret key on Medusa GET | `security-boundaries.spec.ts`, shipment-notices credential matrix: absent, customer and publishable credentials denied. |
| Own company's notices only | Same spec, `never returns another company's notices`. |
| No parameter injection | `orderapi/shipment-notices.spec.ts`, `rejects %s with 400 and Medusa's error body`, extra-parameter case; task 10 harness checks query allowlist and encoding. Actual APIM forwarding remains a deployment check. |
| Generic unknown customer, GET and POST | Security spec `answers an unknown customer number with a 404 that does not reveal it` and `answers an unknown order API customer number without revealing it`; workflow spec TC-2 verifies one warning containing only the customer identifier. |
| Right company/order/BC order association | `discover-shipments.spec.ts`, `tracks only shipments of the API order under its current BC order number`; `match-shipment-order.unit.spec.ts` covers foreign company, previous BC number and pre-go-live posting. |
| No personal data in job/error logs | `check-shipments.spec.ts`, `backs off an unpairable shipment, then gives up after the window`, asserts safe error codes and absence of receiver name/address; pure poll log tests assert counts. |
| Admin authentication for list and retry | Security spec `denies %s credentials on both admin shipment tracking endpoints`, three credential cases/six denied requests. |
| Admin list has safe fields | `admin/shipment-tracking.spec.ts`, `lists only gave-up rows newest first with safe typed fields and paging`. |
| Logic App history, replay and retention | History exposure accepted in plan; repeated reads covered by `returns the same page when called twice`; retention is a policy decision, no deletion feature added. |

- Task 10 offline policy/XSD harness: 69 checks, plus the 29 workflow checks above. These prove
  artifact behavior offline, not Azure policy acceptance or customer delivery.

## M1: polling deadline propagation (2026-10-20)

- Shipment adapter read methods now accept optional absolute `deadlineMs: number` as their last
  argument; discovery and checks pass the run deadline. Existing callers may omit it.
- `ShipmentReadDeadlineError` lives in `modules/business-central/shipment-reads.ts`. Each actual
  token/data dispatch checks the deadline, including nextLink pages and by-number chunks.
- Callers treat this error as normal incomplete work: discovery keeps the last complete cursor;
  unread checks keep schedule/attempts/error and do not set BC backoff. Complete final responses
  may still commit after expiry. The 20-second request timeout, token caching and throttle handling
  are retained; D1 discovery failure coupling is not changed.
- Evidence: adapter 27/27, affected module 48/48, fresh workflow HTTP 31/31; fresh typecheck matches
  the same 22 diagnostic headers, zero new. Lint zero errors/13 existing warnings; ai:check passed.
  Logs are `deadline-*` in the resumption scratchpad; `deadline-resume-audit.md` explains why the
  overnight incomplete HTTP log was replaced by a fresh scoped result with original timeouts.
- Production build result and handover are recorded in the M1 brief and PROGRESS entry. No live
  Business Central, Azure, deployment or customer-delivery result is established by these tests.
- Next owner: integration reviewer, then dispatcher/human gate. Retain after-deploy checks for
  Azure policy/forwarding/token failures, real TestDK posting/undo, production shipment matching,
  deployed Admin/next poll and monitoring. No push or deployment by consolidation worker.
