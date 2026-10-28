# Fix brief 02: BC configuration errors answer shoppers a generic 500

**Key:** NIMBUS-261 · **Branch:** `feature/NIMBUS-261` · **Merge-base:** `811de63` (develop)
**Decision:** Klaus Petersen, 2026-10-28, deviation report open question 2, answer (c): fix on this
branch.

## Problem

The five store BC read routes (`api/store/bc-orders/route.ts`, `bc-orders/[id]/route.ts`,
`bc-orders/return-reasons/route.ts`, `bc-returns/route.ts`, `bc-returns/[number]/route.ts`) have no
try/catch. A missing or invalid BC setting makes the BC module throw `MedusaError` `INVALID_DATA`
(`configurationError(...)` in `apps/backend/src/modules/business-central/environment-config.ts`,
around lines 54-66; the credential checks in `modules/business-central/service.ts`, around lines
780-800). Medusa's error handler answers that as 400 with the message, so a shopper sees e.g.
`BUSINESS_CENTRAL_NO_DISCOVERY_URL is required (Business Central environment NO)` (CWE-209). The
return-creation route (task 04) already answers a generic 500 for it, so the same error is answered
two ways.

## Required behaviour (Klaus's decision)

- A BC configuration or credential error is not the shopper's fault. On every store BC route (the
  five read routes and return creation), for DK and NO alike, it answers a **generic 500 that is
  logged**, with no variable name, URL, tenant or configuration detail in the body.
- Genuine shopper-input errors keep their current answers (e.g. the 400 for a missing customer
  number, the validators' 400s, 404s).
- Task 04's return-route mapping stays intact: 400 only for `BC_RETURN_VALIDATION_ERROR`, 404 for
  not found, 503 for `BusinessCentralAmbiguousOutcomeError`, else the generic logged 500.
- Admin routes (status, lookup, use, sync) may keep showing the configuration reason to admins as
  they do today. The lookup's per-environment `could_not_check` must still work after any change.

## Steps

1. **Evidence first.** From the installed `@medusajs/framework` dist error handler
   (`apps/backend/node_modules/@medusajs/framework/dist/http/middlewares/error-handler.js`, or the
   pnpm store path per `ai/architecture/medusa-boundary.md`), record in this brief under
   `## Evidence` what status and body each `MedusaError` type produces (`INVALID_DATA`,
   `NOT_FOUND`, `UNEXPECTED_STATE`, `UNAUTHORIZED`, `DB_ERROR`, others relevant) and what a plain
   `Error` produces. In particular: does `UNEXPECTED_STATE` or a plain `Error` give a generic
   message, or does it echo the message? Choose the mechanism from that evidence.
2. **Classify every `INVALID_DATA` throw in the BC module** (`environment-config.ts`,
   `service.ts`, including those near lines 1610-1800). Configuration/credential errors change;
   genuine input validation of the caller's data (shopper input) stays as it is. List the
   classification under `## Evidence` (location → kept / changed, with the reason).
3. **Implement** the smallest change that gives the required behaviour on all six store BC routes
   without breaking `limit-route-body` (40 lines, no domain `if` in a route), layer rules or Admin
   behaviour. Keep task 04's mapping. Comments cite only NIMBUS-261 or a `docs/architecture/`
   section.
4. **Tests.**
   - Contract cases in `apps/backend/integration-tests/http/business-central/store-bc-reads.spec.ts`:
     a Norwegian company with a missing NO setting gets 500 on the store BC reads, and the body
     does not contain `BUSINESS_CENTRAL_`; plus one DK case (an invalid DK setting or credential)
     with the same assertion. The error must be logged (a logger spy, without asserting framework
     call order).
   - Check the lookup's `could_not_check` handling still holds (its unit spec; add a case if the
     type change could affect it).
   - Fix any existing test that asserted the old 400 for a configuration or credential error: fix
     the assertion, never delete the test. Search unit, module and integration specs
     (`environments.spec.ts`, `service.spec.ts`, `create-return-route.unit.spec.ts`,
     `store-bc-reads.spec.ts`, `companies.spec.ts`, `company-sync.spec.ts`, the Admin route and
     workflow unit specs).
5. **Run** the scoped unit and module specs, `store-bc-reads.spec.ts`, `company-sync.spec.ts`,
   `business-central-account.spec.ts` and any other touched integration spec against the scratch
   Postgres; lint; typecheck (baseline 22).

## How to run integration specs (never reach Business Central)

Throwaway Postgres `nimbus261-scratch-pg` on `localhost:55433` (user `admin`, password
`scratchpw`). Runner with the BC fetch guard preloaded: `<run folder>/run-http-fix01.sh`. Use
`DB_HOST=localhost`, BC client id and secret blank, TestDK discovery URL; `.env` untouched.
Admin-login cases fail with 401 (NIMBUS-236 baseline).

## Report

`### Files touched`, the `## Evidence` summary, test/lint/typecheck results per spec, and
`## Deviations` / `## Done-when evidence` appended here.

## Evidence

### Medusa error handler (installed `@medusajs/framework` 2.21.2)

Source: `apps/backend/node_modules/@medusajs/framework/dist/http/middlewares/error-handler.js`
(`getHttpResponseFromError`, exported from `@medusajs/framework/http`) and `exception-formatter.js`;
`MedusaError` from `@medusajs/utils` 2.21.2 `dist/common/errors.js`. The switch keys on
`error.type || error.name`.

|Error|Status|Body|
|---|---|---|
|`INVALID_DATA`, `NOT_ALLOWED`|400|`{ type, message }`, message echoed|
|`NOT_FOUND`|404|message echoed|
|`UNAUTHORIZED` / `FORBIDDEN`|401 / 403|message echoed|
|`DUPLICATE_ERROR`, `PAYMENT_AUTHORIZATION_ERROR`|422|message echoed|
|`CONFLICT` and the transaction errors|409|fixed message|
|`DB_ERROR`|500|`code: "api_error"`, message **echoed**|
|`UNEXPECTED_STATE`, `INVALID_ARGUMENT`|500|message **echoed**|
|any other type (`UNKNOWN_MODULES`, `PAYMENT_REQUIRES_MORE_ERROR`, a custom type) or a plain `Error` (no `type`, so its `name`)|500|`{ code: "unknown_error", type: "unknown_error", message: "An unknown error occurred." }`|

Logging: status >= 500 → `logger.error(err)` (the whole error, message included); below 500 →
`logger.info(err.message)`. So neither `UNEXPECTED_STATE` nor `DB_ERROR` hides the message; only an
unmapped type or a plain `Error` gets the generic body.

Mechanism chosen: a `MedusaError` with the custom type `business_central_configuration`
(`businessCentralConfigurationError(message)` in
`modules/business-central/environment-config.ts`). A plain `Error` was rejected:
`workflows/company/steps/prepare-company-bc-sync.ts` reports `failed` only for `instanceof
MedusaError` and rethrows anything else, so a plain `Error` would turn a sync with a missing
setting from `failed` into a thrown workflow. `MedusaError`'s constructor takes `type: string`, so
no cast is needed. Through a workflow the serialised error keeps `type`, so the answer is the same
there.

### Classification of the `INVALID_DATA` throws in the BC module

|Location|Throw|Verdict|Why|
|---|---|---|---|
|`environment-config.ts` `getBusinessCentralEndpoint`|discovery URL required, valid URL, https, host, `/v2.0/{tenant}/{environment}` form (5)|changed|operator configuration|
|`environment-config.ts` `getBusinessCentralCompanyId`|company id must be a GUID|changed|operator configuration|
|`service.ts` `getClientCredentials`|client id required, client secret required, client id must be a GUID (3)|changed|operator credentials|
|`service.ts` `createSalesOrder`|at least one line, customer number, external document number (3)|kept|validation of the caller's order data; reached only from order submission (subscriber), never a store route|
|`service.ts` `createReturnFromSalesOrder`|request id/source order/lines; positive quantity and reason (2)|kept|validation of the caller's input; the return workflow validates lines first (`BC_RETURN_VALIDATION_ERROR`)|
|`service.ts` `createReturnFromSalesOrder`|BC 4xx rejection "The return request could not be accepted…"|kept|BC refusing the request, not configuration; the return route already answers it the generic 500 (task 04 mapping, unchanged)|

`item-lookup-evidence.ts` and `shipment-reads.ts` throw only `UNEXPECTED_STATE`; untouched.

Added in review rework 1 (an `UNEXPECTED_STATE` throw, not `INVALID_DATA`):

|Location|Throw|Verdict|Why|
|---|---|---|---|
|`service.ts` `requestTokenWithLifetime`|non-ok token response: `Business Central token request failed: <Azure error_description>`|changed|Azure AD's AADSTS text names the app/client id (AADSTS7000215, AADSTS7000222) and the tenant (AADSTS90002, AADSTS700016); `UNEXPECTED_STATE` echoed it in the store 500 body. Now `businessCentralConfigurationError(...)`, same message, so the log keeps the reason|
|`service.ts` `requestTokenWithLifetime`|token fetch fails outright: fixed `Business Central token request failed`|kept|fixed text, names nothing|
|`service.ts` `requestTokenWithLifetime`|token response without `access_token`|kept|fixed text, names nothing|

Other callers of the token error (checked in code): `prepare-company-bc-sync.ts` still sees a
`MedusaError` → `failed`; the Admin lookup's `Promise.allSettled` → `could_not_check`; the return
route's `getReturnFailureAnswer` has no case for it → logged generic 500;
`jobs/poll-shipment-notices.ts` logs only the error type, which reads
`business_central_configuration` instead of `unexpected_state` for a rejected token (its unit spec
mocks its own rejection and is unaffected). No code branches on `UNEXPECTED_STATE` for BC errors
(`workflow-error-response.ts` maps it only for the country-language routes).

### Effect on other callers (checked in code)

- Store BC read routes (5): error reaches Medusa's handler directly → generic 500, logged with the
  reason. No route changed.
- Store return creation: task 04's `getReturnFailureAnswer` is unchanged (400 only for
  `BC_RETURN_VALIDATION_ERROR`, 404 not found, 503 ambiguous, else logged generic 500).
- Company sync (login, store company read, store and Admin sync routes): still a `MedusaError` →
  `failed`.
- Admin lookup: `Promise.allSettled` → `could_not_check` for any rejection; unchanged.
- Admin use: the country re-read now answers a configuration error with the generic 500 instead of
  400 with the reason (see Deviations). The Admin UI shows the same "Could not use this customer"
  toast for every non-404 answer, so nothing visible changes.
- Order submission (subscriber) and the Admin submit route (emits an event only): no type checks;
  the logged message is unchanged.

## Deviations

- Admin `POST /admin/companies/:id/business-central-customer/use` now answers a BC configuration
  error with the logged generic 500, not 400 with the reason. The brief allowed Admin routes to
  keep the reason; one module-level mechanism is the smallest change and keeps every store route
  free of try/catch. The reason stays in the server log; the Admin UI never showed it.
- Contract cases cover the return-creation route too (both environments), not only the five reads.
- Existing tests that spied a hand-built `INVALID_DATA` configuration error now throw the module's
  real one (`businessCentralConfigurationError`): `store-bc-reads.spec.ts` (return-create 500 case),
  `company-sync.spec.ts` ("reports failed … on a Business Central error"),
  `create-return-route.unit.spec.ts` (configuration and credential cases). Their assertions are
  unchanged; none asserted the old 400.
- Added a unit-level check against the real framework mapping (`getHttpResponseFromError`) in
  `environments.spec.ts`, plus three DK credential cases there.
- A token request Azure AD rejects (any non-ok token response, review rework 1) is now a
  `businessCentralConfigurationError` too: its AADSTS reason names the app and tenant, so it is
  logged and answered the generic 500 on every store BC route; sync still reports `failed` and the
  lookup still gives `could_not_check`. This also applies to a 5xx from Azure AD: one rule for every
  non-ok token answer, since its body is Azure's text either way.
- Not fixed, out of scope: other `UNEXPECTED_STATE` errors from BC responses (e.g. "Business
  Central order request failed with status 401") still echo their message in the 500 body of the
  store reads. They are fixed texts with a status code and name no setting, tenant, app or URL.
- The shipment-notice poll job's failure log now names the type `business_central_configuration`
  (was `unexpected_state`) when the token is rejected.
- Also reworded the return route's comment (`[id]/returns/route.ts`) and the stale branch-notes
  lines (task 01, 04, 06) that still called BC configuration errors `INVALID_DATA` / a 400.

## Done-when evidence

- Store BC reads answer a logged generic 500 for a NO configuration error:
  `store-bc-reads.spec.ts` "for a Norwegian company with no NO discovery URL › answers %s with a
  logged generic 500" (5 paths; body has no `BUSINESS_CENTRAL_`, logger `error` received the error
  naming the variable, fetch never called). Red before the fix: 10/10 read cases got 400.
- Same for DK: "for a Danish company with an invalid client id › answers %s with a logged generic
  500" (5 paths).
- Return creation, both environments: "… › answers a return request with the logged generic 500".
- Azure AD token rejection (review rework 1): `store-bc-reads.spec.ts` "when Azure AD rejects the
  Business Central credentials › answers %s with a logged generic 500 that names neither app nor
  tenant" (5 paths; stubbed token endpoint answers 401 with an AADSTS7000215 body naming a
  synthetic app id and tenant; body is the generic one and contains neither value nor `AADSTS`;
  logger `error` received the error carrying `AADSTS7000215`; fetch called once, the token request
  only). Red before the fix: 5/5 answered 500 `unexpected_state` with the app id and tenant in the
  message.
- Task 04 mapping intact: `store-bc-reads.spec.ts` "creating a return" (404, 400, 503, 500 cases)
  and `create-return-route.unit.spec.ts` pass unchanged in behaviour.
- Shopper-input errors keep their answers: `store-bc-reads.spec.ts` "existing answers are kept"
  (400 no customer number, 404s) and "a request cannot choose the environment" (400s) pass.
- Framework mapping and `MedusaError` kept: `environments.spec.ts` "fails only NO calls when %s…"
  (8) and "fails before any request when %s…" (3) assert 500 with the generic body via
  `getHttpResponseFromError` and `instanceof MedusaError`.
- Sync still reports `failed`: `company-sync.spec.ts` "reports failed and keeps an existing
  not-found record on a Business Central error" (now with the real error type).
- Lookup `could_not_check`: `lookup-business-central-customer.unit.spec.ts` "reports
  could_not_check for the environment that fails with a missing NO setting…" (added case). The
  Admin contract case in `companies.spec.ts` still fails only with the NIMBUS-236 401.
- Comments cite only NIMBUS-261: `environment-config.ts`, `service.ts` (token rejection),
  `environments.spec.ts`, `store-bc-reads.spec.ts`; the return route's comment no longer calls
  configuration errors invalid-data.
- Existing tests asserting the token-failure message or type: none found (searched unit, module and
  integration specs for the message, `AADSTS`, `unexpected_state` and token stubs;
  `poll-shipment-notices.unit.spec.ts` mocks its own rejection object).

Results (scratch Postgres, BC fetch guard; `blocked-bc.log` empty after every run):

|Spec|Result|
|---|---|
|`environments.spec.ts` (module)|15/15|
|all module specs|312/313; the one failure is the known `service.spec.ts` listOrders guardrail baseline|
|`create-return-route.unit.spec.ts`, `lookup-business-central-customer.unit.spec.ts`|23/23|
|all unit specs|619/619 (48 suites; the finalization's 49th was removed in consolidation)|
|`store-bc-reads.spec.ts`|47/47|
|`company-sync.spec.ts`|39/39|
|`business-central-account.spec.ts`|8/8|
|`companies.spec.ts`|25 pass, 32 fail: the same 32 as the consolidation run, all 401 (NIMBUS-236)|
|Lint|0 errors, 13 warnings (same as finalization; none in touched files)|
|Typecheck|22 errors (baseline 22); none in touched files|

Review rework 1 (same setup; `blocked-bc.log` empty after every run):

|Spec|Result|
|---|---|
|all module specs|312/313; same `service.spec.ts` listOrders guardrail baseline failure|
|all unit specs|619/619 (48 suites)|
|`store-bc-reads.spec.ts`|52/52 (5 new)|
|`company-sync.spec.ts`|39/39|
|Lint|0 errors, 13 warnings (unchanged; none in touched files)|
|Typecheck|22 errors (baseline 22); none in touched files|
