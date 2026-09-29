# NIMBUS-138 — BC Return Contract

Status: **partially verified (2026-09-28).** The endpoint, method, and request parameters are
confirmed from the tenant OData metadata (`orderreturncreate metadata.xml`) and the customer's
description. The response body, error catalogue, idempotency behaviour, and line-identity mapping
still need a sandbox call. Those items are marked **OPEN**, and task 09 must not enable real writes
until they are closed.

## Endpoint & method

- **Mechanism:** Custom unbound OData action in the tenant's BC extension (not the public v2.0
  API, and there is no `salesReturnOrders` writer).
  - Metadata: `<Action Name="CustomerPortalReturns_CreateReturnOrder">` and
    `<ActionImport Name="CustomerPortalReturns_CreateReturnOrder" Action="NAV.CustomerPortalReturns_CreateReturnOrder" />`.
- **URL template:**
  ```
  POST https://api.businesscentral.dynamics.com/v2.0/{TenantId}/{Environment}/ODataV4/CustomerPortalReturns_CreateReturnOrder?company='{companyName}'
  ```
- **Base path:** This is the **ODataV4 web-services** path, not the `/api/v2.0/companies({id})`
  path that the existing `BusinessCentralService` calls use. Task 09 must build this URL separately.
- **Company scoping:** Uses the `company` query parameter with the BC company **name**, quoted
  and URL-encoded, not the company GUID. The portal configures `BUSINESS_CENTRAL_COMPANY_ID`
  (GUID) and reads the name at runtime from `GET {discoveryUrl}/companies({id})` → `name`.

## Request schema

The metadata declares three `Edm.String` parameters and returns `Edm.String`:

| Parameter | Type | Value |
|---|---|---|
| `requestId` | `Edm.String` | Server-generated deterministic idempotency key |
| `sourceOrderNo` | `Edm.String` | Source sales order document no. (`BCOrderDetail.number`) |
| `lines` | `Edm.String` | **JSON-encoded string** of the line array |

Example body:

```json
{
  "requestId": "…",
  "sourceOrderNo": "SO-10001",
  "lines": "[{\"sourceLineNo\":10000,\"quantityToReturn\":2,\"returnReasonCode\":\"NORMAL\"}]"
}
```

Line object inside `lines`: `sourceLineNo` (number), `quantityToReturn` (number),
`returnReasonCode` (string).

### Changes from the assumed contract (task 09 change list)

1. **`lines` is a string.** The service must send `JSON.stringify(params.lines)` in place of the
   raw array. The field names inside the array match the assumed contract and the
   `BCReturnLineInput` seam type, so the seam stays the same.
2. **ODataV4 URL with company name.** This is a new URL builder, and it needs the BC company
   **name** for the call to be configured or resolved.
3. **Response is `Edm.String`.** OData returns it as `{ "value": "<string>" }`. The content of the
   string (plain return-order no. or JSON) is **OPEN**. Task 09 maps it into `BCReturnOrder`.
4. **Return-reason codes differ.** The customer example uses `NORMAL`, which is not among the stub
   codes (`DAMAGED`, `WRONGITEM`, …). The dummy provider must be replaced. See Return-reason source.

## Line-identity mapping

- `sourceLineNo` is numeric. The example value `10000` matches the BC "Line No." convention.
- `prepare-bc-return.ts` maps `BCOrderLine.sequence === sourceLineNo`.
- **Confirmed (customer, 2026-09-28):** The order line number is the v2.0
  `salesOrderLines.sequence` value. The current mapping is correct.

## Idempotency & reconciliation

- `requestId` is a named action parameter.
- **OPEN:** Confirm that the action deduplicates on `requestId`: a repeat call with the same
  `requestId` must return the existing return order, not create a second one or error.
- There is no local reconciliation state (direct synchronous flow). Ambiguous outcomes return
  `503` to the storefront, and a customer retry re-sends the same deterministic `requestId`.

## Return-reason source

- **Implemented:** `listReturnReasons()` reads `ODataV4/CS_EnabledReasonCodes?company=…`, maps
  `ReasonCode` → `id` and `Description` → `description`, and deduplicates by `ReasonCode`.
  No filter is applied yet.
- **Candidate:** The metadata exposes the entity set `CS_EnabledReasonCodes`, with the properties
  `TableID`, `DocType`, `Type`, `ReasonCode`, `DocTypeInt`, `TypeInt`, and `Description`.
- **OPEN:** Confirm that it is the intended source for return reasons, and which
  `DocType`/`Type` filter selects return-order reasons. If confirmed, `listReturnReasons()` maps
  `ReasonCode` → `id` and `Description` → `description`.

## Response schema

- The declared return type is `Edm.String`, which OData wraps as `{ "value": "<string>" }`.
- **Implemented assumption:** `value` is the created return-order number. It is used as
  `BCReturnOrder.id` and `number`, with `status` set to `"Open"`. An empty or missing `value` is
  treated as ambiguous.
- **OPEN:** Capture a real 2xx body and confirm the string's format.

## Error catalogue

**Implemented classification:** a thrown fetch (including the 30 s timeout), a `408`, or a `5xx` is
ambiguous (`BusinessCentralAmbiguousOutcomeError` → `503`). A `401`/`403` is a configuration error
(`UNEXPECTED_STATE` → `500`). Any other `4xx` is a definitive rejection (`INVALID_DATA` → `400`,
with a generic customer-safe message; BC's text is not forwarded).

**OPEN:** Capture the real BC error shapes for each case below to refine the messages:

| Case | Customer-safe message | Class |
|---|---|---|
| Unknown / not-owned source order | Order not found | definitive |
| Line already returned / qty exceeds returnable | Quantity not returnable | definitive |
| Invalid reason code | Invalid return reason | definitive |
| Ineligible order state | Order cannot be returned | definitive |
| Timeout / 5xx / network failure | Try again later | ambiguous (`503`) |

## Non-goals

**Confirmed (customer, 2026-09-28):** The action only creates the return order. It does not post a
credit memo, return receipt, payment, or refund.

## Permissions

**Confirmed (customer, 2026-09-28):** The existing BC client-credentials app registration has the
permissions needed to execute the action.

## Sandbox test data

**OPEN:** Record the test customer, company name, and source order used for verification.
