# Norwegian companies use the Norwegian Business Central for returns, order history and company sync

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-261
- Priority: Should
- Size: L
- Area: Backend: Business Central module (`apps/backend/src/modules/business-central`), store BC order and return routes, BC return workflow, BC company sync
- Requested by: Klaus Petersen
- Requested at: 2026-10-27T20:23:00Z

## Description
Norwegian customers in the customer portal should be served from Nimbus Nordic's Norwegian Business
Central (TestNO / ProductionNO) instead of the Danish one (TestDK / ProductionDK). This applies to
returns (list, detail, return reasons and creating a return), the Business Central order history in
the portal, and the company sync that reads the customer card, credit limit and currency. All other
companies keep using the Danish Business Central.

## Why
Norwegian customers are held in the Norwegian Business Central. Today the portal looks them up in
the Danish environment, so Norwegian customers do not see their own Norwegian orders, returns and
credit information, and cannot create returns against them.

## Acceptance criteria
- [ ] A user of a Norwegian company sees their orders and returns from the Norwegian Business Central in the portal.
- [ ] A user of a Norwegian company can create a return against a Norwegian Business Central order, and the return is created in the Norwegian Business Central.
- [ ] Return reasons for a Norwegian company come from the Norwegian Business Central.
- [ ] The company sync for a Norwegian company reads customer data, credit limit and currency (NOK) from the Norwegian Business Central.
- [ ] Companies in every other country keep using the Danish Business Central, unchanged.
- [ ] The order API and shipment notices keep using the Danish Business Central (out of scope for now).

## Out of scope
- The order API (`/orderapi`, order ingestion → `send-order-to-business-central`) and shipment
  notices (`jobs/poll-shipment-notices.ts`): they stay on the DK environment, passed explicitly
  (the human's decision).
- `api/store/business-central/operations`: checked during triage, it is disabled (always 404, the
  old body is commented out) and not company-scoped, so nothing to route.

## Open questions
- Norwegian companies' existing orders and returns in the DK Business Central will no longer show in
  the portal after the switch. Is that acceptable? (For the scoper.)
- Is the NO currency NOK? (Assumed by the human; confirm.)
- Are the custom `abakion/customerPortal/v2.0` API and the `PostedReturnReceipt*` web services
  published in TestNO/ProductionNO? The human says yes ("they are the same instance"); verify with a
  read-only probe during planning.

## Mockups / references
- Related: NIMBUS-254 (sync a company from BC now, from the Admin company page; in review), which
  touches the same BC company sync.

## Technical notes

### In scope (each looks up the logged-in company's `business_central_customer_number` and calls the single global BC service today)
- Returns list/detail: `apps/backend/src/api/store/bc-returns/route.ts`, `bc-returns/[number]`.
- Return create: `api/store/bc-orders/[id]/returns/route.ts` →
  `workflows/business-central-return/steps/prepare-bc-return.ts` (`getOrder`),
  `submit-bc-return.ts` (`CustomerPortalReturns_CreateReturnOrder`).
- Return reasons: `api/store/bc-orders/return-reasons`.
- Portal BC order history: `api/store/bc-orders/route.ts`, `bc-orders/[id]` (a return is created
  from and validated against a BC order).
- BC company sync: `workflows/company/steps/prepare-company-bc-sync.ts` (customer card, credit
  limit, LCY).

### Current design (verified in code before triage)
BC connection is global env config read in `apps/backend/src/modules/business-central/service.ts`
(~L759-856): `BUSINESS_CENTRAL_DISCOVERY_URL` (environment is the path segment; default TestDK at
L87), `BUSINESS_CENTRAL_COMPANY_ID` (one BC company GUID, used for custom API paths and the ODataV4
`company=` name), `BUSINESS_CENTRAL_LCY_CODE` (default DKK, L109),
`BUSINESS_CENTRAL_CLIENT_ID/SECRET`. The shipment-read token cache holds one company name (L749).
The test guard `apps/backend/src/utils/business-central-test-environment.ts` allows only `TestDK`
by default (`BUSINESS_CENTRAL_TEST_ENVIRONMENTS`). Company has `country` and
`business_central_customer_number` (`modules/company/models/company.ts`); no company→environment
mapping exists.

### The human's answers
1. The custom API and the `PostedReturnReceipt*` web services should be published in NO (same
   instance). Verify by read-only probe.
2. Same Entra tenant and app registration (same credentials); NO needs its own environment name,
   company GUID and LCY.
3. Norwegian companies are currently synced against DK. BC customer numbers are unique across DK
   and NO, so no wrong-customer collision; after the switch they resolve in NO.
4. `company.country` is reliable enough to route on (NO → NO environment, else DK); no new field,
   likely no migration.

### Likely shape (for the scoper, not binding)
Per-environment BC config (DK and NO env-var sets); BC service methods take an environment key;
token and company-name caches keyed per environment; one pure decision function company country →
environment (register in `ai/architecture/decisions.md`); add TestNO to the test-environment
allowlist; order API and shipment poll pass DK explicitly.
