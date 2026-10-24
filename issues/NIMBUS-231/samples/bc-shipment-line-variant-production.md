# Business Central probe: TRCShipmentLine in production

Run by Klaus Petersen on 2026-10-24 against the production environment (`ProductionDK`). Read-only.

Query:

```
GET https://api.businesscentral.dynamics.com/v2.0/<tenant>/ProductionDK/ODataV4/TRCShipmentLine?company='Nimbus%20Nordic%20A%2FS'&$top=1&$select=documentNumber,lineNo,variantCode
```

Response (etag removed):

```json
{
  "@odata.context": "https://api.businesscentral.dynamics.com/v2.0/ProductionDK/ODataV4/$metadata#TRCShipmentLine",
  "value": [
    { "documentNumber": "30900001", "lineNo": 10000, "variantCode": "L" }
  ]
}
```

Result: the `TRCShipmentLine` web service is published in production with `documentNumber`, `lineNo`
and `variantCode`, the same fields as in TestDK, and the `company` parameter in this form works.
