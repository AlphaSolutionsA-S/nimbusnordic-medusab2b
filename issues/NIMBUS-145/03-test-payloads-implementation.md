# Task 03: Test Payloads and Manual Verification Plan

**Status:** TODO
**App:** azure-integration
**Task ID:** 03
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-145 (from develop)
**Depends on:** Task 01, Task 02

---

## Context

No automated APIM test infrastructure exists in this repo (same as NIMBUS-146). Tests are
documented manual payloads to be executed against a live APIM deployment via the Portal's Test
tab or an HTTP client (e.g. curl, Postman).

Each test case specifies:
- The request (method, URL, headers, body).
- The expected response (status code, body shape).
- What is being verified.

### Test environment prerequisites

- Task 01's schemas (`canonical-order-json`, `canonical-order-xml`) uploaded to the APIM
  instance.
- Task 02's policy applied to the order-ingestion API operation.
- NIMBUS-146's Logic App deployed and its HTTP trigger URL configured in the policy's
  `set-backend-service`.
- NIMBUS-129's Task 05 (`POST /orderapi/orders`) deployed (for end-to-end tests that expect a
  downstream response — TC-1 and TC-3).

**Blocked tests:** TC-1 and TC-3 require the full downstream pipeline (Logic App + Medusa
endpoint) to be deployed. If they are not yet available, these tests verify only the APIM
layer's behavior (policy execution, validation, transformation) by observing the APIM trace
output, not the downstream response.

## Solution Design

### New File: `issues/NIMBUS-145/artifacts/test-payloads.md`

Documented manual test cases with request payloads and expected responses.

## Test Cases

### TC-1: Valid JSON submission — happy path

**Request:**
```
POST /orders/{token}
Content-Type: application/json

{
  "externalOrderNumber": "FLS190518",
  "orderDate": "2026-08-27",
  "currencyCode": "DKK",
  "lines": [
    {
      "lineNumber": 1,
      "itemNumber": "FLS-NIM-VESPERMNA-XL",
      "eanNo": "5712094145752",
      "description": "Vesper Vest Unisex, Navy - XL",
      "quantity": 1,
      "unitPrice": 134.75
    }
  ]
}
```

**Expected:** `201` (or the downstream Medusa response, if the full pipeline is deployed).
**Verifies:** JSON validation passes, request is forwarded to the Logic App.

### TC-2: Invalid JSON submission — missing required field

**Request:**
```
POST /orders/{token}
Content-Type: application/json

{
  "orderDate": "2026-08-27",
  "currencyCode": "DKK",
  "lines": [
    {
      "lineNumber": 1,
      "itemNumber": "FLS-NIM-VESPERMNA-XL",
      "eanNo": "5712094145752",
      "description": "Vesper Vest Unisex, Navy - XL",
      "quantity": 1,
      "unitPrice": 134.75
    }
  ]
}
```

(Missing `externalOrderNumber`.)

**Expected:** `400` with body `{"error":"Request validation failed","message":"The submitted payload does not conform to the canonical order contract."}`.
**Verifies:** JSON validation rejects missing required fields. Error response does not echo the
raw payload or expose internal details.

### TC-3: Valid XML submission — happy path

**Request:**
```
POST /orders/{token}
Content-Type: application/xml

<canonicalOrder>
  <externalOrderNumber>FLS190518</externalOrderNumber>
  <orderDate>2026-08-27</orderDate>
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

**Expected:** `201` (or the downstream Medusa response, if the full pipeline is deployed).
**Verifies:** XML validation passes, `xml-to-json` transforms to canonical JSON, request is
forwarded to the Logic App with `Content-Type: application/json`.

### TC-4: Invalid XML submission — schema violation

**Request:**
```
POST /orders/{token}
Content-Type: application/xml

<canonicalOrder>
  <orderDate>2026-08-27</orderDate>
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

(Missing `<externalOrderNumber>`.)

**Expected:** `400` with body `{"error":"Request validation failed","message":"The submitted payload does not conform to the canonical order contract."}`.
**Verifies:** XML validation rejects missing required elements. Error response is safe.

### TC-5: Single-line XML submission — `lines` becomes a JSON array

**Request:**
```
POST /orders/{token}
Content-Type: application/xml

<canonicalOrder>
  <externalOrderNumber>FLS190518</externalOrderNumber>
  <orderDate>2026-08-27</orderDate>
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

**Expected:** `201` (or downstream response). **Verify via APIM trace** that the transformed JSON
body has `"lines": [{ ... }]` (array with one element), not `"lines": { ... }` (singleton object).
**Verifies:** `always-array-child-elements="true"` on `xml-to-json` produces a JSON array for a
single `<line>` element.

### TC-6: Unsupported content type — `text/plain`

**Request:**
```
POST /orders/{token}
Content-Type: text/plain

some plain text body
```

**Expected:** `415` with body `{"error":"Unsupported content type. Use application/json or application/xml."}`.
**Verifies:** Unsupported content types are rejected before validation.

### TC-7: Missing content type

**Request:**
```
POST /orders/{token}

(no Content-Type header, no body)
```

**Expected:** `415` with body `{"error":"Unsupported content type. Use application/json or application/xml."}`.
**Verifies:** Missing content type is handled by the `otherwise` branch of the `choose` block.

### TC-8: XML with comma-decimal `unitPrice` (conditional — only if the XML wire format uses comma decimals)

**Request:**
```
POST /orders/{token}
Content-Type: application/xml

<canonicalOrder>
  <externalOrderNumber>FLS190518</externalOrderNumber>
  <orderDate>2026-08-27</orderDate>
  <currencyCode>DKK</currencyCode>
  <lines>
    <line>
      <lineNumber>1</lineNumber>
      <itemNumber>FLS-NIM-VESPERMNA-XL</itemNumber>
      <eanNo>5712094145752</eanNo>
      <description>Vesper Vest Unisex, Navy - XL</description>
      <quantity>1</quantity>
      <unitPrice>134,75</unitPrice>
    </line>
  </lines>
</canonicalOrder>
```

**Expected:** If decimal comma normalization is implemented in the policy, `201` (or downstream
response). If not implemented, `400` (JSON Schema validation fails because `"134,75"` is a
string, not a number).
**Verifies:** Decimal comma normalization (if needed) produces a valid JSON number.

**Note:** This test case is conditional. If the XML wire format uses dot decimals (e.g.
`<unitPrice>134.75</unitPrice>`), this test is not applicable and can be skipped. The
implementor must verify the XML wire format's decimal convention.

## Test Cases Summary

| # | Description | Content-Type | Expected Status | Blocked? |
|---|-------------|-------------|-----------------|----------|
| TC-1 | Valid JSON submission | `application/json` | 201 | Yes (needs downstream) |
| TC-2 | Invalid JSON — missing required field | `application/json` | 400 | No |
| TC-3 | Valid XML submission | `application/xml` | 201 | Yes (needs downstream) |
| TC-4 | Invalid XML — schema violation | `application/xml` | 400 | No |
| TC-5 | Single-line XML — `lines` is array | `application/xml` | 201 | Yes (needs downstream) |
| TC-6 | Unsupported content type | `text/plain` | 415 | No |
| TC-7 | Missing content type | (none) | 415 | No |
| TC-8 | XML with comma decimals | `application/xml` | 201 or 400 | Conditional |

## Impacted Files

- **New:** `issues/NIMBUS-145/artifacts/test-payloads.md`

No existing files are modified.

## Open Items

- **TC-1, TC-3, TC-5 are blocked** pending NIMBUS-146's Logic App and NIMBUS-129's Task 05
  deployment. Until then, verify only the APIM layer's behavior via the Portal's trace output.
- **TC-8 is conditional** on the XML wire format's decimal convention. Skip if dot decimals are
  used.
- **The `{token}` placeholder** in the test URLs must be replaced with a real customer token
  from the token-list store (NIMBUS-146 Task 01) for end-to-end tests.
