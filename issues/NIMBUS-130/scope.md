# Return shipment notices to API customers

**Date:** 2026-10-19
**Status:** Scope approved (2026-10-19, product owner / lead dev)
**Type:** Epic
**Priority:** Medium
**Issue:** NIMBUS-130 (https://alphasolutionsdk.atlassian.net/browse/NIMBUS-130)
**Key:** NIMBUS-130
**Case folder:** issues/NIMBUS-130/
**Base Branch:** develop

## Background

NIMBUS-129 lets external B2B customer systems submit orders: customer → APIM (`POST
/orders/{token}`) → Logic App (resolves the token to a Business Central customer number from the
GlobalLists token list) → Medusa `POST /orderapi/orders?customerNumber=…` → Medusa order → Business
Central sales order (asynchronous; outcome on `Order.metadata.business_central_integration`, with
`bc_order_id` and `bc_order_number`).

Decision of the product owner / lead dev (2026-10-19): **this epic delivers shipment notices
(despatch advice), not order confirmations.** The customer system fetches the shipment notices for
its API orders: with the same token, it asks "give me every shipment notice since my last
watermark" and gets JSON back. A shipment notice says which of the order's goods left the warehouse
and when, and where they were sent.

Trigger: the first API customer, Metz A/S, shared the despatch advice it receives today
(`samples/metz-desadv-NLF230439.xml`, an Evenex/N-EDI `eBusiness_01` document, type DESADV, from
Nimbus GLN 5790002776410 to Metz GLN 579000283084; the same Metz GLN as in its ORDERS files in
`issues/NIMBUS-129/example edi files/`). Its `OrderNo` / `ExternalDocumentNo` (NLF230439) is Metz's
own order number, the value Metz sends as `ExternalDocumentNo` in ORDERS and that we put on the BC
sales order as `externalDocumentNumber`. It is a drop shipment to Metz's end customer (ship-to
"JK Tryk"), three lines with the same item number and three different EANs, a carrier block with a
GLS tracking URL whose `%1` placeholder is not filled in and no tracking number, a total weight with
a Danish decimal comma (`1,8` KG), net weights per line with no unit (presumably grams) and no
prices. `System="HighJump"` suggests a HighJump/Körber WMS or its EDI connector produced it, not
Business Central.

Agreed shape, kept from the earlier scope (product owner, 2026-10-15; unchanged by the 2026-10-19
decision):

1. A scheduled Medusa job (about every minute) reads new posted shipments from Business Central for
   API orders and stores each as a shipment notice in Medusa.
2. A read endpoint on the order API (same token, same APIM + Logic App path as order submission)
   takes a watermark in the query string and returns the notices recorded since then, as JSON.
3. No changes in Business Central: no custom API pages, no webhooks or subscriptions. The solution
   works with what Business Central exposes today, by polling.

## Facts checked against the code and Business Central

### Order API and Medusa (2026-10-15, still valid)

- `/orderapi/**` is authenticated by one Medusa secret API key (HTTP Basic), held only by the Logic
  App and authenticated as an admin user (`apps/backend/src/api/orderapi/middlewares.ts`; matcher
  `/orderapi/orders*`, so a new path needs its own middleware entry). The customer is identified
  only by the `customerNumber` query parameter the Logic App adds after validating the path token;
  Medusa resolves it to a company by `business_central_customer_number`.
- Every API-ingested order has an `order_external_reference` row (`company_id`, `order_id`,
  `external_order_number`, unique per company and external number) in the `orderIngestion` module.
  Orders are linked to companies through `links/order-company.ts`.
- Business Central delivery state is in order `metadata.business_central_integration`
  (`status` pending | sent | failed, `bc_order_id`, `bc_order_number`, `sent_at`). The BC sales
  order is created with `externalDocumentNumber` = the customer's `externalOrderNumber`
  (`workflows/business-central-order/steps/prepare-bc-order.ts`).
- Medusa cannot filter, range-compare or sort on keys inside `metadata`: `query.graph` doesn't
  support metadata filters at all, and a module service only does equality containment on JSONB
  (Medusa docs, "Metadata Filtering in Query", read via the `medusa` MCP 2026-10-15). There is no
  index on a JSON path either. So `bc_order_number` cannot be looked up from a shipment's
  `orderNumber` through order metadata (see P1).
- Ingested orders are header-only Medusa orders; the customer's lines are kept in order
  `metadata.canonical_order`, each with the customer's `lineNumber` (unique per order) and `eanNo`
  (13-digit EAN, required) (`modules/order-ingestion/canonical-order-schema.ts`).
- At submission each line's EAN is resolved to a BC item by the item's `gtin` (then item number,
  then customer item number), and the BC sales line is created with `itemId` and quantity only, no
  variant code (`modules/business-central/service.ts`, `buildItemLookupCandidates`,
  `buildSalesOrderLineBody`). Lines are posted one at a time in the customer's order; the response
  of each line POST (which carries the BC line `sequence`) is not kept today.
- No scheduled job exists yet (`apps/backend/src/jobs/` holds only the README).
- Medusa Cloud may run more than one worker instance (product owner, 2026-10-15), so the job can
  fire on several instances and any in-process guarantee is void.
- The Business Central adapter reads the standard API v2.0 with OAuth client credentials, requests
  a new OAuth token on every public call (no caching) and has no retry helper.
- The deployed Logic App is one Standard workflow with a single `POST orders/{token}` trigger
  (`issues/NIMBUS-146/artifacts/logic-app-workflow-definition.json`); a GET needs its own workflow.
  The APIM operation drops caller query parameters (`copy-unmatched-params="false"`,
  `issues/NIMBUS-145/artifacts/apim-policy.xml`).

### Scheduling and locking across instances (verified 2026-10-15, still valid)

- `apps/backend/medusa-config.ts` sets no `workerMode`, no locking provider, no Redis modules.
  Locally the defaults apply: in-memory locking, in-memory workflow engine.
- Scheduled jobs are loaded only when `projectConfig.workerMode` is `worker` or `shared`
  (`@medusajs/medusa@2.21.2` `dist/loaders/index.js`, `shouldLoadBackgroundProcessors`), so every
  worker instance registers the job.
- With the in-memory workflow engine each instance runs its own `setTimeout` timer
  (`workflow-engine-inmemory` `dist/utils/workflow-orchestrator-storage.js`): every instance runs
  every tick. With the Redis workflow engine the job is a BullMQ repeatable job with a fixed key
  `schedule_<jobId>` (`workflow-engine-redis` `dist/utils/workflow-orchestrator-storage.js`,
  `schedule()`), so one tick is normally picked up by one worker. Neither is treated as a
  guarantee here (a slow run overlaps the next tick; BullMQ delivery is at-least-once).
- Locking providers installed with 2.21.2: in-memory (default), `@medusajs/medusa/locking-redis`
  and `@medusajs/medusa/locking-postgres` (Postgres advisory locks, needs a migration), registered
  under `@medusajs/medusa/locking` → `options.providers` in `medusa-config.ts` (Medusa docs,
  "Redis / PostgreSQL Locking Module Provider", via the `medusa` MCP).
- Medusa Cloud provisions Redis and auto-configures the Redis event bus, caching, **locking** and
  **workflow engine** modules on the Launch, Scale and Enterprise plans, not on Develop; projects
  must not register those modules themselves (Medusa docs, "Cloud > Redis"). The Nimbus project is
  on the Develop plan (product owner, 2026-10-15), so deployed environments have no Redis and
  locks are in memory per instance today.
- The app-wide in-memory locking assumption is handled in NIMBUS-179, which registers
  `@medusajs/medusa/locking-postgres` as the cross-instance lock provider. Not part of this epic.

### Where Business Central keeps shipments (checked 2026-10-19)

Checked read-only against TestDK with the adapter's own credentials (GET only), on top of the
`$metadata` snapshot in `issues/NIMBUS-129/bc metadata/std odata metadata.xml` (lines 3325–3414;
excerpt: `samples/bc-sales-shipment-metadata.xml`).

- A shipment notice corresponds to the **posted sales shipment** (BC tables 110 Sales Shipment
  Header / 111 Sales Shipment Line), exposed in the standard API v2.0 as `salesShipments` with lines
  `salesShipmentLines` (`$expand` works). Every header and line property in the snapshot is present
  on live data; there are no others.
- `salesShipment`: key `id` (Guid); `number` (the posted shipment number; TestDK numbers are 8
  digits, `3094xxxx`, the same format as the DESADV `DocumentNo` 30958372, so `DocumentNo` is very
  likely the shipment number; production not checked); `orderNumber` (the BC sales order number,
  e.g. `SO347945`, = our `bc_order_number`, filled on all 200 recent rows sampled);
  `externalDocumentNumber`; `customerPurchaseOrderReference`; `postingDate`; `customerNumber`,
  `customerName`, `billTo*`, `sellTo*` and `shipTo*` names and addresses, `shipToContact`;
  `currencyCode`, `paymentTermsCode`, `shipmentMethodCode`, `pricesIncludeTax`, `salesperson`,
  `phoneNumber`, `email`, `lastModifiedDateTime`. TestDK holds 47,952 posted shipments.
- `salesShipmentLine`: `id`, `documentId`, `documentNo`, `sequence` (BC line number, 10000 steps),
  `lineType` (Item, or blank for comment lines), `lineObjectNumber` (item number), `description`,
  `description2`, `unitOfMeasureCode`, `quantity`, `unitPrice`, `discountPercent`, `taxPercent`,
  `shipmentDate`.
- Filters that work (HTTP 200): `$filter=lastModifiedDateTime gt <timestamp>` with
  `$orderby=lastModifiedDateTime`, and `orderNumber eq 'A' or orderNumber eq 'B' …`.
- **Partial shipments are common:** in the 200 most recent shipments, 11 of 185 orders had 2 to 4
  shipments. Each partial shipment repeats every order line, with quantity 0 for lines not shipped
  that time (309 of 2,776 lines in the 500 most recent shipments had quantity 0).
- **Undo Shipment changes a posted shipment:** 5 of the 500 most recent shipments have negative
  correction lines (sequence = original + 5000, quantity = minus the original) added to the same
  shipment; one is fully undone. In the sample all were undone on the posting day.
- **Undo Shipment does not move the header's `lastModifiedDateTime`** (checked 2026-10-19 with
  item ledger entry numbers as a clock, `itemLedgerEntries` filtered by `documentNumber`):
  shipment 30947937 has `lastModifiedDateTime` 07:07:01; another shipment, 30947938 (modified
  07:09:15), was posted after its original entries (≤ 269903) and before its undo entries
  (≤ 269912), so the undo happened after 07:09:15 and left the header timestamp at 07:07:01. The
  other four undone shipments had no shipment posted in between, so they neither confirm nor
  contradict this. Consequence: a "changed since" read on the header timestamp does not see undos;
  detecting them needs re-reading recorded shipments and comparing their lines (R7).
- `externalDocumentNumber` was empty on 167 of the 200 recent shipments (presumably orders entered
  by hand in BC); `customerPurchaseOrderReference` was filled on all and never equal to it. For API
  orders `externalDocumentNumber` should carry the customer's order number, as the DESADV sample
  shows for Metz; not yet seen on a TestDK shipment of an API order (P3).
- **Not in the standard API v2.0:** EAN or variant code per shipped line (no `variantCode` on
  `salesShipmentLine`; the item's `gtin` is one value per item, while the sample has three EANs on
  one item number), shipping agent and package tracking number (fields on table 110, not exposed),
  tracking URL (from the shipping agent's internet address), weights. Getting them from Business
  Central needs a custom API page (ruled out: no BC changes) or another source (the WMS/EDI layer
  that produces the DESADV today). Left out of this epic (Q11).

## Requirements

### Functional

- **Polling (Medusa job, about every minute).** Read posted shipments that are new or changed in
  Business Central since the job's last run (Decision: how new shipments are found), keep those that
  belong to an API order (R1, R2), and record each as a shipment notice (R5–R6). Re-read the
  shipments already recorded that are still inside the re-check window, and record a revision when
  their shipped lines changed (R7).
- **Stored notice.** A snapshot of the posted shipment as Business Central holds it, header and
  shipped lines, in the contract's shape; one row per revision.
- **Read endpoint (Medusa).** `GET` on the order API, authenticated like `POST /orderapi/orders`,
  with `customerNumber` (added by the Logic App) and a watermark. Returns the caller's shipment
  notices recorded after the watermark, oldest first, one page at a time, with the watermark to
  send next and whether more remain (see Watermark design).
- **Customer path (Azure).** A new APIM operation `GET /shipment-notices/{token}` and a new Logic
  App workflow in the same Logic App Standard resource that validates the token against the same
  token list, rejects exactly as the order flow does (401 "Token not recognized" / "Not allowed"),
  and forwards to Medusa with the resolved customer number and only the watermark and page-size
  parameters.
- **Response format.** Medusa returns JSON. APIM maps it to XML for the customer: a plain XML
  rendering of the same contract (APIM `json-to-xml` policy or a mapping), not the Evenex
  `eBusiness_01` DESADV format (Q12). The XML element names (root, repeated `shipment_notice` and
  `line` elements) are part of the contract (NIMBUS-151). The caller chooses with the `Accept`
  header: `application/xml` → XML, anything else (or none) → JSON (product owner, 2026-10-19).

### Shipment notice contract (draft, from `salesShipment`)

The planner fixes names and types (NIMBUS-151).

- Envelope: `shipment_notices[]`, `next_cursor`, `has_more`.
- Header: `cursor` (this notice's watermark position), `recorded_at` (when Medusa recorded it),
  `revision` (1 for the first notice of a shipment, then 2, 3 …), `status` (`shipped` for
  revision 1, `revised` for a later revision with goods still shipped, `cancelled` when every line
  nets to zero), `previous_cursor` (the cursor of the revision it replaces, null for revision 1),
  `order_id` (Medusa), `external_order_number` (the customer's; from the API order, equal to BC
  `externalDocumentNumber`), `bc_order_number` (`orderNumber`), `shipment_number` (`number`),
  `shipment_date` (`postingDate`), `shipment_method_code`, `your_reference`
  (`customerPurchaseOrderReference`; Q14), `sell_to` (customer number, name, address,
  city, post code, country), `bill_to` (customer number, name, address…), `ship_to` (name, contact,
  address…).
- Lines (net shipped quantity per line, R6): `line_number` (the customer's `lineNumber`, P1),
  `ean_no` (the EAN the customer sent on that line, P1; agreed, Q10), `bc_line_number`
  (`sequence` of the original line), `item_number` (`lineObjectNumber`), `description`,
  `description_2`, `unit_of_measure_code`, `quantity` (net of undo corrections), `shipment_date`.
  Revision 1 lists lines with net quantity > 0; a later revision lists every line that revision 1
  listed, with quantity 0 where it was undone. Correction lines are never shown as lines of their
  own. A notice is always a full snapshot, never a delta: the customer keeps the latest revision per
  `shipment_number`.
- Not returned: `salesperson`, `phoneNumber`, `email`, dimensions, internal ids; prices
  (`unitPrice`, `discountPercent`, `taxPercent`, `currencyCode`, `pricesIncludeTax`): a despatch
  advice carries none, as the sample shows (Q14).
- Left out (Q11; possible later extension, which would need a source other than BC's standard
  API): carrier, tracking number and URL, weights.

### Non-functional

- Correct with N concurrent workers. Two layers:
  - Efficiency: one polling run at a time across instances (`lock-single-run`: acquired in the
    job, try once, skip if held, release in `finally`, TTL longer than the worst-case run, with an
    `ownerId`). The job uses the default lock provider; it becomes cross-instance when NIMBUS-179
    registers `@medusajs/medusa/locking-postgres`. Until then duplicate runs only cost duplicate
    Business Central reads; nothing below depends on the lock.
  - Correctness: storing is idempotent and serialized in the database (R7, Watermark design), so
    two runs at once can never store the same shipment content twice, never store two revisions
    with the same number, and never make a notice visible out of cursor order.
- Business Central load is bounded: one OAuth token per run (today the adapter fetches one per
  call), a paged "changed since" read plus batched re-reads of the shipments inside the re-check
  window (several shipment numbers per request), and a cap on rows per run.
- A Business Central failure never records a notice and never moves the job's Business Central
  watermark; the next run retries the same window. The job logs failures with order and shipment
  numbers only, never names, addresses or contact data.
- The endpoint never returns another company's notices and never echoes the token; errors are
  generic.
- The read endpoint is a pure read: calling it does not change what a later call returns
  (no "mark as delivered" side effect), so a lost response can be fetched again.
- Business Central is not changed: no custom API pages, extensions, webhooks or subscriptions.

## Business rules

- R1 Only orders received through the order API (with an `order_external_reference`) get shipment
  notices. Shipments of storefront orders and orders entered in Business Central are never stored
  and never returned.
- R2 A posted shipment belongs to an API order when its `orderNumber` equals that order's current
  BC order number (`bc_order_number`, delivery status `sent`). After an Admin "force resend" the
  order has a new BC order number; shipments are matched to the current one only (decided for now,
  can be revisited; Q15).
- R3 Shipments are reported whatever the Medusa order's state: goods that Business Central shipped
  are reported even if the Medusa order was canceled meanwhile (decided for now, can be revisited;
  Q15). There is no per-order polling window or expiry; an order's shipments are picked up whenever
  they are posted.
- R4 No back-fill: the job starts reading Business Central at go-live of this epic; shipments
  posted earlier are never reported (product owner, Q16).
- R5 A shipment notice is one posted sales shipment. An order shipped in parts gets one notice per
  posted shipment, each with its own watermark position. A shipment that changes after it was
  recorded gets a revision (R7). This rule has one home: a pure decision function that turns one
  Business Central shipment (with lines), the order's customer lines and the latest stored revision
  into "new notice", "revision" or "nothing to record".
- R6 Lines are netted: an undo correction line (negative quantity) is subtracted from the original
  line it corrects (the nearest preceding item line with the same item number and unit of measure;
  P8 verifies this pairing). Lines with net quantity 0 that were never reported (order lines not
  shipped this time) and comment lines are left out. A shipment whose lines all net to zero before
  it was ever recorded is not recorded at all.
- R7 Revisions instead of "record once" (product owner, 2026-10-19, Q13):
  - The first time a shipment is seen it is recorded as revision 1 with a new watermark position.
  - Each run also re-reads the shipments already recorded within the re-check window (14 days
    after posting, Q13a) and compares the netted lines with the latest stored revision (a
    content hash of line, item, unit and net quantity). When they differ, a new revision is
    recorded with a new watermark position, so a customer reading after its watermark receives it.
    When they are equal, nothing is recorded.
  - A revision is a full snapshot with `status` `revised`, or `cancelled` when every line nets to
    zero (lines listed with quantity 0).
  - Storing is insert-if-changed: under the counter lock, the store compares the content hash with
    the latest stored revision of that BC shipment and inserts only if it differs, with
    `revision` = latest + 1 (unique per BC shipment). A second run that finds the same content
    stores nothing and takes no watermark position.
  - Why re-read and not timestamps: Undo Shipment does not move the header's
    `lastModifiedDateTime` (Facts), so the "changed since" read cannot see it.
  - A shipment is first recorded only once its last change is at least 15 minutes old (settling
    delay, Q13a): all TestDK undos were on the posting day, so this avoids most "shipped" +
    "cancelled" pairs minutes apart, at the cost of notices arriving 15 minutes later.
  - After the window a change is not detected. Undo is possible only until the shipment line is
    invoiced, which in practice closes it.
- R8 A customer sees only notices of orders whose company has the Business Central customer number
  the Logic App resolved from its token. An unknown customer number → 404 with a generic message
  (the same outcome as order submission); a known customer with nothing new → 200 with an empty
  list.
- R9 Nobody edits a stored notice; it is written only by the polling job (actor: system). No Admin
  UI in this epic.
- R10 Stored notices are kept as long as the order.
- R11 The API runs alongside the EDI despatch advice Metz receives today. It is a pull mechanism:
  whether Metz uses it, the EDI despatch advice or both is Metz's choice. Nothing is deduplicated or
  suppressed between the two on our side (product owner, Q12b).

## Decision: how new shipments are found (recommended; planner verifies)

A "changed since" read of Business Central, not per-order polling.

- Each run asks Business Central for shipments with `lastModifiedDateTime` after the job's stored
  Business Central watermark minus an overlap (proposed 10 minutes), oldest first, paged, lines
  expanded, and up to now minus the 15-minute settling delay (R7). It keeps the shipments that match an API
  order (R1, R2), records them (R7) and then moves the stored watermark to the newest
  `lastModifiedDateTime` it processed. The overlap covers rows that become visible in Business
  Central after a later timestamp; re-reading them is harmless because recording is idempotent.
- Why: an order can be shipped in several parts over weeks, so per-order polling would need to know
  when an order is fully shipped, which the shipments alone don't tell, and it costs requests per
  open order. The "changed since" read costs a constant number of requests per run and misses no
  late shipment. Both filters it needs were verified on TestDK (Facts).
- Cost: it reads all customers' shipments in the window, most of which are discarded (TestDK holds
  47,952 in total; production volume per minute not measured, planner checks it).
- The earlier per-order design (outstanding orders, 30-day expiry, backoff) is dropped.
- Second part of each run, for revisions (R7): re-read the shipments recorded within the re-check
  window by shipment number, in batches (`number eq 'A' or …`, lines expanded), and compare their
  netted lines with the latest stored revision. This is needed because an undo leaves the header
  timestamp unchanged (Facts). Cost: one request per batch of recorded shipments in the window. A
  failed re-read records nothing and is retried next run.

## Decision: data model, not order metadata

A data model in the existing `orderIngestion` module, not `Order.metadata`.

- The read is "everything after watermark X for company Y, ordered, paged". That needs a
  comparable, indexed, monotonic column and a company filter. Medusa can't filter, range-compare or
  sort on metadata keys (Facts), so metadata would force loading every order of a company and
  filtering in memory on every call, from a public endpoint. An order with several shipments makes
  metadata worse still (a growing array per order).
- `orderIngestion` already owns the API-ingested order identity (`order_external_reference`: the
  same order id, company id and external order number the notice carries), so one module owns the
  order API's data (`data-ownership.md`).
- Order metadata keeps what it holds today (the BC delivery state); the new tables reference
  orders by id, like `order_external_reference` does, with no foreign keys across modules.

## Decision: watermark design (unchanged by the 2026-10-19 decision, except the store check)

An opaque cursor backed by a database sequence number assigned when the notice is recorded,
exclusive, oldest first, paged.

- Each stored notice gets a monotonically increasing integer (`sequence`) at insert. The API
  returns `next_cursor` (the last item's sequence, as an opaque string) and `has_more`; the caller
  stores `next_cursor` and sends it as `?after=<cursor>`. Exclusive (`> after`), so nothing is
  returned twice and nothing is skipped on ties.
- Timestamps were rejected as the customer's watermark: many notices can share one timestamp (one
  polling run records a batch), clock skew between instances, and "inclusive or exclusive" both
  fail on ties (duplicates or losses).
- **Safe with concurrent writers: the sequence comes from a counter row locked inside the
  inserting transaction.** A plain database sequence is not enough with several workers: a number
  taken before commit can become visible after a higher one, and a reader that already moved its
  cursor past it would never see it. Instead the `orderIngestion` module keeps one counter row.
  Storing a notice is one transaction in the module service (`data-service-transaction`: public
  `@InjectManager()` method, protected `@InjectTransactionManager()` method): lock the counter row
  (`SELECT … FOR UPDATE`, or the ORM's pessimistic write lock), read the latest stored revision of
  the BC shipment and stop if its content hash equals the new one, otherwise increment the counter,
  insert the notice (revision = latest + 1, or 1) with that value, commit. A second writer
  waits on the counter row until the first commits, so commits happen in sequence order and a
  reader that sees number N+1 also sees N. Raw SQL, if used, stays inside the owning module's
  service (`data-ownership.md`).
  - Why this one: it holds by database semantics alone, needs no lock provider and no clock. A
    distributed lock around the store step depends on the provider being cross-instance
    (NIMBUS-179) and on TTL never expiring mid-write. A read-side "visibility horizon" (return only
    rows older than a lag) depends on guessing the longest transaction and delays every notice.
  - Cost: writes are serialized, but there is one write per shipment or revision, so contention is
    negligible. Re-reads that find no change write nothing.
  - Gaps are harmless: the cursor is exclusive and only order matters. With the content check under
    the counter lock, a duplicate run takes no number at all; the unique index on (BC shipment id,
    revision) is the backstop.
  - A revision gets a higher cursor than everything before it, so a customer who already read
    revision 1 receives revision 2 on its next call; one who reads both in one page gets them in
    order.
- First call / bootstrap: no `after` returns from the beginning. An optional `since=<ISO 8601
  timestamp>` (inclusive, on recorded-at) is accepted only when `after` is absent, for a customer
  that wants to start from a date; `after` and `since` together → 400.
- Page size: `limit`, default 50, max 200. Response: `{ shipment_notices: [...], next_cursor,
  has_more }`; with no results `next_cursor` echoes the request's `after` so the caller can always
  store it.
- The job's own Business Central watermark (Decision: how new shipments are found) is separate from
  the customers' cursor and never exposed.

## Data model (draft)

| Entity / field | Key and meaning | Owner | Written by | Stored / derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| `shipment_notice` | one row per revision of a posted BC shipment of an API order; id prefix `?` | `orderIngestion` | polling job (workflow step) | stored | yes: holds customer and end-customer names and addresses from BC | as long as the order (R10) |
| `.bc_shipment_id` | BC `salesShipment.id`; unique together with `revision` | `orderIngestion` | job | stored | no | as row |
| `.revision` | 1, 2, 3 … per BC shipment | `orderIngestion` | the store transaction | stored | no | as row |
| `.status` | `shipped`, `revised`, `cancelled` | `orderIngestion` | job (decision function, R5) | stored | no | as row |
| `.content_hash` | hash of the netted lines (line, item, unit, net quantity); compared on re-read | `orderIngestion` | job | stored | no | as row |
| `.recheck_until` | end of the re-check window (posting date + 14 days) | `orderIngestion` | job | stored (or derived from `shipment_date`; planner) | no | as row |
| `.shipment_number` | BC `salesShipment.number` | `orderIngestion` | job | stored | no | as row |
| `.order_id` | Medusa order id, indexed, not unique (several shipments per order) | `orderIngestion` | job | stored | no | as row |
| `.company_id` | company the order belongs to (from `order_external_reference`), indexed with `sequence` | `orderIngestion` | job | stored (copied for the scoped read) | no | as row |
| `.external_order_number` | the customer's own order number | `orderIngestion` | job | stored | no | as row |
| `.bc_order_number` | BC sales order number the shipment belongs to (`orderNumber`) | `orderIngestion` | job | stored | no | as row |
| `.shipment_date` | BC `postingDate` | `orderIngestion` | job | stored | no | as row |
| `.sequence` | watermark position, monotonic, unique, indexed with `company_id` | `orderIngestion` | the store transaction, from the counter row | stored | no | as row |
| notice counter | one row holding the last `sequence` issued; locked for update by every store | `orderIngestion` | the store transaction only | stored | no | permanent |
| `.recorded_at` | when Medusa recorded the notice | `orderIngestion` | job | stored | no | as row |
| `.bc_last_modified_at` | BC `lastModifiedDateTime` of the shipment when recorded | `orderIngestion` | job | stored | no | as row |
| `.payload` | header + lines snapshot in the contract's shape | `orderIngestion` | job | stored (JSON) | yes (as above) | as row |
| job state | the job's Business Central watermark (last `lastModifiedDateTime` processed) | `orderIngestion` | job | stored, one row | no | permanent |
| BC line number per customer line | `order_id`, customer `lineNumber`, BC `sequence` (only if P1 chooses to record it at submission) | `orderIngestion` | order submission (NIMBUS-129 flow) | stored | no | as long as the order |
| BC order number lookup | a way to find the API order for a shipment's `orderNumber` without reading metadata (P1) | `orderIngestion` | ? | ? | no | ? |

## Security properties (draft)

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| Only a known customer token reads notices | New Logic App workflow validates `{token}` against the same GlobalLists token list | GlobalLists list + Logic App | 401 "Token not recognized" / "Not allowed"; Medusa not called |
| Medusa accepts only the Logic App | Same secret API key over Basic auth, new middleware entry for the new path | Medusa secret API key | 401 from Medusa |
| A customer sees only its own notices | Medusa filters by the company resolved from `customerNumber`; the Logic App sets it from the token, never from the caller | Logic App (the key is admin-equivalent; existing accepted trade-off from NIMBUS-129, now also covering reads) | Unknown number → generic 404; never a cross-company row (negative test in `security-boundaries.spec.ts`) |
| Caller can't inject `customerNumber` | APIM forwards only `after`, `since`, `limit` | APIM policy | Extra parameters dropped |
| A shipment is attached to the right order | Matched on the current BC order number (R2), and the company copied from that order's `order_external_reference`, never from BC customer fields | Medusa data | A shipment with no matching API order is skipped |
| No data leaks in errors or logs | Generic errors; job logs order and shipment numbers, not names or addresses (drop-ship end customers are third parties); token not echoed | Code review | — |
| Replay | Read-only endpoint; replay returns the same data to the same token holder | — | Acceptable |

Token redaction from logs stays out of scope, as decided in NIMBUS-145 and NIMBUS-146.

## Affected apps

- **backend:** new models and migration in `orderIngestion`; Business Central adapter read of
  `salesShipments` with lines, "changed since" and paged (a focused file beside the service, as
  `return-history.ts` is) and the batched re-read by shipment number; the notice decision function
  (R5–R7: netting, revision detection); polling workflow and the
  project's first scheduled job; new `GET` route under `/orderapi` with its middleware; possibly a
  small addition to the NIMBUS-129 submission flow to keep the BC line number per customer line
  (P1); tests including security negative cases.
- **Azure (APIM, Logic App):** a new GET operation with an `Accept`-driven JSON→XML transform and
  a new Logic App workflow; repo artifacts
  under the case folder, as NIMBUS-145/146 did.
- **Business Central, storefront, CMS:** none.

## Proposed structure (stories)

1. **NIMBUS-151 Define the shipment notice contract**: the JSON response schema (envelope, header,
   lines, revision and status) mapped from the posted sales shipment and the customer's order
   lines, and its XML rendering (element names).
2. **NIMBUS-150 Poll Business Central for shipments and store shipment notices in Medusa**: data
   model, BC adapter "changed since" read and batched re-read of posted shipments, the notice
   decision function (R5–R7), the line match (P1), polling workflow, the every-minute job with the
   single-run lock, overlap, 14-day re-check window and 15-minute settling delay.
3. **NIMBUS-152 Serve shipment notices since a watermark from the order API**: the Medusa `GET`
   route, cursor/since/limit validation, company scoping, paging, security tests.
4. **NIMBUS-178 Expose shipment notices through APIM and the Logic App**: APIM GET operation (query
   whitelist, HTTPS, JSON→XML transform chosen by `Accept`), new Logic App workflow reusing the token list, deployment instructions and
   manual test payloads.

Order: 1 → 2 → 3 → 4 (2 and 3 can run in parallel once 1 and the model exist).

## Resolved questions

- Q1 XML or JSON → Medusa returns JSON; APIM returns XML when the caller asks for it (Q12).
- Q6 Page size → default 50, max 200.
- Q7 Retention → as long as the order (R10).
- Q8 Polling vs webhooks → polling only; no changes in Business Central.
- P2 Single worker? → "there might be multiple workers". Design made correct for N concurrent
  workers: idempotent insert and a counter row locked in the store transaction (Watermark design),
  with a cross-instance single-run lock only to save Business Central reads.
- P4 Lock provider in deployed environments → Develop plan (no Redis);
  `@medusajs/medusa/locking-postgres` approved, delivered in NIMBUS-179.
- P5 App-wide in-memory locking assumption → NIMBUS-179 (Bug, relates to NIMBUS-130).
- Q9 Order confirmations or shipment notices → shipment notices (product owner / lead dev,
  2026-10-19).

Answered by the product owner on 2026-10-19:

- Q10 EAN per line → yes, as recommended: the EAN Metz sent on that order line, taken from the
  order in Medusa through the line match (P1); no Business Central change. Lines Nimbus staff
  added or changed in BC have no customer EAN (`ean_no` null).
- Q11 Carrier, tracking and weights → left out for now. A possible later extension; it would need a
  source other than Business Central's standard API (a custom BC page, or the WMS/EDI layer).
- Q12 Format → Medusa returns JSON; APIM maps it to a plain XML rendering of the same contract (not
  the Evenex `eBusiness_01` DESADV). The caller chooses through the `Accept` header; JSON is the
  default.
- Q13 Changed shipments → send a revised notice when a recorded shipment changes, instead of
  "record once". Design in R7: re-read within a window, compare netted lines, store a new revision
  with a new watermark position; `status` `revised` or `cancelled`.
- Q13a Re-check window and settling delay → 14-day re-check window after posting; keep the
  15-minute settling delay before revision 1 (as recommended).
- Q12b Does the API replace today's EDI despatch advice for Metz? → no, both run side by side. The
  API is a pull mechanism; whether Metz uses it, the EDI despatch advice, or both is Metz's choice.
  No deduplication or suppression between the two on our side (R11).
- Q14 Prices and references → prices left out; `your_reference` returned.
- Q15 Edge orders → decided for now, can be revisited: shipments of orders canceled in Medusa are
  reported (R3); shipments under an earlier BC order number after a force resend are ignored (R2).
- Q16 Start point → no back-fill; start at go-live (R4).
- Q17 Order confirmations later → not at the moment; no separate epic now.

## Superseded: order confirmations (2026-10-15 to 2026-10-19)

Until 2026-10-19 this epic was scoped as order confirmations, read from Business Central's sales
order archive (`salesOrderArchives` / `salesOrderArchiveLines`, standard API v2.0: BC archives a
version of the sales order each time its confirmation is printed or sent; confirmed on TestDK data,
excerpt kept in `samples/bc-sales-order-archive-metadata.xml`). The rules built on it (an order is
confirmed when an archive exists; highest version stored; one confirmation per order; 30-day polling
with backoff) and the answers Q2–Q5 no longer apply. Order confirmations are not wanted at the
moment (Q17); this material is the starting point if they come back.

## Open questions

No product-owner questions are open (last answers 2026-10-19).

For the planner (verify or decide):

- P1 **Matching shipment lines to the customer's lines, and finding the order.** A shipment line
  has the BC `sequence` and item number, not the customer's `lineNumber` or EAN. Options: keep the
  BC `sequence` returned by each line POST at submission (a small change in the NIMBUS-129 flow,
  not in BC), or match by posting order and item. Without a reliable match, `line_number` and
  `ean_no` are null and the customer matches on item and `bc_line_number`. Also decide how a
  shipment's `orderNumber` finds the API order without metadata filtering: store `bc_order_number`
  in `orderIngestion` when the BC outcome is recorded, or look up by `customerNumber` +
  `externalDocumentNumber` → `order_external_reference` and then confirm R2 against the order's
  metadata.
- P3 **Production data.** Before go-live, read a few posted shipments of API orders in production
  (read-only) and confirm `orderNumber` and `externalDocumentNumber` are set, and that `number` is
  what Metz sees as `DocumentNo`.
- P6 **Business Central timestamps.** Undo Shipment not moving the header's
  `lastModifiedDateTime` is shown by one TestDK case (Facts); confirm on a fresh undo in TestDK if
  possible. Still open: how late a posting can become visible after its timestamp (sizes the
  overlap).
- P8 **Netting undo corrections.** The API does not expose BC's "Correction" flag or which line a
  correction belongs to. All five TestDK cases put the correction directly after the original
  (sequence + 5000, same item, opposite quantity). Confirm the pairing rule in R6, including two
  lines with the same item number (the Metz sample has three).
- Observation for NIMBUS-129 (not this epic): the sample has three EANs on one item number, while
  order submission resolves an EAN through the item's single `gtin`. If Metz orders by variant EANs
  (item references), submission may not find those items. Worth checking against Metz's ORDERS
  files.
- Note (not a blocker): whether production stays on the Medusa Cloud Develop plan is not answered;
  this epic is unaffected either way.

## Dependencies

- NIMBUS-129 order flow deployed (NIMBUS-144/147/148/149: orders created and sent to BC with
  `bc_order_number`); NIMBUS-145/146 APIM and Logic App deployed (2026-10-15).
- Business Central test environment (TestDK) with posted shipments of API orders (to be created for
  testing: post a shipment of an API-submitted test order, and undo one).
- Azure environment owner for the APIM operation and the new Logic App workflow.
- NIMBUS-179 (not a blocker): makes the default lock provider cross-instance
  (`locking-postgres`). NIMBUS-130 is correct without it (counter row + unique BC shipment id and
  revision); until it ships, concurrent workers may only duplicate Business Central reads.
