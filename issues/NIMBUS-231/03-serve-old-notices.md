# 03: Serve notices stored before the release with a null size
**App:** backend · **Layer:** L1 types (`orderIngestion`), L5 page fn · **Depends on:** 02

**Goal:** A notice line stored without `variant_code` is served with `variant_code: null`, never with the key missing; stored rows are not changed.
**Files / areas:** `src/modules/order-ingestion/shipment-notice-storage.ts` (row type), `src/workflows/shipment-notice/utils/shipment-notice-page.ts`; tests in `src/workflows/shipment-notice/__tests__/shipment-notice-page.unit.spec.ts`, `integration-tests/http/orderapi/shipment-notices.spec.ts`
**Seam contracts:** `ShipmentNoticeRow.payload` is typed as stored (lines may lack `variant_code`); the write input (`StoreShipmentNoticeInput.payload`) stays the strict wire payload, so new rows always carry it. No cast (`NO_UNKNOWN_CAST`).
**Test intent:**
- Unit: a row whose lines lack the key → every line has `variant_code: null`, other fields unchanged; a row with `"M"` and null → served as stored.
- Contract (HTTP, finalization): extend "returns every notice and line field with the type the customer reads" to assert `variant_code` is a string or null on each line; add a notice seeded in the pre-release shape (key removed in the database after storing, not by a cast) and assert the response line has `variant_code: null` and validates against `ShipmentNoticeEnvelopeSchema`.
**Done when:** the cases above pass; lint and typecheck at or below baseline.
**Verify after deploy:** `GET /orderapi/shipment-notices` in TestDK for a company with notices recorded before the release: those notices' lines show `variant_code: null` (JSON) and no `<variant_code>` (XML).
**Also update:** `integration-tests/http/orderapi/shipment-notices.spec.ts`; `src/workflows/shipment-notice/__tests__/shipment-notice-page.unit.spec.ts`. Docs: task 04.
