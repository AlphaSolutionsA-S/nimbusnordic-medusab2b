# NIMBUS-129 cross-stack acceptance tests

**Date:** 2026-09-30  
**Scope:** Customer submission through APIM, Logic App, Medusa, the asynchronous
Business Central handoff, and persisted outcome. The NIMBUS-158 Admin status/retry
experience is explicitly excluded.

## Expected path and contract

```text
External test client
  -> Azure APIM (JSON validation or XML validation + XML-to-JSON)
  -> Logic App (customer path-token check + customer-number resolution)
  -> Medusa POST /orderapi/orders (secret API key, canonical validation,
     customer/company match, duplicate check, synchronous order creation)
  -> Medusa event/subscriber (asynchronous post-creation processing)
  -> Business Central (customer/item lookup + sales-order submission)
  -> Medusa order metadata (integration outcome)
```

Use the latest approved design in `issues/NIMBUS-129/PLAN.md` as the behavior
source: Medusa validates and creates the real order synchronously and returns
`201` with its Medusa order ID; the post-creation Business Central work runs
asynchronously. The Business Central ID is internal and must never be returned to
the external caller. This differs from older wording in the Jira epic description.

## Test environment setup

- Use a dedicated non-production APIM API, Logic App, Medusa environment, and
  Business Central sandbox. Do not use production tokens, companies, or orders.
- Configure the APIM schemas and policy, Logic App trigger, token-list entry,
  Medusa secret API key, and BC sandbox credentials. Use a unique external order
  number for each positive case.
- Create a test token that resolves to a Medusa company with a BC customer number;
  ensure each EAN in the fixture resolves to a known BC item. Use the canonical
  data in `issues/NIMBUS-129/artifacts/e2e/` as the non-production payloads. The
  backend fixtures in `apps/backend/src/modules/order-ingestion/__fixtures__/`
  remain useful for automated tests.
- Capture the APIM response, Logic App run result, Medusa order ID and metadata,
  and BC sandbox order reference. Redact tokens, API keys, and customer data from
  the evidence before sharing it.

## Acceptance cases

| ID | Scenario | Steps | Pass criteria |
| --- | --- | --- | --- |
| E2E-01 | JSON order succeeds through all services | Submit a valid multi-line JSON order through the public APIM endpoint with a valid customer path token. Follow the same unique order through the Logic App, Medusa, and BC sandbox. | APIM accepts and forwards canonical JSON; the Logic App resolves the token and customer number; Medusa responds `201` with a real order ID; the Medusa order is linked to the expected company and retains canonical line data; BC creates one order with the expected customer, lines, quantities, dates, and currency behavior; Medusa records the successful BC result. The caller receives no BC ID. |
| E2E-02 | XML maps to the same canonical order as JSON | Submit an equivalent XML order using a fresh external order number. Include both one-line and multi-line payloads across runs. | APIM validates the XSD and transforms XML to the same canonical field types as JSON. A single XML line remains a one-element `lines` array; multiple lines preserve order and values. Downstream Medusa and BC outcomes match the JSON case. |
| E2E-03 | Unsupported media type and malformed wire payloads fail closed | Send an unsupported content type, malformed JSON, malformed XML, an invalid XSD payload, an unknown field, and a body above the configured size limit. | Unsupported type returns `415`; malformed/invalid payloads return the documented client error; oversized input is rejected by the gateway. No rejected request creates a Medusa order or reaches BC. Responses do not echo submitted payloads or secrets. |
| E2E-04 | Invalid, unknown, or unmappable customer token is rejected | Send an unknown/expired token, then a token-list entry with no valid customer-number mapping. | The Logic App fails closed with the configured generic unauthorized response. It does not call Medusa, create an order, or echo the token or malformed mapping to the caller. |
| E2E-05 | Medusa rejects an unknown customer | Use a valid integration token mapped to a customer number that does not match a Medusa company. | Medusa returns `404`; there is no Medusa order, dedupe row, or BC request. The Logic App passes Medusa's status and safe response through to the caller. |
| E2E-06 | Duplicate policy is company-scoped | Submit an order, then resubmit the same external order number for the same company. Separately submit that number for a different company. | The same-company duplicate returns `422` and creates no second Medusa or BC order. The other company may use the same external order number and receives its own order. |
| E2E-07 | Business Central mapping and price authority are respected | Use a valid order whose EANs map to known BC items. Include an optional submitted `unitPrice` that differs from the BC price list. | The BC payload contains the expected mapped item numbers and quantities. Submitted `unitPrice` does not override BC pricing. The persisted order outcome records the BC order ID internally and reports success; the ID is absent from the APIM response. |
| E2E-08 | BC rejection or outage is retained on the accepted Medusa order | In the BC sandbox, cause a controlled rejected line/order or temporarily make the BC endpoint unavailable after Medusa returns success. | The Medusa order remains persisted; integration metadata records a failed/partial result or an ambiguous outcome as applicable, without inventing a BC ID. A customer resubmission with the same company/order number cannot create a second Medusa order. This case validates persistence and error handling only; it does not exercise an Admin retry UI. |
| E2E-09 | Concurrent duplicate submissions do not create duplicate orders | Send two identical requests for the same company and external order number concurrently through the deployed path. | At most one request succeeds and exactly one Medusa order, dedupe record, and BC submission exist. The losing request receives the documented duplicate response. Treat any duplicate persistence or BC submission as a release blocker. |
| E2E-10 | Integration credentials and internal errors stay private | Run E2E-01 and E2E-04, then inspect APIM diagnostics, Logic App run history, Medusa logs, and caller responses for the Medusa secret API key and raw internal errors. | The Medusa secret API key is masked in Logic App run history and is absent from caller responses/log output. Responses contain no stack traces or raw internal errors. |

## Existing automation versus the cross-stack run

The repository already has useful component-level coverage:

- `apps/backend/src/modules/order-ingestion/__tests__/canonical-order-schema.unit.spec.ts`
  validates the canonical contract.
- `apps/backend/integration-tests/http/orderapi/orders.spec.ts` covers the
  authenticated Medusa route, invalid input, unknown customer, duplicates, and
  the Medusa order-created event path.
- `apps/backend/integration-tests/http/business-central-order/` covers BC
  submission outcomes and the BC-ready subscriber with the BC module stubbed.
- `issues/NIMBUS-145/artifacts/test-payloads.md` and
  `issues/NIMBUS-146/artifacts/test-payloads.md` define Azure-side manual checks.

Those tests do not prove one request succeeds across the deployed APIM, Logic App,
Medusa, and real BC sandbox. The APIM policy artifact still contains a placeholder
Logic App URL and a commented path rewrite; replace and validate these during
non-production deployment before attempting E2E-01. Azure APIM/Logic App execution
is manual because this repository has no automated Azure integration test harness.

**Approved logging-scope difference:** the epic scope asks for customer path-token
redaction, but the approved NIMBUS-145 and NIMBUS-146 scopes explicitly drop that
requirement and allow the customer token to appear in Azure logs/run history. This
matrix does not assert customer-token redaction. If the epic requirement is still
binding, reconcile those story decisions before sign-off; do not treat this as a
verified security control.

## Run record

Record environment/build identifiers, UTC run time, tester, redacted request
fixture, response status, Medusa order ID, final integration state, and BC sandbox
order reference for each run. Mark a case **Blocked** when its dependent Azure or
BC configuration is not deployed; do not count a mocked backend suite as a pass
for an end-to-end case.

| ID | Result | Run link / evidence | Notes |
| --- | --- | --- | --- |
| E2E-01 | Not run | | |
| E2E-02 | Not run | | |
| E2E-03 | Not run | | |
| E2E-04 | Not run | | |
| E2E-05 | Not run | | |
| E2E-06 | Not run | | |
| E2E-07 | Not run | | |
| E2E-08 | Not run | | |
| E2E-09 | Not run | | |
| E2E-10 | Not run | | |
