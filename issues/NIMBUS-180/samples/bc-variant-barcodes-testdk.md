# Business Central probe: size barcodes for HEND-L-MIDNBLUE (TestDK)

Run by Klaus Petersen on 2026-10-23 against
`https://api.businesscentral.dynamics.com/v2.0/f44eef10-122f-4a63-9f5c-bd9fbd87a364/TestDK`. Read-only.

## Queries

1. `ODataV4/ItemReferenceEntries?$filter=Reference_No eq '5712094132141'`
2. `ODataV4/ItemReferenceEntries?$filter=Item_No eq 'HEND-L-MIDNBLUE'`
3. `api/v2.0/companies(ad96ec81-7f92-ee11-8178-000d3ab9277c)/items?$filter=number eq 'HEND-L-MIDNBLUE'&$expand=itemVariants`

The ODataV4 queries failed with the `?company='…'` parameter as Klaus first wrote it and worked
without it. The exact error was not recorded; the backend's ODataV4 calls always add `company`.

## Item card (query 3)

| Field | Value |
|---|---|
| id | `d22247f7-005e-ee11-8def-0022489bc7be` |
| number | `HEND-L-MIDNBLUE` |
| displayName | Henderson Women - Midnight Blue |
| gtin | empty |
| baseUnitOfMeasureCode | `PCS` |

## Barcodes and variants (queries 2 and 3)

Each barcode has exactly three Item Reference rows, all for the same item and variant:
`Reference_Type` "Bar Code" with `Unit_of_Measure` empty, "Bar Code" with `PCS`, and `" "` (blank
type) with `PCS`. No barcode points to more than one item or variant.

| Reference_No (barcode) | Variant_Code | itemVariantId |
|---|---|---|
| 5712094132110 | XS | `a419dfc8-ab92-ee11-8178-0022489b54b1` |
| 5712094132127 | S | `a219dfc8-ab92-ee11-8178-0022489b54b1` |
| 5712094132134 | M | `a119dfc8-ab92-ee11-8178-0022489b54b1` |
| 5712094132141 | L | `a019dfc8-ab92-ee11-8178-0022489b54b1` |
| 5712094132158 | XL | `a319dfc8-ab92-ee11-8178-0022489b54b1` |
| 5712094132165 | 2XL | `9e19dfc8-ab92-ee11-8178-0022489b54b1` |
| 5712094132172 | 3XL | `9f19dfc8-ab92-ee11-8178-0022489b54b1` |

Despite the `-L-` in the item number, the item carries all seven sizes as variants.
