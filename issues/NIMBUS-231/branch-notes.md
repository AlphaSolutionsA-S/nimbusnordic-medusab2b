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
