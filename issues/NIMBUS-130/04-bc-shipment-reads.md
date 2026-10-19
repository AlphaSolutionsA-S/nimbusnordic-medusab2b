# 04: Business Central shipment reads
**App:** backend · **Layer:** L2 (focused file beside the BC service, exposed through it) · **Depends on:** None

**Goal:** Three reads of posted sales shipments (a count, a complete windowed header read, and full
shipments by number), with typed records, timeouts and a typed throttling error. No domain rule.
**Files / areas:** `apps/backend/src/modules/business-central/` (new file beside `return-history.ts`
for mapping and types; public methods on the service; `types.ts`).
**Seam contracts:**
- **count:** `{ after: Date, until: Date }` → number of headers with `lastModifiedDateTime` in
  (after, until].
- **window:** same input → every header in the window, ascending:
  - fields `{ id, number, orderNumber, externalDocumentNumber, customerNumber, postingDate,
    lastModifiedDateTime }`;
  - read with `Prefer: odata.maxpagesize=200`, following `@odata.nextLink` to the end;
  - a single-timestamp window (`after` = `until` − 1 ms) is valid.
- **by numbers:** `string[]` → full shipments (the contract's header fields plus
  `lastModifiedDateTime`) with lines `{ sequence, lineType, itemNumber, description, description2,
  unitOfMeasureCode, quantity, shipmentDate }`:
  - batches of 20 with an OR filter, values OData-escaped;
  - unknown numbers are simply absent.
- `lineType` is decoded to `item` | `comment` | `other` from the wire values `Item`, `_x0020_` and
  anything else (e.g. `G_x002F_L_x0020_Account`). Dates are `YYYY-MM-DD`; empty strings become null.
- Requests time out after 20 s. HTTP 429/503 throw a typed throttling error carrying `Retry-After`
  seconds; other failures throw.
- One OAuth token is reused until 5 minutes before expiry, by these methods only.
**Test intent (unit, mocked fetch):**
- Count and window filters are sent as specified.
- A three-page `nextLink` chain → all rows returned once; a missing page (non-OK) throws (F2).
- 45 numbers → 3 requests; a quote in a number is escaped.
- Expanded lines in any order are returned as given (task 05 sorts).
- 429 with `Retry-After` → throttling error with the seconds; a timeout throws.
- Two calls within the token lifetime → one token request; after expiry → a new one.
- Each `lineType` wire value and empty strings map as specified.
**Done when:** methods exposed on the service interface; tests written; lint and typecheck at or below
the baseline.
**Also update:** none found.

## Deviations

- Added: BC's empty date `0001-01-01` also maps to null (as the existing adapter's `optionalDate` does);
  BC sends it on lines that never had a date.
- Added: an `@odata.nextLink` whose origin is not the configured BC origin throws before any request,
  so the bearer token is never sent elsewhere (test "refuses a nextLink that points away").
- Shape: `lastModifiedDateTime` is kept as BC's ISO string, not a `Date`, so BC's precision is not
  truncated; the window input stays `Date`.
- Shape: `BusinessCentralThrottledError.retryAfterSeconds` is `number | null` (null when the header is
  missing or unreadable); an HTTP-date `Retry-After` is converted to seconds. The class lives in
  `shipment-reads.ts`, not `service.ts`, so steps and decision code can import it without importing
  the service.
- Shape: the full shipment adds `shipmentMethodCode`, `yourReference` (`customerPurchaseOrderReference`),
  `sellTo`, `billTo`, `shipTo` to the header fields. `$select` reads only these fields, so prices,
  salesperson, phone and e-mail are never fetched.
- Count uses `$count=true&$top=1&$select=id` (the form `listOrders` already uses), not the `/$count`
  path; no new TestDK probe was run (the test intent is mocked fetch; plan probes 7–9 cover `$count`
  with a filter and `$expand` lines).
- Added: the token request of these methods also gets the 20 s timeout; a token response without
  `expires_in` is used for that call only, not cached.
- Added: by-numbers drops duplicate and empty numbers before batching, sends batches one at a time and
  follows `nextLink` too. An empty list makes no request.
- Not a code change: the existing `service.spec.ts` case "stops filling from salesInvoices after the
  round-trip guardrail" fails with and without this change (checked against HEAD's `service.ts`); it
  is the baseline's failing BC module test.

## Done-when evidence

- Methods on the service interface: `countShipments`, `listShipmentHeaders`, `getShipmentsByNumbers`
  in `IBusinessCentralModuleService` (`types.ts`), implemented in `service.ts`; typecheck 22 errors
  (baseline 22, all in `integration-tests/`).
- Count and window filters: `shipment-reads.unit.spec.ts` "counts headers modified in (after, until]…",
  "reads the window ascending with a page-size preference…", "accepts a single-timestamp window".
- Three-page `nextLink` chain / missing page throws (F2): "follows a three-page nextLink chain…",
  "throws when a later page fails instead of returning a partial window".
- 45 numbers → 3 requests; quote escaped: "reads 45 numbers in 3 OR-filtered requests of at most 20",
  "escapes a quote in a shipment number".
- Lines returned as given; unknown numbers absent: "expands lines and returns the full shipment…".
- 429 with `Retry-After`; timeout: "throws a throttling error carrying Retry-After seconds on 429",
  "throws a throttling error on 503…", "reads Retry-After given as an HTTP date", "gives every request
  a 20-second timeout and throws when it fires", "throws a non-throttling error on other failures".
- Token reuse and renewal: "reuses one token within its lifetime and requests a new one 5 minutes
  before expiry".
- `lineType` and empty strings: "decodes each line type and maps empty strings and empty BC dates to
  null", "maps header fields, turning empty strings into null".
- Tests written: 19 passing (`pnpm --filter @b2b-starter/backend test:unit -- src/modules/business-central/__tests__/shipment-reads.unit.spec.ts`).
- Lint: 0 errors (13 pre-existing warnings, none in changed files). Typecheck: 22, baseline 22.
- Also update: none found (no existing test, doc or `ai/` file describes shipment reads).
