# Only provide shipments for companies enabled for shipment notices

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-217
- Priority: Should
- Size: M
- Area: Backend: company module (new company setting), order API `/orderapi/shipment-notices`, possibly shipment discovery from Business Central; Medusa Admin company page
- Requested by: Klaus Petersen
- Requested at: 2026-10-23T09:45:00Z

## Description

Shipment notices from Business Central should only be provided for customers (companies) that have
been explicitly enabled for it. A new setting on the company in Medusa marks whether the company
receives shipment notices; it does not exist today.

To fetch shipments for a customer, two things are then required:

1. a valid key, checked on the integration side, and
2. the shipment setting switched on for that company in Medusa.

Original request (Danish): "kan du også registrere en enhancement med at den kun skal hente
shipments for kunder der har fået et flag (skal laves) i medusa company modulet. så - for at hente
shipments skal man have en key der valideres i logic app og man skal sætte et flag i company
modulet på company".

## Why

Today any customer that has API orders gets shipment notices as soon as the integration asks for
them. Nimbus Nordic wants to control per customer who is enabled for shipment notices, so the
feature can be rolled out customer by customer and switched off for a customer without changing the
integration.

## Acceptance criteria

- [ ] A company in Medusa has a setting that says whether it is enabled for shipment notices.
- [ ] Shipments are only provided for a company when the setting is switched on and the request carries a valid key.
- [ ] A company without the setting switched on does not receive shipment notices.
- [ ] Staff can see and change the setting on the company in Medusa Admin.
- [ ] Existing companies are not enabled automatically unless decided otherwise.

## Out of scope

- Changes to how orders are received through the order API (`/orderapi/orders`).
- A per-customer key issued by Medusa (unless the answer to open question 2 asks for it).
- The Admin shipment overview (NIMBUS-216).

## Open questions

1. What does "hente shipments" cover?
   a. the Logic App reading notices from Medusa (`GET /orderapi/shipment-notices?customerNumber=…`),
   b. Medusa discovering and checking shipments from Business Central for that customer's API orders, or
   c. both (disabled companies are neither discovered nor served)?
2. The key: today `/orderapi/*` accepts one Medusa secret API key used only by the Logic App
   (HTTP Basic, authenticated as an admin user); there is no per-customer key in Medusa. Is "a key
   validated in the Logic App" the existing APIM subscription key per customer, checked in
   APIM/Logic App (outside this repo, NIMBUS-178), so this story only adds the company flag check
   in Medusa? Or should Medusa validate a per-customer key too?
3. A company without the flag: what does the order API return? Options: 404 like an unknown
   customer (generic, NIMBUS-192/193), 403, or 200 with an empty list. And if discovery is
   included: are its shipments skipped, or still stored but not served?
4. Shipments already stored for a company that is later switched off (or was never on): keep them,
   serve them again when switched back on, or stop tracking them?
5. Who sets the flag and where: in Medusa Admin on the company, default off? Is it a Medusa-only
   field, or should it come from Business Central like the BC-managed company fields (then it is
   synced and read-only in Admin)?
6. Go-live: which companies must be switched on at deploy so current API customers keep receiving
   shipment notices?

## Mockups / references

- Related: NIMBUS-130 (shipment notices epic), NIMBUS-178 (shipment notices through APIM and the
  Logic App), NIMBUS-216 (Admin shipment overview), NIMBUS-191 (Admin retry page),
  NIMBUS-192/193 (generic "customer not found" in the order API).

## Technical notes

Triage notes (code area only, no design):

- Order API auth: `apps/backend/src/api/orderapi/middlewares.ts` authenticates `/orderapi/orders*`
  and `/orderapi/shipment-notices*` with `authenticate("user", ["api-key"])`, one secret key used by
  the Logic App. The customer comes from the `customerNumber` query parameter.
- Read side: `apps/backend/src/api/orderapi/shipment-notices/route.ts` →
  `listShipmentNoticesWorkflow` (`apps/backend/src/workflows/shipment-notice/workflows/list-shipment-notices.ts`),
  which rejects an unknown customer with a generic 404.
- Discovery and checks from Business Central:
  `apps/backend/src/workflows/shipment-notice/workflows/{discover-shipments,check-shipments,poll-shipment-notices}.ts`,
  job `apps/backend/src/jobs/poll-shipment-notices.ts`. Shipments are stored in the `orderIngestion`
  module (`shipment_notice`, `shipment_tracking`, `shipment_notice_state`).
- Company model: `apps/backend/src/modules/company/models/company.ts` (has
  `business_central_customer_number`; no shipment flag). A new field is a data-model change with a
  generated migration. BC-managed fields: `apps/backend/src/admin/routes/companies/bc-managed-fields.ts`.
- The rule "a company receives shipment notices" is a new business rule: it needs one home in
  `ai/architecture/decisions.md`.
