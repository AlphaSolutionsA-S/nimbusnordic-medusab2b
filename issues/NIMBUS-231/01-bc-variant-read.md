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
