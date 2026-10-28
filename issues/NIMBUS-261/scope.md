# Norwegian companies use the Norwegian Business Central for returns, order history and company sync

**Date:** 2026-10-27
**Status:** Scoped
**Type:** Story
**Priority:** Medium (Jira: Should)
**Issue:** NIMBUS-261
**Key:** NIMBUS-261
**Case folder:** issues/NIMBUS-261/
**Base Branch:** develop

## Background

Nimbus Nordic runs two Business Central (BC) environments per stage: a Danish one (TestDK /
ProductionDK) and a Norwegian one (TestNO / ProductionNO). Both are in the same Microsoft tenant
and use the same app registration. Norwegian customers are held in the Norwegian environment.

Today the backend has one global BC connection: one environment, one BC company and one local
currency (DKK by default). Every customer-portal BC call therefore goes to the Danish environment.
As a result, Norwegian customers do not see their own Norwegian orders, returns and credit
information, and cannot create returns against Norwegian orders.

Once companies are routed by country, a company whose country is wrong or blank can end up in the
wrong environment, where its customer number is not found. Today the sync then skips silently.
Administrators need to see this, find out where the customer number exists, and correct the
company.

## Requirements

### Functional

**Routing**

1. Each customer-portal BC call made on behalf of a company goes to that company's BC environment.
   Norwegian companies use the Norwegian environment and all others use the Danish one.
2. In scope, routed per company:
   - BC order history: list and detail (`/store/bc-orders`, `/store/bc-orders/:id`).
   - Returns: list and detail (`/store/bc-returns`, `/store/bc-returns/:number`), including the
     posted return receipts shown on the detail.
   - Return reasons (`/store/bc-orders/return-reasons`). This route reads no company today. It must
     start looking up the logged-in customer's company to pick the environment.
   - Creating a return (`/store/bc-orders/:id/returns`): reading and validating the source order,
     and creating the return order, both in the company's environment.
   - BC company sync (customer card, credit limit, currency) from every trigger that starts it:
     login sync, the storefront company read, the storefront "sync now" route and the Admin "Sync
     from Business Central" action (NIMBUS-254, on `develop`).
3. When a Norwegian company has a blank BC currency, it resolves to NOK, the Norwegian
   environment's local currency. A Danish company's blank currency resolves to DKK, as today.
4. Out of scope, and kept on the Danish environment explicitly rather than by default: the order
   API, order ingestion → BC order submission (including its currency override), and shipment
   notice polling, discovery and checks.
5. `/store/business-central/operations` is disabled (always 404) and stays untouched.
6. The Norwegian environment is configured beside the Danish one, with its own environment
   (discovery URL), BC company id and local currency. The client id and secret are shared.
7. The integration-test safety guard currently refuses any BC environment other than TestDK. It
   will also check the Norwegian connection: tests run only when every configured BC environment
   is an allowed test environment, and TestNO is added to the default allowlist.

**Recording "customer not found" on the company**

8. When the company sync finds no BC customer for the company's customer number in the routed
   environment, it records this on the company: when it happened, which environment was searched
   and which customer number was tried. This applies to every sync trigger. Repeat syncs overwrite
   the record, so there is no history.
9. The next successful sync clears the record.
10. Nothing is recorded when the company has no customer number (that is a skip, as today) or when
    BC is unreachable or returns an error (the "failed" result, as today).

**Admin section on the company page**

11. The Admin company detail page (`/app/companies/:id`) shows a "Business Central customer" section
    that displays:
    - the company's routed environment, as derived from its country;
    - the "customer not found" record, when there is one (time, environment, customer number).

    The company page is a custom Admin route, not a core page, so this is a section on that page
    rather than a Medusa widget injected into a core zone. It sits next to the NIMBUS-254 "Sync from
    Business Central" action.
12. A button in the section, "Check customer number in DK and NO", looks up the company's current BC
    customer number in both environments and reports the result: found in DK, found in NO, found
    in both, or found in neither. For each environment where the number is found, it shows the BC
    customer's name and country, so the admin can confirm it is the right customer. This read-only
    lookup is the only place that deliberately ignores the routing rule.
13. For each environment where the number is found, the section offers an action "Use this
    customer". The admin picks the environment, and the action:
    - re-reads the BC customer card in that environment on the server and sets the company's
      `country` to the card's country (decision D1);
    - then runs the company sync, which routes on the new country, fetches the card and clears the
      "customer not found" record;
    - and reports the sync result.
14. Found in both environments (the normal case for a Norwegian customer, who is registered in
    both): both matches are shown, without a warning, and each offers "Use this customer". The
    admin picks one, and the action behaves exactly as in requirement 13. Found in neither: the section says so and offers no
    action, because the customer number itself is the likely error.
15. If the card's country would route to a different environment than the one where the customer
    was found (for example a customer held in NO whose card says SE), the section warns before the
    action runs. Until BC is corrected, the company cannot be served stably.
16. An admin can still edit `country` in the Admin company form. That moves the company to the
    other environment until the next sync overwrites the country from the card. This is accepted,
    and the form remains a way to fix a company on the wrong environment.

### Non-functional

- No change to the storefront or to existing store response shapes. The new company fields are
  Admin-only and are not added to the store company projection, which is an allowlist.
- Access tokens and cached BC company names are kept per environment, so a token or name from one
  environment is never used for the other.
- Configuration errors name the environment and the variable, never the URL, tenant, client id or
  secret (as the existing guard does).
- If the Norwegian configuration is missing or invalid, only the Norwegian calls fail, with the
  existing "Business Central unavailable" behaviour. Danish companies are unaffected. This is
  accepted for the production rollout.
- In the two-environment check, an error in one environment is reported as "could not check"
  without hiding the other environment's result.

## Business rules

- A company whose `country` is `NO` (case-insensitive, trimmed) uses the Norwegian BC environment.
  Any other value, including blank, uses the Danish environment. One pure decision function holds
  this rule, and it is registered in `ai/architecture/decisions.md`.
- The environment is derived from the company stored in Medusa, which is looked up from the
  authenticated customer, or from the company id for Admin actions. It is never taken from a value
  the client sends.
- The BC customer number is used unchanged in either environment. The same number always means the
  same customer; Norwegian customers are normally registered in both environments (Klaus Petersen,
  2026-10-27).
- Existing access rules are unchanged. A user sees and returns only their own company's BC orders
  and returns, within the company's environment.
- After the switch, a Norwegian company's orders and returns that exist only in the Danish
  environment no longer show in the portal. The business accepts this.
- A Norwegian company's blank BC currency means NOK. Any other company's means DKK (or the
  configured Danish local currency).
- The order API, order ingestion → BC submission and shipment notices always use the Danish
  environment, whatever the company's country (human's decision, for now).
- The company sync writes `country` from the BC customer card (a BC-managed field), and the next
  call routes on that country.
- "Customer not found" is recorded only when the routed environment answers that no customer has
  that number. The next successful sync clears it.
- Only Admin users may run the two-environment check and "Use this customer". Store customers
  cannot, and no store route exposes the new fields.
- The two-environment check is read-only, so it writes nothing to BC or Medusa. "Use this customer"
  writes only `country` (D1) and then the normal sync fields.
- "Use this customer" is offered for every environment where the number is found, including when
  it is found in both (the admin picks one). Found in neither → no action.
- "Use this customer" always takes the country from the card re-read on the server in the
  environment the admin chose. It warns before running when that country routes to the other
  environment.
- Actor: as with other Admin company edits, no new audit field. The sync writes company fields as
  today (system actor), and a return is created in BC by the integration user, as today.
- Rollout check (settled): before go-live, Klaus confirms which companies move to NO and that
  their customer numbers exist in the Norwegian environment. The check button above also supports
  this.

## Decisions (taken by Klaus Petersen, 2026-10-27)

- **D1. "Use this customer" sets `country` from the BC customer card in the chosen environment.**
  Alternatives rejected:
  - Setting `DK` or `NO` from the environment name is wrong for customers in other countries held
    in DK (SE, DE, ...). The next sync would also overwrite it with the card's country anyway.
  - Running the sync against the found environment without changing the country does not stick,
    because the next sync routes on the old country again.

  Using the card's country is exactly what the next sync would write. The only unstable case is a
  card whose country routes elsewhere, which requirement 15 warns about.
- **D2. The "customer not found" record is stored in three nullable columns on `company`**
  (`business_central_not_found_at`, `business_central_not_found_environment`,
  `business_central_not_found_customer_number`), added with a generated migration in the company
  module. `company` has no `metadata` column, so the alternative (a new `metadata` JSON column)
  would also have needed a migration. Compared with it, the columns:
  - are typed;
  - can be filtered (for example a later "companies not found in BC" list);
  - can be added to or kept out of projections one by one;
  - don't open a free-form bag for unrelated data.

## Data model (draft)

One generated migration in the company module adds the three not-found columns (D2). No other new
entity.

| Item | Meaning | Owner | Written by | Stored / derived | Sensitive | Retention |
|---|---|---|---|---|---|---|
| `company.country` | Routing key: `NO` uses the Norwegian environment | company module | BC company sync (from the card); Admin company form (country select, lower-case `iso_2`); "Use this customer" (D1) | stored | no (part of company contact data) | as today |
| `company.business_central_customer_number` | BC customer number, the same value in either environment | company module | Admin | stored | no | as today |
| `company.currency_code` | NOK for Norwegian companies with a blank BC currency | company module | BC company sync | stored | no | as today |
| `company.business_central_not_found_at` (D2) | When the last sync found no customer in the routed environment; null = not in that state | company module | BC company sync (set on not found, cleared on success) | stored | no | until the next successful sync |
| `company.business_central_not_found_environment` (D2) | `DK` or `NO`: the environment that was searched | company module | BC company sync | stored | no | as above |
| `company.business_central_not_found_customer_number` (D2) | The customer number tried (it may have changed since) | company module | BC company sync | stored | no | as above |
| BC environment of a company | DK or NO | — | — | derived from `country` on each call | no | not stored |
| Two-environment check result | Per environment: found / not found / could not check; customer name and country when found | — | — | derived on request, not stored | name: company data, shown to admins only, not logged | not kept |
| Norwegian BC configuration | Environment URL, BC company GUID, local currency (NOK) | backend env config | operations (Medusa Cloud env vars) | config | URL and tenant: internal; secret shared with DK | — |
| Per-environment token and BC company-name cache | Access token, ODataV4 company name | BC module (in memory) | BC module | in memory | token: secret | token lifetime |

Value format of `company.country`: two writers use different case. The sync writes the BC
country/region code (assumed `NO`), while the Admin form's country select writes Medusa's lower-case
`iso_2` codes (`no`). The rule therefore ignores case and surrounding whitespace. The planner
confirms the stored values against real data.

## Security properties (draft)

These apply because the change touches company authorization scope, Admin actions and personal
data (company contact, VAT and credit data).

| Property | Intended control | Trust root | Failure behaviour |
|---|---|---|---|
| A company's BC data is read only from its own environment | The pure decision function picks the environment from the stored company's `country` | Company record in Medusa, with the customer looked up from the authenticated session | Unknown or blank country → Danish environment (existing behaviour) |
| No cross-company read across environments | Existing customer-number scoping of every BC query, unchanged; the same number is the same customer in both environments | BC customer number on the stored company | A document that does not belong to the customer → 404 as today |
| The client cannot pick the environment | No store request parameter, header or metadata selects it | Server-side company lookup | — |
| The two-environment check and "Use this customer" are Admin-only | Admin routes under `/admin/companies/:id/...` with Admin user authentication (as the NIMBUS-254 sync route) | Medusa Admin session or token | Unauthenticated → 401; unknown company → 404 |
| The check reveals only what is needed | Response per environment: found flag, customer name, country; no address, email, VAT or credit data | — | BC error → "could not check" for that environment only |
| "Use this customer" cannot set an arbitrary country | The server re-reads the card in the chosen environment and takes its country; the client sends only the environment, never the country value | BC customer card | Not found (any more) → 4xx, nothing written |
| Not-found record holds no personal data | Only time, environment code and customer number | — | — |
| Tokens never cross environments | Token and company-name caches keyed per environment | BC module | Wrong or expired token → BC 401 → existing error handling |
| Tests never touch production BC | The guard checks every configured environment against the allowlist (TestDK, TestNO) | `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` | Any environment not on the list → tests refuse to run |
| No personal data or secrets in logs | Errors log company id, environment name and outcome only; never the customer name or card | — | as today |

Security work adds negative cases (store customer and unauthenticated calls to the new Admin routes)
to `integration-tests/http/security/security-boundaries.spec.ts`.

## Affected apps

- **Backend** (`apps/backend`):
  - the Business Central module: configuration per environment, per-environment token and name
    caches, and methods that take an environment;
  - the company module: model and migration for D2;
  - the store BC order and return routes and the BC return workflow steps;
  - the company BC sync step and workflow (not-found record);
  - new Admin routes and a workflow for the two-environment check and "Use this customer";
  - the order-submission and shipment-notice steps (explicit DK);
  - the test-environment guard and `.env.template`.
- **Admin UI** (inside `apps/backend/src/admin`): the "Business Central customer" section on the
  company detail page, next to the NIMBUS-254 sync action.
- **Medusa Cloud:** new environment variables for the Norwegian connection, per stage.
- **Docs:** `ai/architecture/decisions.md` registers the country → environment rule, and
  `docs/architecture/` is updated for the BC integration area after shipping.

## Proposed structure

High-level task breakdown. The planner decides the final split.

1. Read-only probe of TestNO. Confirm that the custom customer-portal API, the return-reason set,
   sales orders and the `PostedReturnReceipt*` web services are published. Record the NO BC company
   GUID and ODataV4 company name, and the card country and currency of a sample Norwegian customer.
   Record this as evidence before dispatch.
2. Per-environment BC configuration and connection in the BC module: DK and NO sets, shared
   credentials, per-environment token and company-name caches, and NOK as the NO local currency.
   The test guard checks both environments.
3. The pure decision function company country → environment, unit-tested and registered in the
   business-rule registry.
4. Route BC order history, the returns list and detail, and return reasons per company.
5. Route return creation (prepare and submit steps) per company.
6. Route the BC company sync per company, including NOK for a blank currency. Record and clear the
   "customer not found" state (model columns and migration, D2).
7. Admin routes and workflow: the two-environment check (read-only), and "Use this customer" (set
   the country from the card, then sync). Add the security negative cases.
8. The Admin "Business Central customer" section on the company page.
9. Pin the order API / order submission and shipment-notice paths to DK explicitly. Adjust the
   existing tests that set the global BC env vars.
10. Configuration and documentation: `.env.template`, Medusa Cloud variables per stage, docs.

## Open questions

- The customer-portal extension is not deployed in TestNO/ProductionNO (probe 2026-10-27). Build
  proceeds; the parts that need it are verified after deployment to TestNO, and production go-live
  of NO routing waits for it in ProductionNO (Klaus Petersen, 2026-10-27).

Resolved (human's answers):
- Norwegian companies' DK-only orders and returns disappearing from the portal is acceptable.
- The Norwegian currency is NOK.
- Both countries use the same Entra tenant and app registration.
- The same customer number is the same customer in DK and NO.
- Routing uses `company.country`; no new routing field.
- Klaus checks which companies move to NO, and that their numbers exist there, before go-live.
- An Admin edit of `country` moving a company between environments until the next sync is
  accepted, and is a way to fix a company on the wrong environment.
- With the NO settings missing in production, only Norwegian calls fail.
- D1 and D2 as recorded under Decisions.
- A customer number found in both environments (normal for a Norwegian customer) can be used from
  either; only "found in neither" has no action.

## Dependencies

- Access to TestNO (and ProductionNO for go-live) with the existing app registration, and the NO BC
  company GUID per stage.
- NIMBUS-254 (Admin "Sync from Business Central") is on `develop`. The new section and routes build
  on its company page, actions menu and sync route.
- Medusa Cloud environment variables for the Norwegian connection, per stage.

## Documentation

- [docs/architecture/business-central-environments.md](../../docs/architecture/business-central-environments.md) — BC environments: configuration, routing rule, account workflow, callers per environment, configuration-error answers (created)
- [docs/architecture/business-central-company-sync.md](../../docs/architecture/business-central-company-sync.md) — Company sync per environment, NOK fallback, "customer not found" record, Admin "Business Central customer" section and routes (updated)
- [docs/architecture/business-central-order-detail.md](../../docs/architecture/business-central-order-detail.md) — Order detail and returns read and created in the company's environment; error answers (updated)
- [docs/architecture/business-central-order.md](../../docs/architecture/business-central-order.md) — Order submission always on DK (updated)
- [docs/architecture/order-api/shipment-notices.md](../../docs/architecture/order-api/shipment-notices.md) — Shipment notices always on DK; per-environment token cache (updated)
- [docs/architecture/admin-page-layout.md](../../docs/architecture/admin-page-layout.md) — `business-central-customer` entry (updated in task 07)

AI base files updated: `ai/skills/medusa-infra-adapter/project.md` (environment argument convention, link to the environments doc). `ai/architecture/decisions.md` and `verification.md` were updated earlier on the branch.
