# Business Central probe: variant code on posted shipment lines (TestDK)

Run by the scoper on 2026-10-24 (sections 1–4, then 5–6 in a second run) with the backend's local credentials (`apps/backend/.env`, which
targets TestDK) from a throwaway Node script: one OAuth client-credentials token request, then GET
requests only. No writes. Tenant and company GUIDs removed; `<env>` is
`https://api.businesscentral.dynamics.com/v2.0/<tenant>/TestDK`. The ODataV4 calls use the backend
helper's form, `?company='Nimbus Nordic A/S'` (URL-encoded), and it worked.

## 1. The current read (API v2.0) cannot select a variant

`GET <env>/api/v2.0/companies(<company>)/salesShipments?$top=1&$select=number&$expand=salesShipmentLines($select=sequence,itemVariantId)`

```
400 BadRequest: Could not find a property named 'itemVariantId' on type 'Microsoft.NAV.salesShipmentLine'.
```

Matches the v2.0 `$metadata` (`issues/NIMBUS-130/samples/bc-sales-shipment-metadata.xml`):
`salesShipmentLine` has `sequence, lineType, lineObjectNumber, description, description2,
unitOfMeasureCode, unitPrice, quantity, discountPercent, taxPercent, shipmentDate` and no variant.
v2.0 `itemLedgerEntry` has no variant either.

## 2. Published ODataV4 web services about shipments

`GET <env>/ODataV4/?company='Nimbus Nordic A/S'`, names matching ship/shpt:

`Bogført_købsleverance_Excel`, `Bogført_købsleverance_ExcelPurchReceiptLines`,
`Bogført_købsleverance_ExcelSCB_Waybill_line`, `TRCCreateShipment`, `TRCCreateShipToAddress`,
`TRCCreateTransferShip`, `TRCPostedWhseShipLine`, `TRCPostWhseShip`, `TRCShipment`,
`TRCShipmentLine`, `TRCShipmentList`, `TRCShiptoAddress`, `TRCTransferShipment943`,
`TRCTransferShipmentList`, `TRCTransferShipmentTo943Line`, `TRCWhseShipment`,
`TRCWhseShipmentLine`, `TRCWhseShipmentList`.

No standard "posted sales shipment lines" web service is published. `TRCShipmentLine` (a
third-party extension's service; key `documentNumber, lineNo`) has `variantCode` (Edm.String, 10),
per `issues/NIMBUS-138/orderreturncreate metadata.xml` and the live response below.

## 3. `TRCShipmentLine` returns the variant code

`GET <env>/ODataV4/TRCShipmentLine?company=...&$filter=variantCode ne ''&$select=documentNumber,lineNo,Type,number,variantCode,unitofMeasure,quantity,shipmentDate&$top=5&$orderby=documentNumber desc` → 200

| documentNumber | lineNo | Type | number | variantCode | unitofMeasure | quantity |
|---|---|---|---|---|---|---|
| 30947954 | 10000 | Item | ABIN-L-BLACK | M | Pieces | 0 |
| 30947954 | 30000 | Item | ABIN-L-BLACK | M | Pieces | 0 |
| 30947953 | 10000 | Item | ABIN-L-BLACK | M | Pieces | 10 |
| 30947953 | 30000 | Item | ABIN-L-BLACK | M | Pieces | 0 |
| 30947952 | 10000 | Item | CDEN-M-MIDNBLUE | L | Pieces | 1 |

Lines for item `HEND-L-MIDNBLUE` (the NIMBUS-180 size item) carry `L`, `M`, `XL`, `S` on different
shipments, e.g. 30900470 lines 70000/80000/90000 = M/L/XL. `shipmentDate` is `2099-01-01` on every
row seen; `unitofMeasure` is the unit's description ("Pieces"), not its code ("PCS").

## 4. The two reads join on shipment number + line number

Shipment 30947954 through both services:

| v2.0 `sequence` | v2.0 `lineObjectNumber` | v2.0 `unitOfMeasureCode` | v2.0 `quantity` | TRC `lineNo` | TRC `number` | TRC `variantCode` | TRC `quantity` |
|---|---|---|---|---|---|---|---|
| 10000 | ABIN-L-BLACK | PCS | 0 | 10000 | ABIN-L-BLACK | M | 0 |
| 20000 | F2-FF | PCS | 1 | 20000 | F2-FF | (empty) | 1 |
| 30000 | ABIN-L-BLACK | PCS | 0 | 30000 | ABIN-L-BLACK | M | 0 |
| 40000 | F2-FF | PCS | 0 | 40000 | F2-FF | (empty) | 0 |

`documentNumber` = v2.0 shipment `number`, `lineNo` = v2.0 `sequence` (= `bc_line_number` in the
notice); item and quantity agree. An item without sizes has an empty `variantCode`.

## 5. Undo corrections carry the variant of the line they undo (second run, same day)

`GET <env>/ODataV4/TRCShipmentLine?company=...&$filter=quantity lt 0 and variantCode ne ''&$select=documentNumber,lineNo,Type,number,variantCode,quantity&$top=10&$orderby=documentNumber desc`
→ 200, 10 negative lines with a variant. Full lines of three of those shipments, compared with v2.0:

| Shipment | Pairs (line → correction: item, variant, quantity) | v2.0 agrees on line numbers, items, quantities |
|---|---|---|
| 30947937 | 10000→15000 HUDS-M-BLACK M 1/−1; 20000→25000 MTAU-M-WHITE L 2/−2; 30000→35000 MTAU-L-BLACK M 2/−2; 40000→50000 F2 (no variant) 1/−1 | yes |
| 30947879 | 20000→25000 S, 30000→35000 M, 40000→45000 L, 50000→55000 XL, 60000→65000 2XL (all YOSE-M-BLACK, 1/−1); 70000→80000 F2 (no variant) | yes |
| 30947826 | 80000→85000 CDEN-L-MIDNBLUE XL 1/−1; lines 10000–40000 CDEN-M-MIDNBLUE S/M/L/XL and 90000 F2+ unpaired | yes |

Every correction row has the same variant code as the line it undoes (12 pairs). 30947879 shows why
the variant matters for pairing: one item in five sizes, each size undone separately.

## 6. Or-filter over 20 shipment numbers and paging

- `$filter` of 20 `documentNumber eq '…'` terms joined by `or` (the existing detail read's chunk
  size; URL 922 characters) → 200, 84 rows covering all 20 shipments, no next link.
- The same request with `Prefer: odata.maxpagesize=5` → 5 rows and an `@odata.nextLink`.
- Unfiltered `$top=25000` → 20000 rows and an `@odata.nextLink`: BC's ODataV4 page limit here is
  20000 rows, far above 20 shipments' lines, but a reader must follow or refuse next links
  explicitly.

## Not checked

- Throttling behaviour of `TRCShipmentLine` (expected to be BC's usual 429/503; not provoked).
- Who owns the TRC extension and whether its web services are a stable interface.

Production availability is verified separately by Klaus (`bc-shipment-line-variant-production.md`).

The 2000 most recent `TRCShipmentLine` rows all had purely numeric document numbers (no prefix),
consistent with it holding posted sales shipment lines only.
