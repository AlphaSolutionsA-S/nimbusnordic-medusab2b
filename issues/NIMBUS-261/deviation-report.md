# Deviation report: Norwegian companies use the Norwegian Business Central for returns, order history and company sync

> Record of NIMBUS-261, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Key:** NIMBUS-261 · **Branch:** `feature/NIMBUS-261` (HEAD `b928d98`) · **Merge-base:** `811de63` (develop)
**Reviewed:** 2026-10-28, integration-reviewer · **Commits:** 9 (tasks 01–07, fix 01, consolidation); working tree clean

## Deviations from scope and plan

Nothing blocks the gate. The migration was generated, not hand-written (`Migration20261027225750.ts`
plus a snapshot change: three nullable columns only).

1. **Task 04: the return route's error mapping changed behaviour. Klaus must confirm this (open question 1).** Before the branch, the route used
   `instanceof` on the rejection from `createBcReturnWorkflow`. A failed workflow rejects with a
   serialised object, so every failure answered 500, and the declared 400/404/503 answers never
   happened (verified by a probe and in `@medusajs/orchestration` `serializeError`). The route now
   reads the serialised fields:
   - 503 for `name === "BusinessCentralAmbiguousOutcomeError"`.
   - 404 "Order not found." for a `MedusaError` of type `not_found`.
   - 400 with the message only for the prepare step's own line-validation errors, now thrown with
     `name = "BcReturnValidationError"`.
   - A logged generic 500 for everything else, including NO configuration and credential errors
     and BC rejecting the return action.

   The statuses and messages are the ones the route already declared. Acceptable; it fixes a latent bug.
2. **Task 04: a baseline entry was cleared.** The return route no longer imports the BC service,
   so its `bound-route-no-service` baseline entry was removed from `ai/architecture/boundaries.md`.
   The generated `AGENTS.md` and `.github/copilot-instructions.md` were regenerated, and
   `medusa-infra-adapter/project.md` was reworded. Acceptable.
3. **Task 05: the seam changed (approved by the dispatcher).** `BusinessCentralNotFoundRecord.at`, and
   the Admin status route's `not_found.at`, is an ISO 8601 string, not the `Date` the plan
   specified. Workflow results are serialised, so a `Date` can never come out of `run()`. Tasks 06
   and 07 use the string. Acceptable, and required by `medusa-boundary.md` Types.
4. **Task 05: the currency rule moved.** `resolveCurrencyCode(environment, code)` moved from the
   sync step into `workflows/company/utils/resolve-currency-code.ts`. Before, order submission
   imported it from a step, which broke `bound-helper-pure`. Order submission now calls it with
   `"DK"`. Acceptable.
5. **Task 01: discovery-URL validation is stricter.** The DK discovery URL is now validated whole
   (`/v2.0/{tenant}/{environment}`) before any call. Before, the environment segment was checked
   only for ODataV4 and custom-API calls. The three old path messages became one. Acceptable: a URL
   without the segment was already broken for returns. Production's DK URL must contain the
   segment, which it already needs for returns.
6. **Task 01: more stale specs fixed than listed.** The "Also update" list missed several
   shipment-notice and company-sync spec call positions; they were updated. One more spec,
   `admin/shipment-tracking.spec.ts`, was missed and fixed at finalization (fix 01, `863f0fc`).
   Acceptable.
7. **Task 02: unknown customer id handling.** An unknown `customerId` resolves like a customer
   without a company (`DK`, no number), as the sync already did. The plan named only the
   unknown-company-id 404. Acceptable.
8. **Task 03: the client-environment negative has two outcomes by route.** The two list routes
   answer an `environment` query parameter with 400 (their validators are `.strict()`). The order
   detail, return detail and return-reasons routes ignore it and stay on the company's environment.
   Both outcomes are allowed by the plan's security matrix.
9. **Task 03: return reasons now run the account workflow.** This adds one company read per call;
   a customer without a company still gets DK. As planned.
10. **Task 06: the lookup step reports any rejection as `could_not_check`,** not only a
    `MedusaError`. Acceptable: the lookup is read-only, and one environment must not hide the other.
11. **Task 06: a BC error during the use route's re-read uses Medusa's own error mapping.**
    - A BC request failure is `unexpected_state` and answers 500 with the module's message.
    - A missing NO configuration is `invalid_data` and answers 400, naming the variable and the
      environment.

    Nothing is written in either case. Admin-only, so acceptable; see open question 2.
12. **Task 06: extra unit specs.** Workflow and route unit specs were added beside the contract
    cases, because every Admin contract case gets 401 locally (NIMBUS-236). They replace Query and
    the company module; see Tests.
13. **Task 07: lookup and button placement.**
    - The lookup is a disabled `useQuery` run by `refetch()`, not a mutation.
    - The status query key is nested under the company detail key, so the menu sync and the edit
      drawer also reload the section.
    - The check and "Use this customer" buttons sit in the section, not in the actions menu. The
      plan's "next to the existing sync action" is read as placement below company information.

    Acceptable.
14. **Fix 01: test-only.** `admin/shipment-tracking.spec.ts` now expects the `"DK"` first argument.

## Consolidation changes

From the consolidation pass (`b928d98`):

- **Duplicate company read merged.** The sync workflow now runs `loadBusinessCentralAccountCompanyStep`
  (task 02), then `prepareCompanyBcSyncStep({ company, expectedCompanyId })`.
  `SyncCompanyFromBusinessCentralInput` is unchanged, and the 404/skip behaviour is the same
  (company-sync.spec 39/39).
- **One customer → employee.company `query.graph` remains.** It is in
  `load-business-central-account-company.ts`, with a `data-core-read-workflows` exemption comment.
- **A unit spec was dropped.** `workflows/company/__tests__/sync-company-from-business-central.unit.spec.ts`
  mocked framework services; all 18 of its cases are covered by `company-sync.spec.ts`.
- **Small fixes.** The return route's POST body went from 42 to 38 lines (no logic change),
  `queue.shift()!` became `splice` in an Admin test, and task 05's Done-when wording was corrected.
- **Left as they are, with reasons:**
  - The `environment-config.ts` message mentions `/api/v2.0` but doesn't enforce it (old behaviour).
  - `CompanyBcNotFoundUpdate.business_central_not_found_at: Date` is serialised to ISO between steps,
    like `business_central_synced_at`.
  - Admin route and workflow unit specs that replace Query and the company module were kept, because
    the Admin contract cases can't pass locally (NIMBUS-236).

## Findings

Design and wiring were checked against plan sections 5–9. Every row holds unless listed here.

1. **Medium: a Norwegian shopper can see a setting name if the NO configuration is missing.**
   - Where: `apps/backend/src/api/store/bc-orders/route.ts`, `bc-orders/[id]/route.ts`,
     `bc-orders/return-reasons/route.ts`, `bc-returns/route.ts`, `bc-returns/[number]/route.ts`
     (no try/catch).
   - What happens: if the NO settings are missing or invalid, `getBusinessCentralEndpoint` throws a
     `MedusaError` `INVALID_DATA`. Medusa's error handler (`framework/dist/http/middlewares/error-handler.js:71`)
     answers 400 to the shopper with the message, e.g.
     `BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)`. No URL,
     tenant, client id or secret leaks.
   - Why it matters: this matches plan flow A7 ("fails as a misconfigured DK call fails today") and
     is pre-existing for DK. It is also the scenario the plan accepts for a production rollout
     without the NO variables. Task 04 judged the same message unfit for shoppers (CWE-209) and
     turned it into a generic 500 on the return route only, so the store BC routes now answer the
     same error two ways. Open question 2.
2. **Low: the "Also update" search missed one Tier 0 line.** `ai/architecture/verification.md:34`
   says "Backend tests abort unless `BUSINESS_CENTRAL_DISCOVERY_URL` is an allowed test
   environment". The guard now also checks `BUSINESS_CENTRAL_NO_DISCOVERY_URL` when it is set, and
   the default allowlist is `TestDK,TestNO`. The line is incomplete rather than wrong. Fix it in
   `ai/` with `pnpm ai:check --fix`, or leave it to `documentation-writer`.
3. **Low: some docs are stale until `documentation-writer` runs.**
   `docs/architecture/business-central-company-sync.md` (lines 22, 73, 86: one environment, DKK
   only, no not-found record) and the BC order and return docs still describe one environment.
   Planned for after ship (plan section 10).
4. **Low: some exported types are used only in their own file.** `BusinessCentralNotFoundRecord`,
   `CompanyBcNotFoundUpdate`, `BusinessCentralCustomerCountryUpdate`,
   `ReadBusinessCentralCustomerCountryInput`, `LookupBusinessCentralCustomerInput`,
   `UseBusinessCentralCustomerInput`, `UseBusinessCentralCustomerResult`,
   `BusinessCentralLookupCustomer`, `BusinessCentralLookupResult`, `PrepareCompanyBcSyncInput`.
   They are input and output types of exported steps and workflows, the repo's existing pattern.
   No dead runtime exports.
5. **Low: a constant is duplicated.** `AZURE_GUID_PATTERN` is now defined in both
   `modules/business-central/service.ts:96` (client id check) and `environment-config.ts:6`
   (company id check). It is in one module and is harmless.
6. **Info: the exposure decided in plan section 2 item 2 is in the code as accepted.** The three new
   columns reach a company's own admins through the existing `carts.company.*` and `*company`
   wildcards (approvals, employee responses). The store company projection excludes them; the
   contract case passed.
7. **Info: "Use this customer" on a card with a blank country writes `country = ""`.** TestNO has
   205 such cards, ProductionNO has 3. That company then routes to DK, which follows decision D1;
   the section warns first, because `routes_elsewhere` is true. Keep this in mind when choosing the
   TestNO card for the after-deploy checks.

Wiring checks with no finding:

- **Calls and boundaries:**
  - Every `IBusinessCentralModuleService` method except `getOperations` requires the environment,
    so typecheck proves no caller was missed. Order submission and shipment notices pass `"DK"`,
    with a comment.
  - `"NO"` is compared in exactly one place, `utils/business-central-environment.ts:18`.
  - No route imports a module service; route bodies stay within 40 lines with no domain `if` (the
    customer-number 400 is the pre-existing check).
- **Data:**
  - The not-found record is written and cleared only by the sync workflow's single
    `updateCompaniesStep`. "Use this customer" writes `{ id, country }` only, from the re-read card.
  - The shipment token and company-name cache is keyed per environment. Other calls request a
    token per call.
- **Types and comments:**
  - No `as unknown as` or `any` in source. Test files use `as unknown as typeof fetch` and
    `as never`, as existing specs do.
  - No plan, task or test-case ids in comments.
- **Cross-app and git:**
  - No storefront or CMS change, and no store response shape changed.
  - No new module, so `medusa-config.ts` needs no registration.
  - `git status` is clean.
- **Rules registry:** the new rule and the changed sync rule are registered in
  `ai/architecture/decisions.md`.

## Tests

- **Security-critical paths:**
  - **Routing from the stored company, not the client:** `integration-tests/http/business-central/store-bc-reads.spec.ts`
    (35/35 at finalization) covers NO, DK and blank country on all five reads and the return create,
    plus "a request cannot choose the environment".
  - **Not-found record and unchanged BC-managed fields:** `customers/company-sync.spec.ts` (39/39).
    The record is asserted against the unchanged `originalFields`. The exact-keys unit assertion
    behind the matrix row "Not-found record holds no personal data" went with the dropped sync unit
    spec; the integration case covers the same property by behaviour.
  - **Account workflow:** `business-central-account.spec.ts` (8/8).
  - **Store projection excludes the new fields:** a `companies.spec.ts` case passed.
  - **Admin-only routes:** `security-boundaries.spec.ts` "denies %s credentials on the Admin
    Business Central customer routes" (3/3; the BC module is not called and the row is unchanged).
  - **Production-BC guard, NO configuration errors, per-environment cache:** unit and module specs
    pass.
- **Code complete, unverified because of NIMBUS-236 (Admin login answers 401):** 21 new
  `companies.spec.ts` Admin contract cases. They cover the status, lookup and use routes, including
  `{ environment, country }` → 400 and card missing → 404 with `country` unchanged, plus the Admin
  sync route's not-found and NO cases. Their logic and response shapes are covered by
  `business-central-customer-routes.unit.spec.ts`, `lookup-business-central-customer.unit.spec.ts`
  and `use-business-central-customer.unit.spec.ts` (all pass). Every other failure in the 8 failing
  HTTP suites also fails on develop `811de63` with the same error (`cmp-branch.txt` vs `cmp-develop.txt`).
- **Finalization results:**

  | Check | Result |
  |---|---|
  | Unit | 618/618 |
  | Module integration | 309 passed, 1 failed (baseline `service.spec.ts` "listOrders › stops filling from salesInvoices…", also fails on develop) |
  | Admin UI | 96/96 |
  | Lint | 0 errors (13 pre-existing warnings) |
  | Typecheck | 22 errors = baseline |
  | `medusa build` | passes |

  No run reached Business Central: the fetch guard log is empty and the BC credentials were blank.
- **Volume:** apps/ tests +3480/−205 against source +1416/−446, plus a 64-line migration and
  snapshot.
- **Redundancy:** now that the integration cases run green, some unit specs overlap them.
  `api/store/bc-orders/__tests__/create-return-route.unit.spec.ts` (290 lines) overlaps the return
  cases in `store-bc-reads.spec.ts`. The three Admin unit specs (about 510 lines) overlap the
  `companies.spec.ts` contract cases. The return-route spec registers only a fake BC module and a
  logger. The three Admin unit specs replace Query and the company module in a real container, the
  pattern consolidation removed from the sync spec. They assert outcomes and final row state, not
  framework call order. They stay while NIMBUS-236 blocks the Admin contract cases; open question 4.

## Open questions

1. **Return route error mapping (task 04).** Before this branch every failure answered 500. Do
   you accept the new answers?
   - Line-validation errors: 400 with the message.
   - Order not in the company's environment: 404 "Order not found.".
   - Ambiguous BC outcome: 503.
   - Everything else, including NO configuration, credential and BC rejection errors: a logged
     generic 500.

   Options: (a) accept (recommended); (b) keep "everything 500"; this needs a code change and
   contradicts the plan's flow B5.

   **Answer (Klaus Petersen, 2026-10-28): (a) accepted.**
2. **Configuration errors on the store BC read routes (finding 1).** A missing or invalid NO setting
   answers Norwegian shoppers 400 with the variable name, as DK configuration errors already do. The
   return route alone answers a generic 500. Options:
   - (a) Accept for now: plan flow A7, and production gets the NO variables before go-live.
   - (b) A follow-up issue to give the five read routes the return route's generic 500 for
     configuration errors.
   - (c) Fix it on this branch. This changes existing DK error answers, which the scope keeps
     unchanged.

   The Admin "Use this customer" route gives the same 400 to admins (deviation 11); that seems fine
   either way.

   **Answer (Klaus Petersen, 2026-10-28): (c) fix it on this branch.** A BC configuration or
   credential error is not the shopper's fault: on every store BC route (the five read routes and
   return creation), for DK and NO alike, it answers a logged generic 500 with no variable name or
   configuration detail in the body. Genuine shopper-input errors keep their 400. Task 04's
   return-route mapping stays as it is. Admin routes may keep showing the configuration reason to
   admins. Implemented as fix 02 (`fix-02-store-bc-config-errors.md`): BC configuration and
   credential errors, including a token request Azure AD rejects, are a `MedusaError` of the
   unmapped type `business_central_configuration`, which Medusa's error handler answers with a
   logged generic 500 (evidence in the fix brief). Deviation: the Admin "Use this customer" route
   now also answers that generic 500 (the reason stays in the server log; the Admin UI showed the
   same toast before). Other BC response failures (`UNEXPECTED_STATE`, fixed texts with a status
   code) still echo their message in the 500 body; they name no setting, tenant, app or URL.
3. **Jira.** NIMBUS-261 is still in Scoping, and its workflow has no direct move to In Progress (only
   "Estimate approved"). Sub-tasks NIMBUS-262 to 268 are Done with closing comments. Which
   transitions should be applied before the push?

   **Answer (Klaus Petersen, 2026-10-28):** done by the main session on 2026-10-28. NIMBUS-261 was
   moved Estimate approved → Start work → Finish work and is now in "Internal review". No further
   transition from the pipeline.
4. **Overlapping unit specs (Tests).** Keep the Admin route and workflow unit specs that replace
   Query and the company module until NIMBUS-236 is fixed? Options: (a) keep them, with a follow-up
   to drop them once the Admin contract cases run (recommended); (b) drop them now and rely on the
   unverified contract cases. Also choose whether to drop `create-return-route.unit.spec.ts`, now
   that the integration cases run green.

   **Answer (Klaus Petersen, 2026-10-28): (a) keep them until NIMBUS-236 is fixed.**
5. **The `verification.md:34` wording (finding 2).** Fix it on this branch with `pnpm ai:check --fix`,
   or leave it to `documentation-writer`?

   **Answer (Klaus Petersen, 2026-10-28): fix it on this branch.** Done in `b021fdd` (the wording
   now mentions the NO discovery-URL guard; `AGENTS.md` and `.github/copilot-instructions.md`
   regenerated by `pnpm ai:check --fix`).
6. **Local test environment.** The dev Postgres container's port publishing is broken; finalization
   used a throwaway container (`nimbus261-scratch-pg`, `localhost:55433`), to be removed at the end
   of the run. No decision is needed beyond noting that the dev container needs repair.

## Verify after deploy

**TestNO recheck, 2026-10-28** (main session, read-only probe
`samples/probe-bc-environment.mjs`; details in `samples/probe-results-2026-10-27.md`, "2026-10-28
recheck"):

- The customer-portal extension is now deployed in TestNO: `customerPortal/v2.0`
  `salesReturnOrders` and `salesOrderReservationEntries` answer 200, and `$metadata` contains
  `CustomerPortalReturns`. Return detail of an open return order, reservations on order detail and
  return creation can now be checked in TestNO after deploy; they no longer wait for the extension.
- ODataV4 `CS_EnabledReasonCodes` still answers 404. Nothing calls `/store/bc-orders/return-reasons`
  today, and return creation hard-codes the reason `NORMAL` (NIMBUS-138), so this is a BC-side
  follow-up, not a blocker. Only the return-reasons check still waits for it.
- 205 of 207 TestNO customers still have a blank country: fill it on the test customers used, or
  use the two cards with `NO`.

Copied from the task files (as written; the 2026-10-28 recheck above supersedes their "until the
extension is deployed" conditions except for return reasons):

- **03, store BC order and return reads routed per company:** `GET /store/bc-returns` and
  `GET /store/bc-orders` as a user of one Norwegian test company (country `NO`; most TestNO cards
  have a blank country, so fill it or use one of the two `NO` cards) return documents that exist in
  TestNO, not TestDK. Return reasons, open return detail and order reservations only after the
  customer-portal extension is deployed to TestNO; until then those calls fail for NO companies
  (plan flow A8).
- **04, return creation routed per company:** after the customer-portal extension is deployed to
  TestNO (it is not yet; plan section 10), a test return created by a Norwegian test company's user
  appears as a sales return order in TestNO, not TestDK. Until then the create fails for NO
  companies with the existing 500 answer.
- **05, company sync routed, NOK, and the not-found record:**
  `company.business_central_not_found_at`, `_environment`, `_customer_number` for one test company
  with a deliberately wrong number after an Admin sync; then cleared after correcting the number
  and syncing.
- **06, Admin routes (status, two-environment check, "Use this customer"):** on the Admin page of
  one test company with a Norwegian number and country `DK`, "Use this customer" for NO sets
  `company.country` to `NO` and the next store BC read goes to TestNO.
- **07, Admin "Business Central customer" section:** the section on one Norwegian test company's
  page shows "NO" as routed environment after "Use this customer".
- **01 and 02:** no "Verify after deploy" line (nothing user-visible or stored on their own).

Gates from plan section 10 that come before or with these checks:

- **Medusa Cloud variables:** `BUSINESS_CENTRAL_NO_DISCOVERY_URL`, `BUSINESS_CENTRAL_NO_COMPANY_ID`
  and `BUSINESS_CENTRAL_NO_LCY_CODE` per stage, and `BUSINESS_CENTRAL_TEST_ENVIRONMENTS` where
  tests run. Without them, NO companies get BC errors (finding 1).
- **TestNO test data:** fill the country on the test customers used, or use the two cards with
  `NO` (205 of 207 TestNO cards are blank).
- **Customer-portal extension in TestNO:** deploy it, re-run the probe, then do the checks that
  need it: return creation, open return detail, reservations on order detail, return reasons.
- **Production go-live of NO routing:**
  - The extension is in ProductionNO and the probe passes there (`PROBE_ALLOW_PRODUCTION=1`).
  - The probe also runs against ProductionDK, to confirm the unscoped standard API resolves to
    `Nimbus Nordic A/S`, not `CRONUS Danmark A/S`.
- **Rollout check:**
  - Run `select country, count(*) from company group by country` in production.
  - Confirm which companies move to NO and that their numbers exist in ProductionNO. 4 of the 300
    ProductionDK cards with country `NO` have no ProductionNO card; those companies will get a
    not-found record after their next sync.
