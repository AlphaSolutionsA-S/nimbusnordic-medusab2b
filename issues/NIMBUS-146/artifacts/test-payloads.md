# NIMBUS-146 — Manual Test Payloads

⚠️ **Manual testing required.** Execute these cases against a live deployed Logic App. Replace `<LOGIC_APP_TRIGGER_URL>` with the generated callback URL.

**Known blocker:** TC-1, TC-5, and TC-6 require NIMBUS-129's `POST /orderapi/orders` endpoint to be implemented and deployed. TC-2, TC-3, TC-4, and TC-7 can be run once this Logic App is deployed.

Assume the token list includes `Value = "a1b2c3d4e5f6::579000283084"`. For TC-1, the target Medusa environment must contain a Company with `business_central_customer_number = "579000283084"`.

## TC-1: Valid token and order

Send:

```http
POST <LOGIC_APP_TRIGGER_URL>/orders/a1b2c3d4e5f6
Content-Type: application/json

{
  "externalOrderNumber": "MANUAL-TEST-1",
  "orderDate": "2026-09-02",
  "currencyCode": "DKK",
  "lines": [{
    "lineNumber": 1,
    "itemNumber": "ITEM-1",
    "eanNo": "1234567890123",
    "description": "Test item",
    "quantity": 1,
    "unitPrice": 10
  }]
}
```

Expect Medusa's unchanged `201` response, for example `{"order_id":"order_...","status":"pending"}`.

## TC-2: Unknown token

Send the same valid body to:

```http
POST <LOGIC_APP_TRIGGER_URL>/orders/does-not-exist
Content-Type: application/json
```

Expect exactly `401 {"error":"Token not recognized"}`. Confirm neither the token nor a customer number is in the response and that `Forward_Order_To_Medusa` did not run.

## TC-3: Token without a customer number

Seed `Value = "missing-customer-number::"`, then send a structurally valid order to:

```http
POST <LOGIC_APP_TRIGGER_URL>/orders/missing-customer-number
Content-Type: application/json
```

Expect exactly `401 {"error":"Not allowed"}`. Confirm `Response_Not_Allowed` ran and `Forward_Order_To_Medusa` was skipped. Repeat with a fallback `CustomerNumber` of `null` and `""` if that schema is used.

## TC-4: Token entry with no `::` delimiter

Seed `Value = "no-delimiter-token"` — a token with the customer number never encoded — then send a structurally valid order to:

```http
POST <LOGIC_APP_TRIGGER_URL>/orders/no-delimiter-token
Content-Type: application/json
```

Expect exactly `401 {"error":"Not allowed"}`. In the run history, confirm `Filter_Matching_Token` *did* match the entry, that `Compose_Customer_Number` output is the empty string (not `no-delimiter-token`), and that `Forward_Order_To_Medusa` was skipped. This is the regression check that a malformed entry never reaches Medusa as `?customerNumber=no-delimiter-token`.

## TC-5: Downstream structural validation failure

With the valid token, send a body without `lines`:

```json
{ "externalOrderNumber": "MANUAL-TEST-4", "orderDate": "2026-09-02", "currencyCode": "DKK" }
```

Expect Medusa's unchanged `400` response. This confirms `Response_Success` runs after both successful and failed downstream HTTP actions. Also confirm the run history shows the forwarded order body (secured `authentication`, not secured `inputs`) and does **not** show the Medusa API key.

## TC-6: Unknown Medusa customer number

Use a valid token that resolves to no `Company.business_central_customer_number`, with a structurally valid body. Expect Medusa's unchanged `404` response.

## TC-7: HTTPS

Confirm the generated trigger URL begins with `https://` and that there is no usable HTTP-only variant.

## Outcome tracking

- [ ] TC-1 executed against a live deployment — result: _______
- [ ] TC-2 executed against a live deployment — result: _______
- [ ] TC-3 executed against a live deployment — result: _______
- [ ] TC-4 executed against a live deployment — result: _______
- [ ] TC-5 executed against a live deployment — result: _______
- [ ] TC-6 executed against a live deployment — result: _______
- [ ] TC-7 verified — result: _______
