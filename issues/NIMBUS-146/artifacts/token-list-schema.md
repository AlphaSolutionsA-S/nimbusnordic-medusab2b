# NIMBUS-146 — Token List Store Schema (GlobalLists)

## Store identity

- **GlobalLists API URL:** the `globalListsApiUrl` parameter (set in the Logic App's `parameters.json`).
- **Auth for reading this list:** the `struct-api-key` parameter, sent as the `authorization` header.

This is a dedicated list for this project, not the unrelated product-feed example list.

## Response shape (as deployed, 2026-10-15)

`Get_Token_List` returns an envelope, and the entries are in `GlobalListValues`. Each entry's
`Value` is an object holding the customer's token and Business Central customer number:

```json
{
  "Total": 2,
  "Remaining": 0,
  "LastId": "…",
  "GlobalListValues": [
    {
      "Created": "…", "CreatedBy": "…", "LastModified": "…", "LastModifiedBy": "…",
      "GlobalListUid": "…", "Uid": "…", "SortOrder": 1,
      "Value": { "apikey": "a1b2c3d4e5f6", "bccustomernumber": "579000283084" }
    }
  ]
}
```

| `Value` field | Meaning |
|---|---|
| `apikey` | The customer's token: the `{token}` path segment of `POST …/orders/{token}`. Matched exactly (case-sensitive). |
| `bccustomernumber` | The Business Central customer number forwarded to Medusa as `?customerNumber=`. Must match a Medusa company's `business_central_customer_number`. |

An entry whose `apikey` matches but whose `bccustomernumber` is missing, null or empty is rejected
with `401 {"error":"Not allowed"}` and is never forwarded to Medusa. An unknown token gets
`401 {"error":"Token not recognized"}`.

## Populating the list

- [ ] One entry per authorized customer token, with `apikey` and `bccustomernumber` both set.
- [ ] Tokens are unique across entries. If two entries share an `apikey`, the first one is used.
- [ ] Tokens use URL-safe characters only, so the path segment arrives exactly as stored.
