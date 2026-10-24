# Branch notes: NIMBUS-231

## Task 01 (BC variant read)

- `IBusinessCentralModuleService.getShipmentLineVariants(numbers, deadlineMs?)` returns `BCShipmentLineVariant[]`
  (`types.ts`: `{ shipmentNumber, lineNumber, variantCode: string | null }`). The rows come in BC order, with no
  dedup and no missing-row rule. Empty or blank numbers make no request.
- It throws the same errors as `getShipmentsByNumbers`: `ShipmentReadDeadlineError` (by `name`),
  `BusinessCentralThrottledError` (`shipment-reads.ts`, 429/503, also on the company-name read) or a
  `MedusaError` (status, timeout "did not complete", malformed row, foreign nextLink).
- Request count per call: one company-name GET per shipment-read token lifetime (cached on
  `shipmentReadToken.companyName`), then one GET per 20 numbers plus any next pages. The token is shared
  with the v2.0 shipment reads.
- Helpers in `shipment-reads.ts`: `SHIPMENT_LINE_VARIANT_ENTITY_SET`, `SHIPMENT_LINE_VARIANT_FIELDS`,
  `buildShipmentLineVariantFilter`, `buildODataCompanyParameter`, `mapShipmentLineVariant`.
- Test mock: in `shipment-reads.unit.spec.ts`, `mockBc(handleShipments, { variants?, company?, token? })`
  rejects any path it has no handler for. Integration specs that spy on `getShipmentsByNumbers` must
  also stub `getShipmentLineVariants`, or they will call TestDK (plan section 10).
- Pitfall: the company-name read needs `BUSINESS_CENTRAL_COMPANY_ID` (a GUID) in the environment. Without
  it the read throws `INVALID_DATA` before any request.

## Task 02 (size on notice lines)

- Wire line: `ShipmentNoticeLineSchema.variant_code: z.string().nullable()` (required key, after `item_number`); `ShipmentNoticePayloadSchema` derives from it, so it also requires the key. Task 03 must loosen the stored-row type, not the wire schema.
- Fixture `shipmentNoticeEnvelopeExample`: line NN-1001 has `variant_code: "M"`, NN-2040 `null`, in both notices.
- `decideShipmentNotice` input gains `variants: readonly BCShipmentLineVariant[]` (whole batch is fine; it filters by `shipment.number`). New outcome `{ kind: "variant_missing"; sequence }`, checked before netting.
- Content hash is unchanged; golden for the spec's fixed shipment: `c4d492f8899f43b710c92a1ddd3e5aa15fc682578c8a2c3a00362bc02409920d`.
- `ShipmentCheckErrorCode` gains `variant_missing`; the warn line is `... failed: variant_missing at BC line <n>`.
- The step reads `getShipmentLineVariants(numbers, deadline)` right after `getShipmentsByNumbers` in the same try, so deadline/throttle/other errors behave exactly as for the shipment read.
- Integration specs: `check-shipments.spec.ts` has `inBc(tracked, lines, sizes?)` and a `getShipmentLineVariants` spy built from `bcShipments`; any new spec that spies on `getShipmentsByNumbers` must stub the variant read too.

## Task 03 (serve old notices)

- `shipment-notice-storage.ts` exports `StoredShipmentNoticeLine` (`variant_code?: string | null`) and `StoredShipmentNoticePayload`; `ShipmentNoticeRow.payload` uses it. `StoreShipmentNoticeInput.payload` is still the strict `ShipmentNoticePayload`.
- `toShipmentNotice` in `shipment-notice-page.ts` fills `variant_code: line.variant_code ?? null`; the envelope it returns always carries the key.
- `payload` is `jsonb`: stored key order is not the wire order, so docs and examples (task 04) should not promise JSON key order.
- `shipment-notices.spec.ts` uses `dbConnection.raw` (from `medusaIntegrationTestRunner`'s `testSuite` args, typed `any`) to strip the key, and has a test "serves a line stored before the size existed...". Not run yet; runs at finalization.
