# Business Central probe: item lookup call shapes (TestDK, planner)

Run by the implementation-planner on 2026-10-23 with the backend's own TestDK credentials
(`apps/backend/.env`), GET requests only. URLs shown with the tenant and company name removed.

## Call shape

| # | Request | Result |
|---|---|---|
| 1 | `ODataV4/ItemReferenceEntries?company='<name>'&$filter=Reference_No eq '5712094132141'` (the exact shape `getODataV4Url` builds: `company` set with `searchParams.set`, value in single quotes, quotes doubled) | 200, 3 rows |
| 2 | same with `$select=Item_No,Variant_Code,Unit_of_Measure,Reference_Type,Reference_No` | 200 |
| 3 | same, three barcodes joined with `or` | 200, all rows for all three |
| 4 | `(Reference_No eq 'a' or Reference_No eq 'b') and Reference_Type eq 'Bar Code'` | 200, Bar Code rows only |
| 5 | `Reference_Type eq 'Bar_x0020_Code'` | 400: options are `" "`, `Customer`, `Vendor`, `Bar Code` |
| 6 | unknown barcode `0000000000000` | 200, `[]` |
| 7 | `api/v2.0/items()?$filter=number eq 'A' or number eq 'B' or number eq 'C'&$expand=itemVariants($select=id,code)` (same base as today's item lookup) | 200, each item with its variants |
| 8 | `api/v2.0/itemVariants?$filter=itemNumber eq 'HEND-L-MIDNBLUE' and code eq 'L'` | 200, id `a019dfc8-…` (matches Klaus's sample) |
| 9 | `items()?$filter=number eq 'FLS-NIM-VESPERMNA-XL' or number eq 'NKT-NIM-TELLURIDENA-S'` | 400: `No.` is at most 20 characters; `NKT-NIM-TELLURIDENA-S` is 21 |

Wire values: `Reference_Type` is the literal `"Bar Code"`; the blank type is `" "` (one space).
`Unit_of_Measure` and `Variant_Code` are `""` when empty.

## Data observations (TestDK)

- `items()?$filter=gtin ne ''` returns no rows: no TestDK item has an item-card barcode.
- The Metz sample barcodes are Item Reference size barcodes, not item-card barcodes:
  `5712094145752` → `VESP-M-NAVY` variant `XL`; `5712094143628` → `TELL-U-NAVY` variant `S`. Both
  items have sizes (7 and 9 variants), empty `gtin`, base unit `PCS`.
- No "Bar Code" row is held for a unit other than empty or `PCS`.
- "Bar Code" rows with an empty variant exist (e.g. `LONG-U-GREYMEL`, `POS LOGO SIGN-BLACK`).
- Every HEND-L-MIDNBLUE barcode has the three rows Klaus recorded (Bar Code/empty unit, Bar Code/PCS,
  blank type/PCS).
