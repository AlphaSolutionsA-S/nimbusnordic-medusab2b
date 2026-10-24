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

## Deviations

- The unit case "a row with `"M"` and null → served as stored" passed before the change: it guards against the fill overwriting a stored value, which the old code could not do. Kept as a regression guard.
- Added to the unit test: the input row is not mutated (pure builder, stored rows unchanged). Added to the HTTP test: the stored row still lacks the key after the read.
- The HTTP spec reads and changes `shipment_notice` with `dbConnection.raw` from `medusaIntegrationTestRunner` (test-only SQL, the plan's "key removed in the database"); no other spec in the repo does raw SQL yet.
- An old line gets `variant_code` appended after its other keys; key order is not part of the contract (the payload is `jsonb`, which reorders keys anyway, and XML omits a null field).
- The HTTP spec was not run in this task: per the manifest integration tests run at finalization (local Postgres). Its types are checked by the whole-app typecheck.

## Done-when evidence

- Old row lines lack the key → every line `variant_code: null`, other fields unchanged: `shipment-notice-page.unit.spec.ts` "serves lines stored without variant_code with variant_code null, other fields and the row unchanged" (also validates against `ShipmentNoticeEnvelopeSchema`).
- Row with `"M"` and null → served as stored: same file, "serves stored variant codes as stored, a size and a null alike".
- Stored rows not changed: the unit test asserts the input row's lines still lack the key; the HTTP test reads the row back from the database. No migration.
- `ShipmentNoticeRow.payload` typed as stored, write input strict, no cast: `StoredShipmentNoticePayload` in `shipment-notice-storage.ts`; `StoreShipmentNoticeInput.payload` still `ShipmentNoticePayload`; the fill uses `?? null`, no cast; typecheck at baseline.
- Contract (HTTP): `integration-tests/http/orderapi/shipment-notices.spec.ts` "returns every notice and line field with the type the customer reads" (variant code string or null on every line) and "serves a line stored before the size existed with variant_code null and leaves the row as stored": not run in this task, runs at finalization.
- Lint: PASS (0 errors; 13 warnings, none in touched files). Typecheck: 22 errors, baseline 22, same set.
- Also update: `shipment-notices.spec.ts` extended as above; `shipment-notice-page.unit.spec.ts` gains two cases. Docs: task 04.
