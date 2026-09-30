# NIMBUS-145 — Manual Test Payloads

**Manual testing required.** No automated APIM test infrastructure exists in this repo. Run these
cases against the deployed APIM operation from the Portal **Test** tab (with tracing) or from an
HTTP client.

- Replace `<APIM_ORDER_URL>` with `https://<apim-host>/<api-suffix>/orders`.
- The token `a1b2c3d4e5f6` matches NIMBUS-146's test data (`Value = "a1b2c3d4e5f6::579000283084"`).
  Replace it with a real seeded token.
- Add `Ocp-Apim-Subscription-Key` if the API requires a subscription.

**Downstream dependency:** the cases that expect `201` need NIMBUS-146's Logic App and
NIMBUS-129's `POST /orderapi/orders`, plus a Company with
`business_central_customer_number = "579000283084"`. Until those are deployed, check the APIM
layer alone in the trace: validation passed, the transformed body, and the backend URL.
**APIM-only cases** (the response comes from APIM, no downstream needed): TC-2, TC-4, TC-7,
TC-8, TC-9, TC-10, TC-11, TC-12, TC-16.

Every order payload follows the implemented canonical contract
(`apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`): dates are `DD-MM-YYYY`, a
line needs only `lineNumber`, `eanNo`, `quantity`, and `eanNo` is 13 digits.

The generic validation error body is:

```json
{"error":"Request validation failed","message":"The submitted payload does not conform to the canonical order contract."}
```

For every 4xx case, confirm the response does not echo the payload, the token, validation
internals, or backend details.

## TC-1: Valid JSON order (happy path)

```http
POST <APIM_ORDER_URL>/a1b2c3d4e5f6
Content-Type: application/json

{
  "externalOrderNumber": "NIMBUS145-TC1",
  "orderDate": "27-08-2026",
  "currencyCode": "DKK",
  "lines": [
    {
      "lineNumber": 1,
      "itemNumber": "FLS-NIM-VESPERMNA-XL",
      "custItemNo": "FLS-NIM-VESPERMNA-XL",
      "eanNo": "5712094145752",
      "description": "Vesper Vest Unisex, Navy - XL",
      "quantity": 1,
      "unitPrice": 134.75
    }
  ]
}
```

**Expect:** Medusa's `201` passed through unchanged, e.g. `{"order_id":"order_...","status":"pending"}`.
**Trace:** `validate-content` passes. The backend URL is
`<nimbus-order-logicapp-base-url>/orders/a1b2c3d4e5f6?api-version=…&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=…`.
The body is forwarded byte-for-byte unchanged.

## TC-2: JSON missing a required field

Send TC-1's body without `externalOrderNumber`.

**Expect:** `400` with the generic validation error body. There is no Logic App run.

## TC-3: Valid XML order, several lines, with address

Use a new `externalOrderNumber` for each run. Medusa rejects duplicates per company.

```http
POST <APIM_ORDER_URL>/a1b2c3d4e5f6
Content-Type: application/xml

<?xml version="1.0" encoding="UTF-8"?>
<canonicalOrder>
  <externalOrderNumber>NIMBUS145-TC3</externalOrderNumber>
  <orderDate>26-08-2026</orderDate>
  <currencyCode>DKK</currencyCode>
  <pricesIncludeTax>false</pricesIncludeTax>
  <shipTo>
    <name>JK Tryk</name>
    <contact>3. Parts Nimbus</contact>
    <addressLine1>Industrikrogen 11B</addressLine1>
    <city>Rønnede</city>
    <postCode>4683</postCode>
    <country>DK</country>
  </shipTo>
  <lines>
    <line>
      <lineNumber>1</lineNumber>
      <eanNo>5712094143628</eanNo>
      <quantity>1</quantity>
      <unitPrice>209.25</unitPrice>
    </line>
    <line>
      <lineNumber>2</lineNumber>
      <eanNo>5712094143635</eanNo>
      <quantity>10</quantity>
    </line>
  </lines>
</canonicalOrder>
```

**Expect:** `201` from Medusa. The trace shows `Content-Type: application/json` and this body:

```json
{
  "externalOrderNumber": "NIMBUS145-TC3",
  "orderDate": "26-08-2026",
  "currencyCode": "DKK",
  "pricesIncludeTax": false,
  "shipTo": { "name": "JK Tryk", "contact": "3. Parts Nimbus", "addressLine1": "Industrikrogen 11B", "city": "Rønnede", "postCode": "4683", "country": "DK" },
  "lines": [
    { "lineNumber": 1, "eanNo": "5712094143628", "quantity": 1.0, "unitPrice": 209.25 },
    { "lineNumber": 2, "eanNo": "5712094143635", "quantity": 10.0 }
  ]
}
```

Numbers and booleans must be JSON numbers and booleans, not strings. `eanNo` stays a string.
There is no `canonicalOrder` wrapper and no `?xml` key. A decimal may be written as `1.0`; it is the
same JSON number as `1`.

## TC-4: XML missing a required element

Send TC-3's body without `<externalOrderNumber>`.

**Expect:** `400` with the generic validation error body. There is no Logic App run.

## TC-5: Single-line XML becomes a one-element `lines` array

```http
POST <APIM_ORDER_URL>/a1b2c3d4e5f6
Content-Type: text/xml; charset=utf-8

<canonicalOrder>
  <externalOrderNumber>NIMBUS145-TC5</externalOrderNumber>
  <orderDate>27-08-2026</orderDate>
  <currencyCode>DKK</currencyCode>
  <lines>
    <line>
      <lineNumber>1</lineNumber>
      <itemNumber>FLS-NIM-VESPERMNA-XL</itemNumber>
      <eanNo>5712094145752</eanNo>
      <description>Vesper Vest Unisex, Navy - XL</description>
      <quantity>1</quantity>
      <unitPrice>134.75</unitPrice>
    </line>
  </lines>
</canonicalOrder>
```

**Expect:** `201`. In the trace, the transformed body has `"lines": [ { … } ]`, an array holding
one element, not an object. This case also covers `text/xml` with a `charset` parameter.

## TC-6: Minimal line, with no `unitPrice`, `itemNumber` or `description` (JSON)

```json
{
  "externalOrderNumber": "NIMBUS145-TC6",
  "orderDate": "27-08-2026",
  "currencyCode": "DKK",
  "lines": [{ "lineNumber": 1, "eanNo": "5712094145752", "quantity": 2 }]
}
```

**Expect:** `201`. APIM must not require the fields the contract leaves optional.

## TC-7: Unsupported content type

```http
POST <APIM_ORDER_URL>/a1b2c3d4e5f6
Content-Type: text/plain

some plain text body
```

**Expect:** `415` with `{"error":"Unsupported content type","message":"Use application/json, application/xml or text/xml."}`.

## TC-8: Missing content type

Send `POST <APIM_ORDER_URL>/a1b2c3d4e5f6` with no `Content-Type` header, with and without a body.

**Expect:** `415` with the same body as TC-7.

## TC-9: XML with a comma decimal

Send TC-5's body with `<unitPrice>134,75</unitPrice>`.

**Expect:** `400` with the generic validation error body. The canonical XML uses dot decimals
(`xs:decimal`). Comma decimals from raw N-EDI files are not accepted, so the policy does not
normalize them.

## TC-10: Field-format violations

Each of these, sent on its own as JSON (TC-1 base) and as XML (TC-5 base), must return `400` with
the generic body:

| Variant | Change |
|---|---|
| a | `orderDate` = `2026-08-27` (ISO instead of `DD-MM-YYYY`) |
| b | `eanNo` = `571209414575` (12 digits) |
| c | `quantity` = `0` |
| d | `currencyCode` = `Danish Kroner` |
| e | `lines` = `[]` / `<lines/>` |
| f | unknown field `customerNumber` at order level |
| g | JSON only: `unitPrice` = `"134.75"` (string) |

## TC-11: Duplicate `lineNumber` in XML

Send TC-3's body with both lines set to `<lineNumber>1</lineNumber>`.

**Expect:** `400` from APIM (the XSD's `xs:unique`).

## TC-12: Oversized body

Send a JSON body larger than 512 KB, e.g. with a very long `salesperson` value.

**Expect:** `400` with the generic validation error body (`size-exceeded-action="prevent"`).

## TC-13: Rules enforced downstream, not by APIM

These pass APIM and must be rejected by Medusa. Their purpose is to confirm the known gap:

| Variant | Change | Expect |
|---|---|---|
| a | JSON with two lines both `"lineNumber": 1` | Medusa `400` passed through (JSON Schema cannot express uniqueness) |
| b | `orderDate` = `31-02-2026` | Medusa `400` passed through (APIM checks the pattern only, not the calendar) |
| c | TC-3's body with `<country>XX</country>` (or JSON `"country": "XX"`) | Medusa `400` passed through, message `Invalid request: Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'XX'` (APIM checks the shape only, NIMBUS-171) |

## TC-14: Unknown token

Send TC-1's body to `<APIM_ORDER_URL>/does-not-exist`.

**Expect:** the Logic App's `401 {"error":"Token not recognized"}` passed through unchanged. This
confirms APIM forwards the token without judging it.

## TC-15: Caller query parameters are not forwarded

Send TC-1's body (with a new `externalOrderNumber`) to
`<APIM_ORDER_URL>/a1b2c3d4e5f6?customerNumber=999&sig=forged`.

**Expect:** `201` for the real token's customer. The trace shows a backend URL with only
`api-version`, `sp`, `sv` and the named-value `sig`, and no `customerNumber` or forged `sig`.

## TC-16: Country that is not a two-letter code (NIMBUS-171)

Send TC-3's body (XML) with `<country>Denmark</country>`, then with `<country>DNK</country>`. Send
the JSON form of TC-3 (the transformed body shown under TC-3, new `externalOrderNumber`) with
`"country": "Denmark"`.

**Expect:** `400` with the generic validation error body. There is no Logic App run.

## TC-17: Lower-case, padded country is accepted (NIMBUS-171)

Send TC-3's body with a new `externalOrderNumber` and `<country> se </country>`.

**Expect:** `201` from Medusa. APIM must not reject a code the backend accepts. The Medusa order's
shipping address has `country_code` `se`. The order's `metadata.canonical_order.shipTo.country` is
`SE`.

## Summary

| # | Case | Content-Type | Expect | Needs downstream |
|---|---|---|---|---|
| TC-1 | Valid JSON | `application/json` | 201 | Yes |
| TC-2 | JSON missing required | `application/json` | 400 | No |
| TC-3 | Valid XML, several lines | `application/xml` | 201 | Yes |
| TC-4 | XML missing required | `application/xml` | 400 | No |
| TC-5 | Single-line XML becomes an array | `text/xml; charset=utf-8` | 201 | Yes |
| TC-6 | Minimal line | `application/json` | 201 | Yes |
| TC-7 | Unsupported type | `text/plain` | 415 | No |
| TC-8 | Missing type | (none) | 415 | No |
| TC-9 | Comma decimal XML | `application/xml` | 400 | No |
| TC-10 | Format violations | both | 400 | No |
| TC-11 | Duplicate lineNumber XML | `application/xml` | 400 | No |
| TC-12 | Oversized body | `application/json` | 400 | No |
| TC-13 | Downstream-only rules | `application/json` | 400 (Medusa) | Yes |
| TC-14 | Unknown token | `application/json` | 401 (Logic App) | Logic App only |
| TC-15 | Caller query params dropped | `application/json` | 201 | Yes |
| TC-16 | Country not two letters | both | 400 | No |
| TC-17 | Lower-case padded country | `application/xml` | 201 | Yes |
