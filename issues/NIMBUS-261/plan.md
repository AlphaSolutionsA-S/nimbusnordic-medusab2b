# Plan: Norwegian companies use the Norwegian Business Central for returns, order history and company sync

**Key:** NIMBUS-261 · **Branch:** `feature/NIMBUS-261` from `develop` · **Date:** 2026-10-27
**Scope:** [scope.md](./scope.md) (approved by Klaus Petersen, 2026-10-27, commit 1a40be8; amended 2026-10-27: same number = same customer, extension status)
**Plan approved:** Klaus Petersen, 2026-10-27, with every section 2 item answered

## 1. Summary [High]

The backend gets a second Business Central (BC) connection, for the Norwegian environment, beside
the Danish one. Every BC call now names its environment. The customer-portal calls made for a
company (BC order history, returns and return reasons, return creation and the company sync) pick
the environment from the company's stored `country`: `NO` goes to Norway, everything else to
Denmark. The order API, order submission and shipment notices name Denmark explicitly. The company
sync also records "customer not found" on the company. A new "Business Central customer" section on
the Admin company page shows the routed environment and that record, checks the customer number in
both environments, and offers "Use this customer".

Three decisions shape the design:

- **The environment is a required argument of every BC call.** No call can reach BC without
  choosing DK or NO, so nothing falls back to Denmark silently. Task 01 changes the signatures and
  passes `DK` everywhere. Tasks 03 to 05 then switch the in-scope callers to the routed environment.
- **One rule, one workflow to resolve it.** A pure function maps a country to an environment. A
  small workflow looks up the company (from the logged-in customer or from a company id) and returns
  its customer number and environment. Store routes, return creation and the Admin section use that
  workflow, so no route holds the rule.
- **"Customer not found" stays `skipped` on the outside.** The sync writes the record but still
  returns `skipped`, so the store and Admin sync responses do not change shape.

The TestNO probe has run (results: [samples/probe-results-2026-10-27.md](./samples/probe-results-2026-10-27.md)).
Everything the build depends on is confirmed, except the customer-portal extension, which is not yet
deployed to the Norwegian environments. Klaus decided to build now anyway. The parts that need the
extension are verified once it reaches TestNO, and Norwegian routing goes live in production only
after the extension is in ProductionNO and the probe passes there (section 10).

How to review this plan: approving it is the human gate that allows dispatch. Each section heading
gives its review level. The `Critical` flags are in section 2 (an exposure question and a test
question), section 9 (what stays unverified until the extension is deployed) and section 10 (the
go-live gate). Data model and state tables are rated High because past misses were
found there. The task files add depth but you don't need to read them. A question is often quicker
to settle by asking the planning agent in chat.

## 2. Needs your decision [Critical]

1. **Answered: TestNO probe and the customer-portal extension.** The probe ran on 2026-10-27
   ([samples/probe-results-2026-10-27.md](./samples/probe-results-2026-10-27.md)). Confirmed:
   TestNO has one company (`TEST-Nimbus NORGE-TEST`) and the standard API without a company
   segment resolves to it; the standard API (`customers`, `salesOrders`, `salesInvoices`,
   `salesReturnOrders`), ODataV4 `PostedReturnReceipt` and its lines, and the shared credentials
   work; customer cards carry the currency `NOK`. Not deployed in TestNO: the customer-portal
   extension (custom API `abakion/customerPortal/v2.0`, ODataV4 `CS_EnabledReasonCodes`, action
   `CustomerPortalReturns_CreateReturnOrder`).
   **Answer (Klaus Petersen, 2026-10-27):** do not block dispatch on the extension. Build now. What
   needs the extension (creating a return, open return order detail, reservations on order detail,
   return reasons) is verified after the extension is deployed to TestNO. Norwegian routing goes
   live in production only when the extension is in ProductionNO and the probe passes there
   (section 10). TestNO's blank customer countries are test data, not a design problem: production
   is clean (ProductionNO: 292 of 301 cards `NO`).
2. `Critical` **The new not-found columns reach company admins through two existing store
   responses.** The store company profile is an allowlist, but `GET /store/approvals` returns each
   cart's company with all columns (`carts.company.*`), and the store employee create and update
   responses return `*company`. Both already return the credit limit and blocked state this way.
   The three new columns (time, `DK`/`NO`, the company's own customer number) would appear there
   too, to an admin of that company only. Narrowing those wildcards changes existing store response
   shapes, which the scope rules out. *Default:* accept. The values are the company's own and hold
   no personal data. The plan records the exposure, and narrowing the wildcards becomes a separate
   issue if you want it.
   **Answer (Klaus Petersen, 2026-10-27):** accepted.
3. **How the backend cases get verified.** Contract and integration cases may not run in this
   checkout: `apps/backend/.env` now exists (TestDK settings), but no Postgres answered on
   `localhost:5432` when planning, and NIMBUS-236 (login returns 401) breaks
   `security-boundaries.spec.ts` and `companies.spec.ts`. Unit tests, Admin UI tests, lint and
   typecheck do run. *Default:* the rule
   used for NIMBUS-243 and NIMBUS-254. Workers write the cases. At finalization the dispatcher runs
   the touched specs. If the run aborts for the missing environment, or a touched case fails only
   with 401 on login, the deviation report records those cases as "code complete, unverified
   because <reason>". Any other failure in a touched case blocks. The after-deploy checks in the
   task files are the proof.
   **Answer (Klaus Petersen, 2026-10-27):** accepted as the default.

## 3. Flows [High]

### A. A Norwegian company's user reads BC orders or returns (tasks 01, 02, 03)

1. The storefront calls a store BC route (`/store/bc-orders`, `/:id`, `/store/bc-returns`,
   `/:number` or `/store/bc-orders/return-reasons`) with the customer's session.
2. Medusa admits only an authenticated customer, as today.
3. The route runs the account workflow with the customer id from the session. It loads the
   customer's company and returns its customer number and environment. `country` `NO` (any case,
   trimmed) gives `NO`; anything else, or no company, gives `DK`.
4. A route that needs a customer number answers 400 when there is none, as today. Return reasons
   need only the environment.
5. The route calls the BC module with the environment and the customer number. The module uses
   that environment's discovery URL, BC company GUID and ODataV4 company name.
6. The response has the same shape as today. A blank currency on a return becomes the environment's
   local currency (NOK for Norway).
7. If the NO configuration is missing or invalid, the call fails as a misconfigured DK call fails
   today. Danish companies are unaffected.
8. Until the customer-portal extension is deployed in the NO environment, the calls that need it
   fail there with the existing BC error: return reasons and the detail of an open return order.
   Order detail still loads without reservations (today's fallback logs a warning), and the order
   list, return list and posted-receipt details work. No code handles this case specially; the
   production go-live gate in section 10 keeps it from reaching Norwegian users.

### B. A Norwegian company's user creates a return (tasks 01, 02, 04)

1. The storefront posts the return lines to `/store/bc-orders/:id/returns`.
2. The route resolves customer number and environment (A3, A4).
3. The return workflow reads the source order in that environment and validates the lines against
   it, as today.
4. It creates the return order in the same environment with the same request id rule as today.
5. Error answers (400, 404, 503, 500) are unchanged.
6. Until the extension is deployed in the NO environment, creating the return fails there with the
   existing 500 answer (A8).

### C. The company sync runs (tasks 01, 02, 05)

1. A trigger starts the sync, as today: login, the stale store company read, the store "sync now"
   route or the Admin "Sync from Business Central" action.
2. The prepare step loads the company with its customer number and `country`, and picks the
   environment from the country.
3. No company or no customer number: `skipped`, no BC call, no write (as today).
4. BC fails or is unreachable: `failed`, no write (as today).
5. BC answers that no customer has that number: the step writes the not-found record (now, the
   environment, the number tried), overwriting any earlier one. The workflow returns `skipped`.
6. BC returns the card: the 12 BC-managed fields and `business_central_synced_at` are written as
   today, and the not-found record is cleared. A blank card currency becomes the environment's
   local currency (DKK or NOK).
7. The next call routes on the `country` just written from the card.

### D. An admin checks and fixes a company's BC customer (tasks 06, 07)

1. The admin opens `/app/companies/:id`. The "Business Central customer" section loads the routed
   environment and any not-found record from a new Admin route.
2. The admin clicks "Check customer number in DK and NO". The section is disabled when the company
   has no customer number.
3. The lookup route reads the customer card in DK and in NO in parallel, ignoring routing. Each
   environment answers found (name and country), not found, or could not check. An error in one
   environment does not hide the other.
4. For each card found, the backend also says which environment its country routes to and whether
   that differs from where it was found.
5. The section shows the results. Found in both is the normal case for a Norwegian customer: the
   same customer number is the same customer, registered in both environments. The section shows
   both and the admin picks one, with no warning. Found in neither: a note and no action.
6. For each found result, "Use this customer" is offered. When the card's country routes
   elsewhere, the section warns and asks for confirmation first.
7. The action posts only the chosen environment. The server re-reads the card there; if it is
   gone, it answers 404 and writes nothing.
8. The server sets `country` to the card's country, then runs the company sync (C2 to C7), which
   now routes on that country.
9. The response gives the sync outcome and the country written. The section shows it and reloads
   the company and the section data.

## 4. What gets built [High]

### 01. Business Central connection per environment

The BC module (L2) learns two environments, `DK` and `NO`. A small configuration file in the module
reads each environment's discovery URL, BC company GUID and local currency. DK keeps today's
variable names and defaults (TestDK URL, DKK). NO uses `BUSINESS_CENTRAL_NO_DISCOVERY_URL`,
`BUSINESS_CENTRAL_NO_COMPANY_ID` and `BUSINESS_CENTRAL_NO_LCY_CODE` (default NOK) and has no
default URL: a missing NO setting fails only NO calls. The client id and secret stay shared. Error
messages name the variable and environment only. Every public module method except the disabled
`getOperations` takes the environment as its first argument. The ODataV4 company name and the
blank-currency fallback on return details come from that environment. The existing shipment-read
token and company-name cache is kept per environment. Other calls keep requesting a token per call,
as today. Every caller passes `DK` for now: the store BC routes, both return steps, the company sync
step, the order-submission prepare and submit steps, and the two shipment-notice steps. The
order-submission and shipment-notice callers stay on `DK` permanently. The integration-test guard
also checks the NO discovery URL when it is set, and the default allowlist becomes
`TestDK,TestNO`. `.env.template` documents the NO variables.

### 02. Country → environment rule and the account workflow

A pure decision function (L5) maps a company country to `DK` or `NO`: `NO` after trimming and
ignoring case, anything else (blank included) `DK`. It is registered in the business-rule
registry. A workflow (L4) with one query step (L3) resolves a BC account from either the
authenticated customer id (through the employee's company) or a company id. It returns the company
id, customer number, environment and the stored not-found record. An unknown company id is a 404.
A customer without a company resolves to no number and `DK`.

### 03. Store BC reads routed per company

The five store BC read routes (L6) run the account workflow instead of their own customer query and
pass its environment to the BC module. The return-reasons route starts resolving the customer for
this. Response shapes, the 400 for a missing customer number and the 404s stay as they are.

### 04. Return creation routed per company

The return route resolves the account (task 02) and passes the environment into the return
workflow (L4). The prepare step reads and validates the source order in that environment, and the
submit step creates the return order there. Validation, request id and error mapping are
unchanged.

### 05. Company sync routed, NOK, and the not-found record

The company data model (L0) gets three nullable columns: `business_central_not_found_at`,
`business_central_not_found_environment` (`DK`/`NO`) and
`business_central_not_found_customer_number`, with a generated migration. The company types gain
them. The sync prepare step (L3) loads `country`, routes the BC read and resolves a blank currency
to the environment's local currency. When BC has no such customer it returns a new internal outcome
that writes the not-found record. A found customer's update also clears the record. The sync
workflow (L4) writes in both cases and still reports `skipped` for not found, so the store and
Admin responses keep their values. The order submission's currency override keeps resolving with
DK. No store projection gets the new columns.

### 06. Admin routes: status, two-environment check, "Use this customer"

Three Admin routes (L6) under `/admin/companies/:id/business-central-customer`, behind Medusa's
default Admin authentication. The status route returns the routed environment, customer number and
not-found record (account workflow by company id). The lookup route runs a read-only workflow
whose step reads the card in both environments in parallel and reports per environment found, not
found or could not check. For a found card it gives only the name and country, plus where that
country routes and whether that differs. It logs company id and environment only. The use route
accepts only `{ environment }`. Its workflow re-reads the card there (404 and no write when it is
gone), writes `country` from the card, then runs the company sync as a nested workflow and returns
its outcome and the country. Security negatives for all three routes join the security spec.

### 07. Admin "Business Central customer" section

A new section on the Admin company page (a `LayoutComposer.Entry` with a fixed id, below company
information and next to the existing sync action in the menu) with data hooks over the three
routes. It shows the routed environment and the not-found record, the check button (disabled
without a customer number), per-environment results with name and country (found in both is
normal and shows two choices without a warning; found in neither shows a note), the routes-elsewhere warning with a confirmation, "Use this customer" per found
environment, and a toast with the outcome. After the action it refreshes the company and the
section.

## 5. Data model [High]

| Item | Meaning | Existing callers | Owner | Written by | Stored / derived | Encrypted | Mutable until | Retention, deleted by | Index |
|---|---|---|---|---|---|---|---|---|---|
| `company.country` | BC routing key; `NO` (any case, trimmed) → NO environment | sync step, Admin form, store company read/projection, Admin page | company module | BC sync (card value, e.g. `NO`); Admin company form (`iso_2`, lower case, e.g. `no`); "Use this customer" (card value) | stored | no | always | company lifetime | none |
| `company.business_central_customer_number` | BC customer number; the same number is the same customer in either environment (a Norwegian customer is normally registered in both) | store BC routes, return workflow, sync step, order API | company module | Admin | stored | no | always | company lifetime | none (unchanged) |
| `company.currency_code` | blank BC currency → environment local currency (DKK / NOK) | store projection, Admin page, spending limits | company module | BC sync | stored | no | next sync | company lifetime | none |
| `company.business_central_not_found_at` (new) | when the last sync found no customer in the routed environment; null = not in that state | none (new) | company module | sync workflow (set on not found, null on success) | stored, `dateTime`, nullable | no | next sync | until the next successful sync clears it; company delete | none |
| `company.business_central_not_found_environment` (new) | environment searched: `DK` or `NO` | none (new) | company module | as above | stored, enum `DK`/`NO`, nullable | no | next sync | as above | none |
| `company.business_central_not_found_customer_number` (new) | customer number tried, kept because the number may change afterwards | none (new) | company module | as above | stored, text, nullable | no | next sync | as above | none |
| Company BC environment | `DK` or `NO` | — | — | — | derived from `country` on each call | — | — | not stored | — |
| Lookup result | per environment: found / not found / could not check; name, country, routes to, routes elsewhere | — | — | — | derived per request | — | — | not kept, not logged | — |
| NO BC configuration | discovery URL, company GUID, local currency | — | backend env | operations (Medusa Cloud per stage) | config | secret is the shared DK secret | deploy | — | — |
| Shipment-read token and company-name cache | access token and ODataV4 name, per environment | shipment steps (DK only) | BC module, in memory | BC module | memory | — | token lifetime | process restart | — |

The three not-found columns are written together and cleared together, always by the sync
workflow's single company update. "Use this customer" never writes them directly. A company has at
most one not-found record; there is no history.

## 6. Business rules as state tables [High]

### Company BC link (the not-found record)

| Current state | Event | Outcome | Side effects on other rows and sessions | Actor recorded |
|---|---|---|---|---|
| any | sync, no company or no customer number | `skipped`; nothing written | none | — |
| any | sync, BC error or missing configuration for the routed environment | `failed`; nothing written | none | — |
| clear or not found | sync, routed environment has no customer with the number | not found: time, environment, number overwritten; outcome `skipped` | none; BC-managed fields and `business_central_synced_at` untouched | system (sync); no audit field |
| clear or not found | sync, card found | clear (3 columns null); 12 BC-managed fields and `business_central_synced_at` written | next BC call routes on the new `country` | system (sync) |
| any | Admin edits `country` in the form | record unchanged; routing moves until the next sync overwrites `country` | next store BC call goes to the other environment | Admin user (no audit field, as today) |
| any | Admin edits the customer number | record unchanged (it keeps the number tried) | next sync uses the new number | Admin user |
| any | "Use this customer" (env E): refused unless the card for the current number exists in E | `country` := card country, then sync (rows above) | routing follows the card's country; may route away from E (warned) | Admin user writes `country`; sync as system |
| any | two-environment check | nothing written | none (read-only) | — |

### Return order in BC (unchanged except the environment)

| Current state | Event | Outcome | Side effects |
|---|---|---|---|
| source order in the company's environment | create: refused unless the order is found there for the customer number and the lines and quantities are valid | return order created in that environment | none in Medusa |
| source order only in the other environment | create | 404 "Order not found." | none |

Write permissions: store routes read only, scoped to the session customer's own company; only Admin
users reach the three new routes; no client value chooses the environment.

## 7. Security-property matrix [Critical]

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| A company's BC data is read only from its own environment | account workflow derives the environment from the stored company of the session customer; pure rule | Medusa session → customer → employee → company | blank or unknown country → DK (existing behaviour) | integration: a `NO` company's store reads and return reach the BC module with `NO`, a `DK`/blank one with `DK` (tasks 03, 04) |
| The client cannot choose the environment | no store parameter, header or body field selects it; validators unchanged | server-side lookup | — | integration: an extra `environment` query or body field on a store BC route is rejected by the existing strict validators or ignored, and the call still goes to the company's environment (task 03) |
| No cross-company read in either environment | existing customer-number filter on every BC query, unchanged | stored customer number | foreign document → 404 as today | existing cases in `security-boundaries.spec.ts` keep passing |
| New Admin routes are Admin-only | routes under `/admin`; Medusa's default Admin authentication | Admin session, bearer or secret API key | unauthenticated or store customer → 401; unknown company → 404 | security spec: none / customer / publishable credentials on all three routes → 401, and the BC module is not called and the company row is unchanged (task 06) |
| "Use this customer" cannot set an arbitrary country | strict body `{ environment: "DK" | "NO" }`; country only from the card re-read on the server | BC customer card | extra field or other value → 400; card gone → 404, nothing written | contract: `{ environment, country }` → 400; card missing → 404 and `country` unchanged (task 06) |
| The lookup reveals only what is needed | per environment: found flag, name, country, routes to, routes elsewhere | — | BC error → `could_not_check` for that environment only | contract: response has no address, email, VAT or credit field; one environment failing leaves the other's result (task 06) |
| Not-found record holds no personal data | only time, environment code, number | — | — | unit/integration: the update contains exactly the three columns (task 05) |
| New columns not in store responses by design | not in the store company projection or store query configs | allowlists | exposed to company admins through two existing wildcards (section 2, item 2) | contract: `GET /store/companies/:id` has none of the three fields (task 05) |
| Tokens and company names never cross environments | shipment token cache keyed by environment; other calls get a token per call | BC module | wrong token → BC 401 → existing errors | unit: a cached DK token and company name are not used for a NO call (task 01) |
| Tests never touch production BC | guard checks the DK URL and, when set, the NO URL against `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` (default `TestDK,TestNO`) | allowlist | any other environment → the run aborts | unit: `ProductionNO` as NO URL aborts; unset NO URL passes; message has no URL or tenant (task 01) |
| No secrets or personal data in logs or config errors | errors name the variable and environment; logs carry company id, environment, outcome | — | — | unit: NO configuration errors contain no URL, tenant, client id or secret (task 01) |

## 8. Decisions [High / Medium]

### New in this plan

- **Environment is a required first argument of every BC module method** (except `getOperations`,
  which only the disabled operations route used). Why: a forgotten caller fails to compile instead
  of silently using DK. Source: scope requirement 4 ("explicitly rather than by default").
- **DK keeps today's variable names; NO gets `BUSINESS_CENTRAL_NO_DISCOVERY_URL`,
  `BUSINESS_CENTRAL_NO_COMPANY_ID`, `BUSINESS_CENTRAL_NO_LCY_CODE` (default NOK).** Why: no change
  to existing Medusa Cloud variables. NO has no default URL, so a missing setting fails NO calls
  instead of reaching another environment.
- **No new token cache.** Only the existing shipment-read cache is keyed per environment; other
  calls keep one token request per call. Why: the scope's "per environment" requirement is met
  without new caching behaviour.
- **The standard API URL pattern is kept**: calls such as `customers`, `salesOrders` and
  `salesInvoices` stay without a `companies(...)` segment and rely on BC's default company, as in
  DK today. Verified for TestNO (one company). ProductionDK holds two companies (`CRONUS Danmark
  A/S` and `Nimbus Nordic A/S`), so production relies on BC's default company being Nimbus; the
  go-live probe of both production environments checks it (section 10).
- **An account workflow, not a route helper, resolves customer number and environment.** Why:
  `layers.md` lets a route call workflows and Query, not a decision function. One workflow also
  serves the store routes, return creation and the Admin status route.
- **Not found is reported as `skipped`.** The sync workflow writes the record but keeps its three
  outcome values. Why: the store and Admin sync responses and their toasts keep their meaning
  (`docs/architecture/business-central-company-sync.md`, "A new outcome").
- **`business_central_not_found_environment` is an enum `DK`/`NO`**, the same wire values as the
  environment type and the Admin routes.
- **"Use this customer" keeps `country` when the following sync fails.** The value came from the
  card just read, and the sync outcome is shown to the admin. The update step's own compensation
  restores it only if the workflow itself fails.
- **Three Admin routes**: `GET …/business-central-customer` (status), `GET …/lookup` (read-only
  check), `POST …/use`. The lookup is a GET because it changes nothing.
- **The routes-elsewhere verdict is computed in the backend** and sent as a flag, so the Admin UI
  holds no copy of the routing rule.

Does the framework already do this? Medusa has no multi-connection or vendor-routing primitive; the
BC module is our own client. Reused as they are: `updateCompaniesStep` (with its compensation), the
sync workflow through `runAsStep`, Medusa's default `/admin` authentication and the error-type to
HTTP-status mapping. No framework internal is called directly.

### From the scope

- D1: "Use this customer" sets `country` from the card in the chosen environment, re-read on the
  server.
- D2: three nullable columns on `company`, generated migration.
- Routing on `company.country`; `NO` → Norway, else Denmark.
- The same BC customer number always means the same customer. Norwegian customers are normally
  registered in both environments (ProductionNO: 299 of 301 numbers also exist in ProductionDK), so
  "found in both" is the normal lookup result: no uniqueness warning, the admin picks the
  environment (Klaus Petersen, 2026-10-27; corrects the scope's "numbers are unique" wording, see
  the proposed scope amendment in `PROGRESS.md`).
- Order API, order submission and shipment notices stay on DK.
- DK-only history of Norwegian companies disappears from the portal (accepted).
- A missing NO configuration fails only NO calls (accepted).
- Admin edits of `country` move the company until the next sync (accepted).

## 9. Framework assumptions [Critical]

Two rows stay `UNVERIFIED` and do not block dispatch: the customer-portal extension in NO (Klaus
Petersen's decision, section 2 item 1; it gates production go-live instead) and the stored case of
`company.country` (the rule ignores case).

| Primitive | Relied on | Status |
|---|---|---|
| BC standard API v2.0 without a `companies(...)` segment | resolves to the environment's default company, the Nimbus Nordic company | verified for TestNO and TestDK (probe 2026-10-27: one company each, unscoped = scoped). Production: ProductionDK has two companies, ProductionNO one; checked by the go-live probe (section 10). |
| NO company GUID and ODataV4 company name | TestNO `223f0db0-7884-ee11-8178-002248dd26d9`, `TEST-Nimbus NORGE-TEST`; ProductionNO `7f27d3c6-0a95-ee11-be36-002248754d45`, `Nimbus Nordic Norge` | verified (probe and production count script, 2026-10-27). Values for `BUSINESS_CENTRAL_NO_COMPANY_ID` per stage. |
| Standard API `customers`, `salesOrders`, `salesInvoices`, `salesReturnOrders`; ODataV4 `PostedReturnReceipt`, `PostedReturnReceiptReturnRcptLines` in TestNO | published, same shape as DK | verified for availability (200, probe 2026-10-27); shape assumed equal to DK (same standard objects). |
| Customer-portal extension in NO: custom API `abakion/customerPortal/v2.0` (`salesReturnOrders`, `salesOrderReservationEntries`), ODataV4 `CS_EnabledReasonCodes`, action `CustomerPortalReturns_CreateReturnOrder` | published under the NO company | `UNVERIFIED`: not deployed in TestNO (404, absent from `$metadata`). Not blocking dispatch (Klaus Petersen, 2026-10-27). Verified after deployment to TestNO; blocks production go-live of NO routing (section 10). |
| BC card `country` for Norwegian customers | exactly `NO` | verified: ProductionNO 292 of 301 cards `NO` (6 `DK`, 3 blank); ProductionDK 300 cards `NO`; TestNO 2 `NO`, 205 blank (test data). |
| Blank BC currency in NO resolves to NOK | fallback only | verified harmless: every TestNO and ProductionNO card carries `NOK`, so the fallback is rarely used. |
| Stored `company.country` case in Medusa | sync writes the BC code (upper case), Admin form writes `iso_2` (lower case) | `UNVERIFIED` against the Medusa database (none reachable when planning). Code evidence: `prepare-company-bc-sync.ts` writes `bcCustomer.country` unchanged; `company-form.tsx` uses region `iso_2`. Non-blocking: the rule ignores case and whitespace. The rollout check reads `select country, count(*) from company group by country` in production. |
| Same Entra tenant and app registration for NO | one token request works for both | verified (probe ran TestNO with the DK credentials and tenant, 2026-10-27). |
| Medusa `runAsStep` of a custom workflow inside a workflow | nested sync runs after the country update committed | verified in repo use: `workflows/approval/workflows/update-company-approval.ts`; step reuse with `.config({ name })`: `workflows/shipment-notice/workflows/discover-shipments.ts`. |
| `MedusaError` type → HTTP status (`NOT_FOUND` 404, `INVALID_DATA` 400) | Admin and store error answers | verified: `docs/architecture/business-central-company-sync.md` and the NIMBUS-254 Admin sync contract tests. |
| Medusa default `/admin` authentication | new Admin routes need no own middleware | verified: NIMBUS-254 security cases in `security-boundaries.spec.ts`. |
| `medusa db:generate company` | generates the three columns only | to check by the worker: the company migrations folder holds stray `.snapshot-*.json` files (`medusa-module-and-data` `project.md`), so the generated file must be read and contain only these columns. |

## 10. Open risks and gates [Medium; Critical for blocking items]

| Item | Owner | Blocking |
|---|---|---|
| `Critical` Customer-portal extension deployed to TestNO, the probe re-run there, then the after-deploy checks that need it (return creation, open return detail, reservations on order detail, return reasons) | Klaus Petersen (deployment: BC partner) | no, for dispatch; yes, for verifying those parts |
| `Critical` Production go-live of NO routing: extension deployed to ProductionNO and the probe passing there (`PROBE_ALLOW_PRODUCTION=1`); the probe also run against ProductionDK to confirm the unscoped standard API resolves to `Nimbus Nordic A/S`, not `CRONUS Danmark A/S` | Klaus Petersen | yes, for go-live |
| TestNO test data: 205 of 207 TestNO customer cards have a blank country. Before the after-deploy checks in TestNO, fill the country on the test customers used, or use the two cards with `NO` | Klaus Petersen | yes, for after-deploy verification in TestNO |
| Medusa Cloud variables `BUSINESS_CENTRAL_NO_DISCOVERY_URL`, `BUSINESS_CENTRAL_NO_COMPANY_ID`, `BUSINESS_CENTRAL_NO_LCY_CODE` per stage, and `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` where tests run | operations / Klaus | yes, for go-live (not for dispatch); without them NO companies get BC errors |
| Rollout check: which companies move to NO, their numbers exist in ProductionNO, stored `country` values. Known from BC counts: 4 of the 300 ProductionDK cards with country `NO` have no ProductionNO card; those companies would route to NO and get a not-found record after their next sync | Klaus Petersen | yes, for go-live |
| Return reasons other than `NORMAL` stay rejected (NIMBUS-138), now in both environments | — | no |
| A card whose country routes elsewhere keeps the company unstable until BC is corrected (warned in the Admin section) | business | no |
| Integration and contract cases may stay unverified locally (section 2, item 3) | dispatcher | no, per the default rule |
| `docs/architecture/business-central-company-sync.md` and the BC docs describe one environment | `documentation-writer` after ship | no |
