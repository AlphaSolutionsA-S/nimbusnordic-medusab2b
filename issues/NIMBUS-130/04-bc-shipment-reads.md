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
