# TRCShipmentLine paging probe: output (TestDK)

Run by Klaus Petersen on 2026-10-24 from the repo root with
`node issues/NIMBUS-231/samples/probe-trc-paging.mjs apps/backend/.env` (read-only, TestDK only).
The tenant id is redacted by the script.

```
1 status 200 rows 3 preference-applied odata.maxpagesize
1 nextLink https://api.businesscentral.dynamics.com/v2.0/<tenant>/TestDK/ODataV4/TRCShipmentLine?company=%27Nimbus%20Nordic%20A%2FS%27&$filter=documentNumber%20eq%20%2730947954%27%20or%20documentNumber%20eq%20%2730947937%27&$select=documentNumber%2ClineNo%2CvariantCode&aid=FIN&$skiptoken='30947937',20000
1 nextLink origin equals request origin: true
1b status 200 rows 3 has next true
2 status 200 rows 0
3 status 200 [["string","number","\"S\""],["string","number","\"S\""],["string","number","\"M\""],["string","number","\"M\""],["string","number","\"L\""],["string","number","\"L\""],["string","number","\"XL\""],["string","number","\"XL\""],["string","number","\"2XL\""],["string","number","\"2XL\""],["string","number","\"\""],["string","number","\"\""]]
```

Results:

- The next link stays on the request's origin (`https://api.businesscentral.dynamics.com`), keeps
  `company`, `$filter` and `$select`, and adds `aid=FIN` and a `$skiptoken`; following it returns
  the next page. Plan section 9 row 4 is verified.
- An unknown shipment number returns 200 with no rows.
- `documentNumber` is a string and `lineNo` a number; an item without sizes has `variantCode` `""`
  (empty string, not null), which the plan maps to null.
