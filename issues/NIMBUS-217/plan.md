# Plan: Only companies enabled for the order API can place orders and receive shipment notices

**Key:** NIMBUS-217 · **Scope:** `scope.md` (approved 2026-10-23) · **Branch:** `feature/NIMBUS-217` from `develop`

## 1. Summary [High]

A company gets a stored setting, `order_api_enabled`, off by default for every company. Staff switch
it in Medusa Admin. The order API's shared company-resolution step reads it on every request:
an unknown customer number stays 404, a known company with the setting off gets 403 "Customer not
registered for the order API" before anything is created or read. The Business Central shipment job
stops finding shipments for switched-off companies, closes their open tracking with a new close
reason when each row next comes due, and the Admin retry refuses them.

Three decisions shape it: the check lives in the one step both endpoints already share, so there
is one place to get wrong; the rule "enabled for the order API" is one pure function that every
consumer calls (R15); and nothing is cached, so a switch takes effect at the next request or job run.

**How to review this plan.** This plan is the human review gate: approving it is what allows
dispatch. Each heading carries a review level (Critical, High, Medium). Answer everything under
"Needs your decision" (all answered) and stop at each `Critical` flag (the intake race in
section 6 and the security matrix).
The data model and state tables are rated High because past misses were found there. The task
files hold more depth but are not required reading. An uncertainty is often quicker to settle by
asking the planning agent in chat than by reading further.

## 2. Needs your decision [Critical]

All five answered by Klaus on 2026-10-23; dispatch waits only for plan approval.

1. **O1, go-live list.** *Default:* a read-only aid query in the PR description.
   **Answer:** the system is not in production ("vi er ikke live - jeg tester"); Klaus switches
   companies on himself while testing. No aid query; O1 and the go-live gap do not apply now.
2. **Go-live gap (R13), one-off auto-enable script.** *Default:* no script.
   **Answer:** no script; manual switch-on in Admin only.
3. **O2, Logic App and 403.** *Default:* non-blocking, settle before production.
   **Answer:** Klaus handles it himself outside this repo (NIMBUS-178); closed for this plan.
4. **When open tracking of a switched-off company closes (R6).** *Default:* when the row next
   comes due (normally within 15 minutes, up to 6 hours in failure back-off), no BC read.
   **Answer:** agreed.
5. **R12 vs two wildcard store reads** (approvals list `carts.company.*`, store quotes
   `*customer.employee.company`), which show the caller's own company's flag read-only.
   *Default:* accept. **Answer:** accepted; R12 reads "not writable from the storefront, not
   returned by the store company endpoints"; those two reads are unchanged.

## 3. Flows [High]

### A. Order intake (task 03)
1. The Logic App posts an order with `customerNumber`; the query and body are validated as today (400 on failure).
2. The shared step looks up the company by `business_central_customer_number`; none → 404 "Customer not found" (unchanged).
3. The same step reads the company's `order_api_enabled` and asks the rule; off → 403 "Customer not registered for the order API". The log line carries the company id only.
4. Only for an enabled company: duplicate check (422), order, company link and external reference are created as today, then 201.

### B. Shipment notices read (task 03)
1. The Logic App requests notices with `customerNumber`; the query is validated (400).
2. Resolve the company and refuse unknown (404) or switched-off (403) companies (A2–A3).
3. Only for an enabled company: stored notices are read and returned (200). Notices stored before a switch-off are kept and served again once the company is switched back on (R8).

### C. Shipment discovery (task 04)
1. The 15-minute job scans posted Business Central shipment headers as today; no extra Business Central request.
2. For each window, the companies behind the headers' customer numbers are read with their setting; switched-off companies are dropped by the rule before candidate orders are matched.
3. Headers of switched-off companies are not tracked; the cursor moves past them, so they are never back-filled (R7).

### D. Shipment check run (task 04)
1. The run selects up to 200 due open tracking rows as today and reads each row's company setting in one query.
2. A row whose company is switched off (or no longer exists) is closed with reason `company_not_enabled`, without a Business Central read.
3. Every other row is checked as today (superseded, Business Central read, store, reschedule or close).
4. A closed row is never reopened by switching the company back on (R9); only new shipments are discovered.

### E. Admin retry of a gave-up shipment (task 05)
1. Staff press Retry on a gave-up row in Admin.
2. The workflow reads the row's company setting; switched off → 400 "The company is not enabled for the order API", shown in the existing error toast, row unchanged.
3. Otherwise the row is reopened as today (404 unknown row, 400 not gave-up).

### F. Staff change the setting (tasks 01, 02)
1. Staff open a company in Admin; the detail shows "Order API: Enabled/Disabled".
2. In the edit drawer, staff flip the switch and save; the Admin update route stores the boolean. Creating a company never sets it (stays off).
3. The next order API request or job run reads the new value (N3).

## 4. What gets built [High]

**01. Company setting.** A new stored boolean on the company data model (L0), off by default, with
a generated migration that gives every existing company `false`. The Admin company update request
schema (L6) accepts it; the Admin create schema does not, so a new company always starts off. The
Admin company read config returns it. The store company routes neither accept it (their strict
schemas reject it with 400) nor return it (explicit field lists), and the Business Central company
sync never writes it. Shared company types gain the field. Rules: R12, R13 (default), F1.

**02. Admin UI.** The company detail page (Admin UI) shows the setting as a row; the edit drawer
gets a switch for it, using the existing switch component. The create drawer shows no switch.
Rules: F2, R14.

**03. Rule home and the order API refusal.** A pure decision function (L5) "a company is enabled
for the order API" (true only when the stored value is true; a missing company is not enabled),
registered as the rule's single home in `ai/architecture/decisions.md`. The shared
company-resolution step (L3) used by both order API workflows reads the setting and, for a
switched-off company, rejects with 403 and the fixed message; unknown stays 404 and runs first.
Contract and security tests cover both endpoints. Existing order API, ingestion and shipment test
seeds switch their companies on. Rules: R1, R3, R4, R5, R8, R11, R15, N1–N3.

**04. Shipment job.** Discovery's candidate step (L3) drops switched-off companies through the rule
before matching. The check run's preparation step (L3) reads each due row's company setting; the
check step closes such rows with a new close reason `company_not_enabled` (a new value on the
tracking table's close-reason enum, generated migration) before any Business Central read. The
pure check schedule (L5) gains the matching outcome. The Admin shipment page labels the new reason.
Rules: R6, R7, R9, N4.

**05. Admin retry refusal.** A validation step (L3) at the start of the reopen workflow (L4) reads
the tracking row's company setting and refuses a switched-off company with 400 and a fixed
message; a missing row falls through to the existing 404. Rule: R10.

Not built here: `docs/architecture/` (the `documentation-writer` writes the order API and shipment
notice section after ship) and the APIM / Logic App handling (NIMBUS-178).

## 5. Data model [High]

| Field | Meaning | Existing callers | Owner | Written by | Stored | Encrypted | Mutable until | Retention / deletion | Index |
|---|---|---|---|---|---|---|---|---|---|
| `company.order_api_enabled` boolean, not null, default `false` | company may use the order API (intake, notices, shipment job) | none (new) | `company` | Admin users via `POST /admin/companies/:id` only; never the store routes, Admin create or BC sync | stored | no | always (staff switch it any time) | life of the company row (soft delete with it) | none: always read with a company already found by customer number or id |
| `shipment_tracking.close_reason` new value `company_not_enabled` | tracking stopped because the company was switched off (R6) | Admin overview label map, Admin hook type, check schedule | `orderIngestion` | the check run (server, poll job) | stored | no | final: the retry only reopens `gave_up` | as existing tracking rows (no deletion) | existing `(state, next_check_at)` |
| `shipment_notice` rows of a switched-off company | stored notices (R8) | unchanged | `orderIngestion` | unchanged | stored | no | unchanged | kept; not served while off | unchanged |
| Orders and external references of a switched-off company | earlier API orders (R11) | unchanged | order module, `orderIngestion` | unchanged | stored | no | unchanged | unchanged | unchanged |

Cardinality: one setting per company; a company has one `business_central_customer_number`, so a
customer number maps to the setting of the company the resolve step already picks today.

## 6. Business rules as state tables [High]

**Company setting** (actor: the Admin user; no history, R14)

| State | Event | Outcome | Side effects on other rows / sessions |
|---|---|---|---|
| (none) | company created by Admin, storefront registration or module call | off | none |
| (existing) | migration at deploy | off | open tracking rows close as they come due; order API refuses (go-live gap, R13) |
| off | Admin switches on | on | next request served; stored notices served again (R8); closed rows stay closed (R9); shipments posted while off never found (R7) |
| on | Admin switches off | off | next intake 403, next notices read 403; open rows close as they come due; earlier orders untouched (R11) |
| any | BC company sync | unchanged | none |
| any | store request carrying the field | refused 400 | none |

**Order API request** (actor: the Logic App's secret key user)

| Precondition, in order | Outcome |
|---|---|
| query or body invalid | 400 (unchanged) |
| customer number unknown | 404 "Customer not found" (unchanged) |
| company off | 403 "Customer not registered for the order API"; nothing created or read |
| intake, duplicate external number | 422 (unchanged) |
| otherwise | 201 order / 200 notices (unchanged) |

A switch-off that lands while an intake request is already past the resolve step does not stop
that order (`Critical`: accepted race, a few milliseconds wide; there is no lock and the scope asks
for none).

**Shipment tracking row** (actor: the poll job; Admin user for retry, recorded in `reopened_by`)

| State | Event | Outcome | Side effects |
|---|---|---|---|
| open, company off or gone | comes due in a check run | closed `company_not_enabled`; no BC read | notices kept |
| open, company on | comes due | as today | as today |
| closed `company_not_enabled` | company switched on | stays closed | none |
| closed `gave_up`, company off | Admin Retry | refused 400 | none |
| closed `gave_up`, company on | Admin Retry | reopened (unchanged) | due now |
| (no row) | discovery finds a header of a switched-off company | not tracked; cursor advances | never back-filled |

## 7. Security-property matrix [Critical]

| Property | Control | Trust root | Failure behaviour | Negative test (task) |
|---|---|---|---|---|
| Only enabled companies place API orders | resolve step refuses before duplicate check and any write | company row; customer number from the Logic App via APIM (NIMBUS-178) | 403 fixed message; no order, link or reference | intake for a switched-off company: 403, exact body, zero orders/references for it (03) |
| Only enabled companies read notices | same step, before the notices read | same | 403 fixed message, no notices | notices for a switched-off company with stored notices: 403, body has no notice data (03) |
| Trust anchor | secret API key (Medusa) + APIM key (outside); unchanged | API key module | 401 (unchanged) | existing TC-2 stays green (03) |
| Existence oracle (accepted, Q1) | 404 vs 403 differ; both bodies fixed | secret key held only by the Logic App | key holder can tell "exists, off" from unknown; accepted | body of the 403 contains no customer number or company id (03) |
| Only staff change the setting | Admin route only; store schemas strict | Admin authentication | store request with the field: 400; store company endpoints never return it (wildcard reads: decision 5) | store create with the field: 400; store company read, also with a `fields` selection asking for it, lacks the field (01) |
| New companies start off | Admin create schema rejects the field; model default | schema + DB default | Admin create with the field: 400 | Admin create with `order_api_enabled: true`: 400 (01) |
| BC sync cannot switch it | sync update lists only BC-managed fields | sync code | field unchanged | a sync run leaves an enabled and a disabled company unchanged (01) |
| Cross-instance consistency | no cache; read from the database per request and per run (N3) | database | — | covered by the contract tests switching the value between requests (03) |
| Shipment job respects the setting | rule applied in discovery and check run; retry refused | company row | not tracked / closed / 400 | discovery, check run and retry cases (04, 05) |
| No personal data in errors or logs (N1, N2) | fixed messages; new log lines carry company id or shipment/BC order numbers only | — | — | exact-body assertions (03, 05) |

Replay, browser binding/CSRF and logout: no new credential or session is introduced; the Admin
update route keeps Medusa's Admin authentication unchanged.

## 8. Decisions [High for new, Medium from scope]

New in this plan:
- The check sits in `resolveCompanyByCustomerNumberStep`, shared by both endpoints; one change covers both (source: code, NIMBUS-130 task 12).
- 403 via `MedusaError.Types.FORBIDDEN`: Medusa's error handler maps it to 403 and returns the message verbatim — verified, `@medusajs/framework` 2.21.2 `dist/http/middlewares/error-handler.js` (`getHttpResponseFromError`).
- Rule home: a pure function in `apps/backend/src/utils/` (cross-domain, like `check-spending-limit.ts`); consumers call it on rows they already read. Discovery filters companies in memory after its existing by-number query rather than adding a database filter, so the rule has one implementation.
- New close reason wire value `company_not_enabled`; the check run applies it before the superseded check and before any Business Central read (N4).
- A company that no longer exists counts as not enabled (closes its open rows).
- Retry refusal: 400 (`NOT_ALLOWED`, as the existing "Only a shipment that gave up can be retried") with message "The company is not enabled for the order API".
- Admin create cannot set the field (strict schema), so F2's "new company starts off" holds for every creation path.
- Docs are left to `documentation-writer` after ship (no `docs/architecture/` section exists for the order API today).
- Framework check, "does Medusa already do this?": no per-entity API access flag exists in Medusa for custom modules; the Admin update goes through the existing `updateCompaniesWorkflow`, which needs no change.

From the scope: R1–R15 and N1–N4 as approved; field name `company.order_api_enabled`; 403 message text; no change history (Q6); no back-fill (R7).

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| `MedusaError` `FORBIDDEN` thrown in a step | route answers 403 with `{ type, message }`, message verbatim; a workflow rejection reaches the error handler the same way as the existing `NOT_FOUND` | `error-handler.js` (2.21.2) lines 60–62; existing 404 contract test TC-5 in `integration-tests/http/orderapi/orders.spec.ts` |
| `model.boolean().default(false)` added to an existing table | generated migration adds the column `not null default false`; Postgres fills existing rows with `false` | precedent `approval_settings` booleans; Postgres `ADD COLUMN ... DEFAULT` semantics; worker inspects the generated SQL |
| Adding a value to `model.enum` | `db:generate` emits a drop and re-add of the column's check constraint | MikroORM 6.6.14 `PostgreSqlSchemaHelper.js` (enumItems change → `<table>_<column>_check` dropped and re-created) |
| `query.graph` on `companies` returns `order_api_enabled` | a stored column of a custom module resolves (`data-schema-vs-model`) | module service column; asserted by the contract tests |

No row is UNVERIFIED.

## 10. Open risks and gates [Medium; Critical where marked]

- Go-live gap (R13): companies are off after the migration until switched on in Admin. The system is
  not in production (Klaus, 2026-10-23), so no customer is affected now; Klaus switches companies on
  while testing. Owner: Klaus. Non-blocking.
- O2, Logic App behaviour on 403: handled by Klaus outside this repo (NIMBUS-178). Non-blocking.
- Existing specs seed companies without the setting and would start failing; task 03 and 04 switch their seeds on (listed in "Also update"). Owner: workers. Non-blocking.
- Backend typecheck baseline is red (`verification.md`); tasks hold it at or below the recorded count. Non-blocking.
