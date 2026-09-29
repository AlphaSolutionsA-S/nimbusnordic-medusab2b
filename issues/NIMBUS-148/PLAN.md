# NIMBUS-148: Send the Medusa order to Business Central

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-148
(Epic: https://alphasolutionsdk.atlassian.net/browse/NIMBUS-129)
**Scope:** issues/NIMBUS-148/SCOPE.md (approved 2026-09-02, unchanged)
**Branch:** `feature/NIMBUS-148` (from `develop`)
**Revision:** 2026-09-29 re-plan against the merged NIMBUS-129 (144/147) and NIMBUS-149 code on
`develop`, **approved by the user on 2026-09-29** with the decisions recorded below. Supersedes the
2026-09-02 plan.

## Objective

Take the persisted, header-only Medusa order and its retained canonical payload, resolve each line
to a real Business Central item, create the BC sales order, and record the outcome (including
partial and total failures at order and line level) on the order's
`business_central_integration` metadata. Build it as a reusable workflow that NIMBUS-158's manual
retry will call unchanged, triggered automatically by `order_ingestion.ready_for_business_central`.

## Analysis

### What is on `develop` today (verified from code, 2026-09-29)

- **Ingestion pipeline (NIMBUS-129 + NIMBUS-149, merged):** `POST /orderapi/orders` validates
  against the strict `CanonicalOrderSchema` and runs `createOrderFromCanonicalPayloadWorkflow`:
  `matchCompanyAndCheckDuplicateStep` → `createIngestedOrderStep` (`Modules.ORDER.createOrders`
  with `mapCanonicalOrderHeader` → native `currency_code`, `email`, `shipping_address`,
  `billing_address`) → `createRemoteLinkStep` (Order↔Company, `isList: true` on the order side) →
  `createOrderExternalReferenceStep` (unique index on `order_external_reference(company_id,
  external_order_number)`). The route then emits `order_ingestion.order_created`; the
  `order-ingestion-created` subscriber runs `enrichOrderWorkflow`, which sets
  `order_ingestion_state = "ready_for_business_central"` and emits
  `order_ingestion.ready_for_business_central` with `{ order_id }`. **No subscriber listens to that
  event yet — it is this story's trigger.**
- **Order metadata written at creation:** `company_id`, `canonical_order` (verbatim),
  `order_ingestion_state`, `order_ingestion_state_updated_at`, and
  `business_central_integration = createInitialBcIntegrationState(now)`.
- **`src/modules/order-ingestion/bc-integration-state.ts` exists** (created by NIMBUS-149 with this
  plan's contract, verbatim): key `business_central_integration`; `status: "pending" | "sent" |
  "failed"`; `bc_order_id`, `bc_order_number`, `attempt_count`, `initialized_at`,
  `last_attempt_at`, `sent_at`, `partial`, `failure_reason`, `line_failures[]`; and
  `createInitialBcIntegrationState`. Its parser and duplicate guard are **not** there — Task 01
  appends them. Nothing is renamed.
- **Canonical contract (final after the 2026-09-16 review):** line required set is `lineNumber`,
  `eanNo` (exactly 13 digits), `quantity`. `itemNumber`, `description`, `unitPrice` are optional.
  All dates are `DD-MM-YYYY`. Shared fixtures live in
  `src/modules/order-ingestion/__fixtures__/canonical-order-fixtures.ts`.
- **`business-central` module:** unchanged conventions (per-call token, discovery-URL validation,
  root-level `customers()` / `salesOrders()` / `salesInvoices()`, `escapeODataString`,
  `MedusaError`). New since the old plan: `createReturnFromSalesOrder` / `listReturnReasons` are
  **real** (NIMBUS-138, custom ODataV4 action), and `BusinessCentralAmbiguousOutcomeError` exists
  for write requests whose outcome is unknown. `BCOrder.status` is a plain `string`.
- **Test infrastructure:** unit / modules / HTTP jest projects exist; no scaffolding needed. The
  container-spy pattern on `BUSINESS_CENTRAL_MODULE` is already proven in
  `customers/company-sync.spec.ts`. `.env` (loaded by `jest.config.js`) holds credentials for a
  **test** BC tenant (environment `TestDK`); once the subscriber exists, existing suites reach it
  (Decision 12).
- **BC customer currency:** `getCustomer` (NIMBUS-156) returns `currencyCode: string | null` via
  `$expand=currency`. NIMBUS-147 commit `d90c26a` resolves a blank BC currency to local currency in
  `resolveCurrencyCode` (`prepare-company-bc-sync.ts`; `BUSINESS_CENTRAL_LCY_CODE`, default `DKK`)
  and deliberately left `getCustomer` reporting BC faithfully.

### How the old plan was stale

| Old plan statement | Reality on `develop` | Change |
|---|---|---|
| NIMBUS-129/149 unimplemented; Task 05 BLOCKED | Both merged; event and emitter exist | Blocker and fallback removed |
| Task 01 creates `bc-integration-state.ts` | NIMBUS-149 created it | Task 01 appends parser + guard + `BcSubmissionFailureReason` |
| `unitPrice` sent to BC (Decision 6, "open question") | User decided 2026-09-16: must not be sent | Not sent; type has no price field |
| Payload dates assumed ISO; `toBcDate` kept only `YYYY-MM-DD` | Dates are `DD-MM-YYYY` | Old code would have dropped every date; now converted |
| Item lookup errors "recorded as failed" | Old prepare step did not catch them | Caught → `bc_item_lookup_failed` |
| `createReturnFromSalesOrder` is a stub; `return-stub.spec.ts` | Real; `return.spec.ts` | References updated |
| `SalesOrders()` | `salesOrders()` | Fixed |
| Inline fixtures to dodge a jest hazard in NIMBUS-129 | NIMBUS-129 moved fixtures to `__fixtures__/` | Shared fixtures used |
| Spy-on-container uncertainty + fetch fallback | Pattern proven in `company-sync.spec.ts` | Removed |
| `.rejects.toThrow()` for workflow errors | Workflow rejects with a serialized object | `.rejects.toMatchObject({ type, message })` |
| `BCOrderStatus` mismatch observation | Type no longer exists | Observation removed |

### Business Central facts (from `issues/NIMBUS-129/bc metadata/std odata metadata.xml`)

- EAN lookup: `items()?$filter=gtin eq '<escaped>'&$top=2` (`gtin`, `Edm.String`, max 14).
- Creation: `POST salesOrders`, then one `POST salesOrders(<guid>)/salesOrderLines` per line (no
  deep insert); item line `lineType: "Item"`; `salesOrderLine.shipmentDate` is `Edm.Date`.
- No item-reference entity is exposed, so `custItemNo` can only be matched against `item.number`.

## Execution Plan

1. **Task 01 — extend the contract.** Append `BcSubmissionFailureReason` (now including
   `bc_customer_lookup_failed` / `bc_customer_not_found`), `parseBcIntegrationState` and
   `hasBusinessCentralOrder` to `bc-integration-state.ts` (TC-2..TC-5 to its spec). Create
   `bc-order-payload.ts`: narrow non-strict schema (no pricing/description fields; `currencyCode`
   and `requestedShipmentDate` included; dates via `CanonicalDateSchema`), `parseBcOrderPayload`,
   `readCompanyIdFromMetadata`, `canonicalDateToBcDate`. 10 unit cases.
2. **Task 02 — BC item lookup.** `findItemsForOrderLines`: `gtin eq eanNo` → `number eq
   itemNumber` → `number eq custItemNo`, `$top=2`, one token per batch. 10 module cases.
3. **Task 03 — BC sales-order creation.** `createSalesOrder`: header + per-line POSTs; line body
   `lineType`, `itemId`, `quantity`, `unitOfMeasureCode`, `shipmentDate` only; header sends no
   BC-owned fields and `currencyCode` only when given; timeout/5xx/408/2xx-without-id throw
   `BusinessCentralAmbiguousOutcomeError`. 13 module cases.
4. **Task 04 — reusable workflow.** `prepareBcOrderStep` (now also reads the BC customer via
   `getCustomer` and computes the currency override) → `submitBcOrderStep` →
   `recordBcOrderOutcomeStep`. Exports the existing `resolveCurrencyCode` (one word) and adds a pure
   `resolveBcCurrencyOverride` util. 5 unit + 17 HTTP cases.
5. **Task 05 — trigger + test-environment guard.** Subscriber on `READY_FOR_BUSINESS_CENTRAL_EVENT`;
   a Jest `globalSetup` that aborts integration runs unless `BUSINESS_CENTRAL_DISCOVERY_URL`
   targets an allowlisted test environment; one racy NIMBUS-149 assertion narrowed. 5 unit + 4 HTTP
   cases.

Order: 01 → 02 → 03 → 04 → 05. 02 and 03 edit the same two files — never in parallel.
## Decisions & Trade-offs

1. **Trigger = subscriber on `order_ingestion.ready_for_business_central`.** It exists on `develop`
   as this story's boundary and fires after the 201 is returned. Rejected: calling from
   `enrichOrderWorkflow` (a BC outage would compensate enrichment); a scheduled poller (a later
   recovery mechanism).
2. **Duplicate guard = `bc_order_id` set or `status === "sent"`.** The BC id is the natural
   idempotency token; no new field, table or migration. Also covers "header created, every line
   rejected".
3. **`attempt_count` counts attempts; a guarded short-circuit changes nothing.** NIMBUS-149
   adopted `attempt_count`. The user confirmed on 2026-09-29 that a guard-stopped call neither
   increments `attempt_count` nor touches any timestamp.
4. **Business failures are returned as data, not thrown**, so the record step always runs and
   nothing is stranded at `pending`. Only a missing Medusa order throws.
5. **BC line rejections after the header exists are collected, not thrown**, so a real BC id is
   always recorded and the guard stays armed. Consequence for NIMBUS-158: `failed` can carry a real
   `bc_order_id` (`all_lines_rejected_by_bc`).
6. **`unitPrice` is NOT sent to Business Central (user decision, now binding).** Recorded in
   `issues/NIMBUS-129/PROGRESS.md`, entry dated 2026-09-16:
   > "**Binding guidance recorded for NIMBUS-148** (in Task 02's doc, so it reaches that story):
   > a submitted `unitPrice` is a *stated expectation, not an instruction*. It must **not** be set
   > explicitly on the BC sales-order line — let BC price the line exactly as it does for a manually
   > keyed order. Setting it explicitly overrides BC's contract price, so a stale price in a
   > customer's ordering system would silently beat the negotiated one. Use the submitted value only
   > to detect and flag a discrepancy."

   `BCCreateSalesOrderLineInput` has no price field, the narrow payload schema does not read
   `unitPrice`, and Task 03 TC-3 / Task 04 TC-1 assert no `unitPrice` key reaches BC. The submitted
   value stays in `metadata.canonical_order`. **Confirmed and extended by the user 2026-09-29:**
   line `discountPercent`, `discountAmount`, `discountAppliedBeforeTax`, `taxCode`, `description`
   and header `pricesIncludeTax`, `discountAmount`, `discountAppliedBeforeTax`, `salesperson` are
   not sent either. `unitOfMeasureCode` and `shipmentDate` are sent. **`unitPrice` discrepancy
   flagging is deferred to NIMBUS-158** (user decision 2026-09-29).
7. **No compensation on the BC write, mitigated by logging.** If the record step fails after BC
   created the order, the state stays `pending` and a later run could duplicate it; the BC id/number
   are logged at `info` immediately. Durable fix out of scope.
8. **`custItemNo` can only match `item.number`**, and NIMBUS-129 found `itemNumber`/`custItemNo` both
   carry the customer's SKU in the real samples. The SCOPE-mandated fallback is kept (user decision
   2026-09-29).
9. **Batch item lookup** — one token per order instead of one per line.
10. **Not doing:** BC field-length truncation, rejecting blocked items. Flagged for the business.
11. **Ambiguous BC outcomes are recorded as `bc_submission_outcome_unknown`**, reusing the existing
    `BusinessCentralAmbiguousOutcomeError` (NIMBUS-138 precedent) with `externalDocumentNumber` as
    the idempotency key. A timeout/5xx may have created the order, so recording it as a plain
    failure would invite a duplicate on retry. Confirmed by the user 2026-09-29; the
    check-BC-before-retry belongs to NIMBUS-158.
12. **Integration tests may call the TEST BC tenant, and fail closed otherwise (user decisions
    2026-09-29).** The tenant in `apps/backend/.env` is a test tenant (environment `TestDK`), so
    suites reaching it are acceptable — the event-chain and orderapi suites use fake customer
    numbers, so their orders are recorded `bc_customer_not_found` and no BC order is created. The
    earlier fake-credentials guard in `setup.js` is dropped. Instead, a Jest `globalSetup`
    (`integration-tests/global-setup.ts`, wired in `jest.config.js`) parses the environment segment
    of `BUSINESS_CENTRAL_DISCOVERY_URL` and, for `integration:http` / `integration:modules` runs,
    aborts the whole run unless it is in `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` (comma-separated,
    default `TestDK`), with "Refusing to run integration tests against Business Central environment
    '<env>' — not an allowed test environment". A missing or unparseable URL is refused too. The
    messages never contain the URL, tenant id, client id or secret. `globalSetup` rather than
    `setup.js` because it runs once and a throw aborts the run; `setupFiles` runs per test file.
    **`.env` must never point at production BC when tests run.**
    **Environment-type check deliberately out of scope (user decision 2026-09-29).** Confirming the
    environment is of type `Sandbox` via the BC Admin Center API was verified on 2026-09-29 as not
    possible with the current app registration: its token has only the `API.ReadWrite.All` role,
    and `GET /admin/v2.24/.../environments` and `GET /admin/v2.21/.../environments` return `401`.
    It would need `AdminCenter.ReadWrite.All` (no read-only Admin Center scope exists). Any future
    type check must use a separate test-only app registration, never the integration's own app.
    One NIMBUS-149 assertion (`enrich-order-event-chain.spec.ts` TC-4) is narrowed because the
    asynchronous subscriber can now record an attempt before the test reads the order.
13. **Dates are converted, not passed through.** Canonical `DD-MM-YYYY` → BC `YYYY-MM-DD` via
    `canonicalDateToBcDate`; `requestedShipmentDate` → line `shipmentDate`.
14. **Company and addresses come from metadata, not from the link or native columns.**
    `metadata.company_id` and `canonical_order` are written in the same step as the order and are
    the verbatim source; the Order↔Company link and native addresses (NIMBUS-149) are not needed.
15. **`currencyCode` is sent only as an override (user decision 2026-09-29, replacing the
    "never send" recommendation).** `prepareBcOrderStep` calls the existing `getCustomer` (live BC
    value; `Company.currency_code` can still be `null` for companies synced before `d90c26a`). A
    blank BC currency is local currency, resolved by the company sync's own `resolveCurrencyCode`
    (exported, not duplicated) so both paths agree. The payload `currencyCode` is uppercased and
    sent only when it differs case-insensitively from the resolved customer currency; when equal it
    is omitted so BC applies the customer default. A customer BC does not know is recorded
    `bc_customer_not_found` (no item lookup, no create); a failing customer request
    `bc_customer_lookup_failed`. Cost: one extra token and request per order. Manual sandbox check:
    an override to the LCY code (e.g. `DKK` for a `EUR` customer) — BC's API normally maps the LCY
    code to blank; confirm.

## Resolved Decisions (user, 2026-09-29)

| # | Question | Decision |
|---|---|---|
| OQ-1 | Stop sending other BC-owned fields | **Yes.** Line discounts, tax code, description; header `pricesIncludeTax`, discount fields, `salesperson` are not sent. `unitOfMeasureCode` and `shipmentDate` are sent. (Decision 6) |
| OQ-2 | `currencyCode` | **Changed from recommendation:** send it as an override only when it differs from the BC customer's currency (blank BC currency = LCY per `d90c26a`); omit when equal. (Decision 15) |
| OQ-3 | `unitPrice` discrepancy flagging | **Deferred to NIMBUS-158.** |
| OQ-4 | Ambiguous BC outcome | **Yes:** record `bc_submission_outcome_unknown`; check-BC-before-retry belongs to NIMBUS-158. (Decision 11) |
| OQ-5 | `itemNumber`/`custItemNo` fallback | **Keep.** (Decision 8) |
| OQ-6 | Guard-stopped call | **Does not** increment `attempt_count` or touch timestamps. (Decision 3) |
| OQ-7 | Test safety | The `.env` BC tenant is a test tenant; tests may reach it. Fake-credentials guard dropped; replaced by the fail-closed environment allowlist in `globalSetup`; Sandbox-type check out of scope. Narrowed TC-4 assertion kept. (Decision 12) |

No open decisions remain.

## Observations for other plans (reported, not changed here)

- **NIMBUS-158** must reconcile to this contract: read via `parseBcIntegrationState`; switch on
  `BcSubmissionFailureReason` (including `bc_customer_not_found` / `bc_customer_lookup_failed`);
  treat `bc_submission_outcome_unknown` as "check BC by `externalDocumentNumber` before retrying";
  own the deferred `unitPrice` discrepancy flag (compare `canonical_order` prices with BC's line
  prices via `getOrder`);
  handle `failed` with a real `bc_order_id` (`all_lines_rejected_by_bc`); a retry of an order whose
  guard is armed is a no-op by design.
- `canonical-order-schema.ts` says of `itemNumber` that "nothing downstream resolves anything from
  it", but NIMBUS-148 keeps the `itemNumber`/`custItemNo` fallback (user decision 2026-09-29).
  That comment should be aligned in a later NIMBUS-147 touch; it is not changed here.
- **Possible later hardening (not in this story):** confirm the test BC environment is of type
  `Sandbox` via the BC Admin Center environments API, using a separate test-only app registration
  with `AdminCenter.ReadWrite.All` — never the integration's own app (see Decision 12).
- No automatic recovery exists for orders stuck at `pending` (lost event, subscriber crash). They are
  visible via `status: "pending"` for NIMBUS-158.

## Verification

- [ ] `cd apps/backend && pnpm test:unit` — Task 01 (10): state parser/guard; payload reader
      accepts the EDI fixture incl. `currencyCode`, strips price/description fields, rejects
      missing/empty/ISO-dated payloads; company-id reader; date conversion. Task 04 (CUR-1..5):
      currency override omitted on match, case-insensitive, sent uppercased on difference, blank BC
      currency = LCY (default `DKK`, `BUSINESS_CENTRAL_LCY_CODE` honoured). Task 05 (ENV-1..5):
      allowed environment passes; non-allowed refused without leaking the tenant; missing and
      malformed URLs refused; configurable allowlist with blank fallback.
- [ ] `cd apps/backend && pnpm test:integration:modules` — Task 02 (10) and Task 03 (13): header then
      per-line POSTs; no price/discount/tax/description/salesperson keys; `currencyCode` only when
      given; `shipmentDate` sent; optionals omitted; line rejections collected; 422 →
      `MedusaError`; 5xx / network error / 2xx-without-id → `BusinessCentralAmbiguousOutcomeError`;
      input guards; one token.
- [ ] `cd apps/backend && pnpm test:integration:http` — Task 04 (17): full send (converted date, no
      price keys, no currency on match); partial; zero resolved; definite failure; attempts 1→2→3;
      duplicate guard; missing payload; missing BC customer number; unknown order; metadata
      preserved; item-lookup failure; ambiguous outcome; BC-rejected line keeps its EAN; currency
      differs → override; blank BC currency; BC customer not found; BC customer lookup fails.
      Task 05 (4): handler drives `sent`; never throws; `config.event`; real event chain → `sent`.
      Existing event-chain and orderapi suites still pass (reaching the test tenant).
- [ ] Guard fails closed: an integration run with the discovery URL pointing at a non-allowlisted
      environment aborts before any suite.
- [ ] `pnpm build` and `pnpm lint` from the repo root.
- [ ] Manual, against the test BC tenant after merge: submit one real order and confirm a BC sales
      order with the expected `externalDocumentNumber`, customer, lines, BC-priced unit prices and
      the customer's currency; repeat with a differing currency to confirm the override. Watch for a
      `400` on `billToCustomerNumber` or explicit `billTo*` fields (one-line fix in
      `buildSalesOrderHeaderBody`).
