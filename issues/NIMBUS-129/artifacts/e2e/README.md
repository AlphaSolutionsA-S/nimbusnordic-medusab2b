# NIMBUS-129 synthetic E2E data

These payloads contain synthetic customer/address/item descriptions and no real
credentials. Use them only in a non-production environment. Replace the external
order number with a unique value for each run; do not check tokens or API keys into
this folder.

## Sandbox prerequisites

1. Create a Business Central sandbox customer and record its customer number.
2. Create two sandbox items with GTINs `0000000000017` and `0000000000024`, item
   numbers `NIMBUS129-TEST-ITEM-1` and `NIMBUS129-TEST-ITEM-2`, and a known sales
   price for the test customer.
3. Create a Medusa test company whose
   `business_central_customer_number` exactly matches the sandbox customer number.
4. Add a temporary customer-token entry to the configured token list, mapping the
   chosen token to that customer number using the deployed NIMBUS-146 format.
5. Configure the Medusa secret API key in the Logic App's secure setting. Keep the
   token and API key in the environment's secret store; never put them in these
   fixtures or shared run evidence.
6. Configure and verify the APIM policy's actual Logic App backend URL and token
   path forwarding before running the complete route.

## Payload use

- `valid-order.json`: JSON path; includes two lines and a deliberately mismatched
  optional `unitPrice` on line 1. Verify BC pricing remains authoritative.
- `valid-order.xml`: equivalent XML path. Use a different unique external order
  number from the JSON run. Confirm XML conversion preserves numeric fields and
  makes `lines` an array.
- `invalid-order.json`: negative contract check; the missing
  `externalOrderNumber` must be rejected before order creation.

For invalid-token, duplicate, unknown-customer, and BC-failure cases, reuse a
valid payload with a fresh or deliberately repeated `externalOrderNumber` as
specified in `END_TO_END_TEST_CASES.md`. Capture no real credentials in evidence.
