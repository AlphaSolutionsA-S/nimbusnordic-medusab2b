# 01: BC adapter reads shipment line variant codes
**App:** backend · **Layer:** L2 infra adapter · **Depends on:** None

**Goal:** A new BC module service read returns `TRCShipmentLine` rows (shipment number, line number, variant code) for given shipment numbers, with the same transport guarantees as the existing shipment reads.
**Files / areas:** `src/modules/business-central/{shipment-reads.ts,service.ts,types.ts}`; tests in `src/modules/business-central/__tests__/shipment-reads.unit.spec.ts`
**Seam contracts:** on `IBusinessCentralModuleService`: `getShipmentLineVariants(numbers: readonly string[], deadlineMs?: number): Promise<BCShipmentLineVariant[]>`, with `BCShipmentLineVariant = { shipmentNumber: string; lineNumber: number; variantCode: string | null }` (trimmed, empty → null). Throws `ShipmentReadDeadlineError`, `BusinessCentralThrottledError` (429/503, also on the company-name read) or a `MedusaError` with no BC response text. Unknown numbers return no rows; no missing-row rule here.
**Test intent:** (module tests with fetch mocked, shaped like the TestDK probe)
- 45 numbers → 3 GETs to `/ODataV4/TRCShipmentLine` of at most 20 `documentNumber eq '…'` terms joined by `or`; quote escaped; `$select` exactly `documentNumber,lineNo,variantCode`; `company` parameter carries the company name.
- Rows map to the seam type: `"M"` → `"M"`, `""` → null, `" L "` → `"L"`; a non-numeric `lineNo` or missing `documentNumber` throws.
- Next links are followed to the end on the BC origin; a foreign next link is refused and never requested; a failing later page throws (no partial result).
- 429 and 503 on the variant read and on the company-name read → throttling error with Retry-After; 400 → non-throttling error; every request has the 20 s timeout; no request starts past the deadline.
- The company name is read once while the shipment-read token is valid and again after renewal; the same token is used for v2.0 and ODataV4 reads.
- Empty number list → no request.
**Done when:** the new read and its helpers pass the tests above; existing shipment-read tests still pass; lint and typecheck at or below baseline.
**Also update:** `src/modules/business-central/__tests__/shipment-reads.unit.spec.ts` (its fetch mock rejects unknown paths: extend it for the ODataV4 and company paths). Docs: task 04.

## Deviations

- Added: a row whose `variantCode` is missing or not a string throws (malformed row). It is not mapped to null. Why: BC sends `""` for "no variant" (probe output), and plan section 7 says a missing size is never guessed.
- Shape: the company-name read uses the shipment request path (`getShipmentJson`, `{discovery}/companies({id})`, the same URL as the existing `getCompanyName`). As a result its errors say "Business Central shipment request …", and it also sends the harmless `Prefer: odata.maxpagesize` header. Why: this one path already gives the timeout, deadline, throttling and no-BC-text guarantees.
- Shape: `getShipmentJson` and `getAllShipmentPages` are now generic over the row type. Existing callers are unchanged and their tests still pass. Why: the variant read follows next links through the same origin-pinned path.
- Shape: when BC's token response has no `expires_in`, neither the token nor the company name is cached, so each call reads the company name again. Why: the name lives with the cached token, and the token rule for that case is unchanged.
- Added test cases: a quote in the company name is escaped; a 400 on the company-name read gives a non-throttling error without BC text; deadline cases with a cached token and after the company-name read.

## Done-when evidence

- New read: 45 numbers → 3 GETs, at most 20 `or` terms, exact `$select`, `company` parameter: `shipment-reads.unit.spec.ts` › getShipmentLineVariants › "reads 45 numbers in 3 OR-filtered GETs of only documentNumber, lineNo and variantCode".
- Quote escaped: › "escapes a quote in a shipment number and in the company name".
- Row mapping `"M"`/`""`/`" L "`, unknown numbers return no rows: › "maps rows to shipment number, line number and a trimmed variant code, empty as null".
- Non-numeric `lineNo` or missing `documentNumber` throws: › "throws on a non-numeric lineNo", "throws on a missing documentNumber" (and "throws on a missing variantCode").
- Next links followed to the end: › "follows next links on the Business Central origin to the end"; foreign link refused and never requested: › "refuses a next link away from Business Central and never requests it"; later page fails: › "throws when a later page fails instead of returning a partial result".
- 429/503 on the variant read and the company-name read → throttling error with Retry-After: › "throws a throttling error on …" (4 cases); 400 → non-throttling error without BC text: › "throws a non-throttling error without BC response text on a 400 from the variants/company read".
- 20 s timeout on every request: › "gives the token, company-name and variant requests a 20-second timeout", "throws when the variant request times out".
- No request past the deadline: › "starts no request when the deadline has passed", "starts no company-name or variant request past the deadline with a cached token", "starts no variant request when the company-name read ends past the deadline", "does not start another chunk after the deadline".
- Company name read once per token and again after renewal, same token for v2.0 and ODataV4: › "reads the company name once per shipment-read token and uses that token for every read".
- Empty list → no request: › "makes no request for an empty list".
- Existing shipment-read tests still pass: the same spec file, 27 existing cases pass (50/50 in total).
- Lint: `pnpm --filter @b2b-starter/backend lint` gives 0 errors (13 warnings, none in business-central). Typecheck: 22 errors, the same as the baseline (no new errors).
- Also update: `shipment-reads.unit.spec.ts`. Its fetch mock now takes optional `variants`, `company` and `token` handlers. The company path has a default handler (`{ name: "Nimbus Nordic A/S" }`), and `BUSINESS_CENTRAL_COMPANY_ID` is set in `beforeEach`. Unknown paths are still rejected. Docs: task 04 (no change here).
