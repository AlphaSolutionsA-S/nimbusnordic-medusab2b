# Order API error for an unknown customer repeats the customer number

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-192
- Severity: Minor (found by code reading; not reproduced)
- Area: Backend, order API (`POST /orderapi/orders`), workflow `order-ingestion`, step
  `match-company-and-check-duplicate`
- Reported by: found by the NIMBUS-130 implementation planner (agent, on behalf of Klaus Petersen)
- Reported at: 2026-10-19T00:00:00Z
- Related: NIMBUS-129 (built the endpoint; story NIMBUS-144), NIMBUS-130 (found it; its new read
  endpoint is planned with a generic 404)

## Summary

When an order is sent to the order API for a customer number that does not belong to any company in
the portal, the "not found" error the API sends back repeats that Business Central customer number.
Callers reach the API through the customer gateway, which looks up the customer number from the
caller's own token, so a caller should never see or choose that number. The error should say only that
the customer was not found; the detail belongs in the server log.

## Steps to reproduce

Not yet run; from the code and the existing HTTP test TC-5.

1. With a secret API key, `POST /orderapi/orders?customerNumber=no-such-customer` with a valid
   canonical order body.
2. Read the 404 response body.

## Expected

A 404 with a generic message that contains no identifier (for example "Customer not found"). The
customer number is logged server-side only, with no personal data in the log line.

## Actual

`apps/backend/src/workflows/order-ingestion/steps/match-company-and-check-duplicate.ts:40-45` throws

```ts
throw new MedusaError(
  MedusaError.Types.NOT_FOUND,
  `No company found for customer number '${input.customer_number}'`
);
```

The route (`apps/backend/src/api/orderapi/orders/route.ts:22-29`) awaits the workflow without a
try/catch on purpose, so Medusa's error handler maps the error to 404 and returns its message
(pass-through of the message body to the caller: UNVERIFIED, check against the installed
`@medusajs/framework` error handler or a running request). NIMBUS-130's plan says APIM passes Medusa's
status and body through (`issues/NIMBUS-130/plan.md` line 311), so the number would reach the caller.

Effects: an internal identifier (the BC customer number) appears in a response, and the response text
differs by input. Exposure is limited: the endpoint needs the admin-equivalent secret key, and in
production the Logic App sets `customerNumber` from the token, not the caller.

## Other order-API errors checked

| Error | Where | Echoes | Assessment |
|---|---|---|---|
| Unknown customer (404) | `match-company-and-check-duplicate.ts:41-44` | BC customer number | this bug |
| Duplicate order (422) | `match-company-and-check-duplicate.ts:56-59` | the caller's own `externalOrderNumber` | the caller sent it; no internal identifier; leave unless the scope decides otherwise |
| Duplicate order, lost race (422) | `steps/create-order-external-reference.ts:40-43` | the caller's own `externalOrderNumber` | same as above; this code already replaces a DB error that exposed the internal company id |
| Event emission failure | `api/orderapi/orders/route.ts:37-39` | order id | server log only, not in the response |

## Also update

- `apps/backend/integration-tests/http/order-ingestion/create-order-workflow.spec.ts:128-145` (TC-2)
  asserts `message: expect.stringContaining("No company found")`; change it to the new message and add
  an assertion that the message does not contain the customer number.
- `apps/backend/integration-tests/http/orderapi/orders.spec.ts:151-165` (TC-5) asserts only status 404;
  add a body assertion that the customer number is absent.
- `apps/backend/integration-tests/http/security/security-boundaries.spec.ts`: has no order-API case
  today; `ai/architecture/verification.md` puts security negative cases there, so the scope decides
  whether this one goes there or stays in TC-5.
- `issues/NIMBUS-129/03-create-order-workflow-implementation.md` (lines 172, 408) quotes the old
  message: a frozen case record, do not update.
- `docs/security-remediation.md`, `docs/architecture/`: no finding or section about order-API error
  messages; none found to update.

## Environment

- OS / runtime: backend (Medusa 2.21), any environment
- Build / commit: `develop` at 49e3751
- Tenant / data context: any customer number with no matching company

## Evidence

- Code citations above. No logs or samples.

## Open questions

- Should the NIMBUS-130 read endpoint and this POST share one company-resolution step with the generic
  404 (the NIMBUS-130 plan adds a new step instead, `plan.md` section 8)?
- Does the server-side log line for an unknown customer number need the number, and is a BC customer
  number personal data here (sole-trader customers)? `ai/architecture/data-ownership.md` lists
  company data synced from BC as personal data.

## Analysis

*(Empty. Fill in `analysis.md` when investigation starts and link from here.)*
