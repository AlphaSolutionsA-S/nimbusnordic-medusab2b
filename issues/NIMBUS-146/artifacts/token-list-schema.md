# NIMBUS-146 — Token List Store Schema (GlobalLists Extension)

## Store identity

- **GlobalLists API base URL:** `<TBD - confirm with Azure environment owner; NOT the same list as the unrelated structpim.com product-feed example>`
- **List identifier:** `<TBD - confirm with Azure environment owner>`
- **Auth mechanism for reading this list:** `<TBD - confirm; likely a subscription key or similar, matching whatever the example Get_APIkeys action uses>`

This is a genuinely new, dedicated list for this project — not the same list as the unrelated product-feed example. It must be created (or an existing customer-token list repointed) in the real GlobalLists store before the workflow is deployed.

## Entry schema (primary design)

Each entry uses the example list's existing three fields, encoding the customer number into `Value` with a `::` delimiter:

| Field | Type | Meaning |
|---|---|---|
| `Uid` | string | Unique row identifier (unchanged from example) |
| `SortOrder` | number | Display/sort order (unchanged from example) |
| `Value` | string | `"<token>::<customerNumber>"` |

The customer-number portion is required and must not be empty. Two malformed shapes are rejected at runtime with `401 Not allowed`, and neither is ever forwarded to Medusa:

| Malformed `Value` | Why it is rejected |
|---|---|
| `"a1b2c3d4e5f6::"` | Delimiter present, customer number empty |
| `"a1b2c3d4e5f6"` | No `::` delimiter at all — the customer number was never encoded |

The second shape matters because it is what a row copied from the example list, or an operator forgetting the encoding, looks like. It still *matches* the token, so the workflow explicitly checks for the delimiter before extracting rather than taking the last `::`-separated part (which would otherwise resolve to the token itself).

## Sample entries

```json
[
  { "Uid": "1", "SortOrder": 1, "Value": "a1b2c3d4e5f6::579000283084" },
  { "Uid": "2", "SortOrder": 2, "Value": "f6e5d4c3b2a1::441122334455" }
]
```

## Fallback design

Use this only if the real GlobalLists list type supports custom properties:

```json
[
  { "Uid": "1", "SortOrder": 1, "Value": "a1b2c3d4e5f6", "CustomerNumber": "579000283084" }
]
```

If this fallback is selected, the workflow must match `Value` directly and read `CustomerNumber` directly; its Parse JSON schema must permit `CustomerNumber` as a string or null. Missing, null, and empty customer numbers remain unauthorized.

## Verification required before deployment

- [ ] Confirm the real GlobalLists API/list identity with the Azure environment owner and populate the store identity values above.
- [ ] Confirm whether the list supports a custom `CustomerNumber` property; otherwise use the primary delimiter encoding.
- [ ] Confirm real customer tokens never contain the `::` delimiter.
- [ ] Populate one entry per authorized customer token, resolving to the corresponding Business Central customer number.
- [ ] Confirm no entry has a null or empty customer number, and that every entry in the primary design actually contains the `::` delimiter.
