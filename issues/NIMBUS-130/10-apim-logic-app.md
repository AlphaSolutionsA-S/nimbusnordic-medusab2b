# 10: APIM GET operation and Logic App workflow
**App:** Azure artifacts · **Layer:** none (deploy artifacts) · **Depends on:** 01, 09

**Goal:** Deployable artifacts for the customer path `GET /shipment-notices/{token}`: the APIM
operation policy, a new Logic App Standard workflow in the existing resource, parameters, deployment
instructions and manual test calls.
**Files / areas:** `issues/NIMBUS-130/artifacts/`. Follow the layout of
`issues/NIMBUS-145/artifacts/` and `issues/NIMBUS-146/artifacts/`, which stay untouched.
**Seam contracts:**
- **APIM inbound:** forwards only `after`, `since` and `limit` (`copy-unmatched-params="false"`),
  plus the Logic App's `sig` and `api-version` parameters.
- **APIM outbound,** when `Accept` contains `application/xml`:
  - renders a 200 JSON body to the task 01 XML (root `shipment_notice_response`);
  - renders any error body (400/401/404/5xx, including Logic App 401s and APIM's own errors) to
    `error_response`, mapping both JSON error shapes (task 01);
  - uses `set-body` (`JObject` → `XElement`) and sets `Content-Type: application/xml`.
  Otherwise the JSON passes through.
- **Logic App:**
  - Request trigger `GET shipment-notices/{token}`;
  - the same GlobalLists lookup and 401 bodies as the order workflow;
  - calls `/orderapi/shipment-notices?customerNumber=<url-encoded>` plus the three parameters when
    present, with the same Basic secret-key header;
  - returns Medusa's status and body.
- Run history is not hidden (accepted 2026-10-19).
**Test intent:** MANUAL (deploy artifacts). Test calls:
- unknown token (401);
- token without a customer number (401);
- first call; `after` paging;
- `Accept: application/xml` for a 200 and for a 401 and a 400 (XML error body);
- an injected `customerNumber` query parameter (ignored).
**Done when:** artifacts written; the deployment instructions walk through the task 01 JSON examples
producing the task 01 XML examples, success and error.
**Verify after deploy:** the manual test calls against the deployed APIM return the expected statuses
and XML bodies with roots `shipment_notice_response` and `error_response`.
**Also update:** none found.

## Deviations

- APIM inbound also sets `sp` and `sv` besides `sig` and `api-version`: the Logic App callback URL
  needs all four (NIMBUS-145 pattern).
- APIM's own errors (on-error) return the gateway shape `{ error, message }` in JSON too, not APIM's
  default `{ statusCode, message }`, which matches neither task 01 error shape; `error` is
  `LastError.Reason`, and `message` is passed on only for caller-facing sources (authorization,
  configuration, rate-limit, quota), otherwise a fixed text, so no backend URL can leak.
- Error mapping beyond the two task 01 shapes: a Logic App platform error (`{ error: { code,
  message } }`) maps `code`/`message`; a non-JSON body, or one with neither `type` nor `error`
  (APIM's default shape), gets the HTTP reason phrase as `<error>`.
- Characters XML 1.0 cannot carry (C0 controls except tab, CR, LF) are removed from text instead of
  failing the response with a 500.
- `JObject.Parse` (reader settings are not on APIM's allow-list) turns any ISO date-time string into
  a date. `recorded_at` is rendered back exactly (UTC, three fraction digits, like
  `Date#toISOString()`); a free-text field holding only an ISO date-time would be re-rendered in
  that form too. Accepted as an unrealistic edge.
- A 1xx–3xx response, or a 2xx without a `shipment_notices` array, is left untouched even with
  `Accept: application/xml` (the seam names only 200 and errors).
- `parameters.json` adds no parameter: the workflow reuses the four app-level NIMBUS-146 parameters
  (same GlobalLists list, same Basic secret key, as the seam asks); the file lists them as
  "already set".
- Logic App: the order workflow's unused `Compose_Matched_Value` is not copied; the Medusa call sends
  `Accept: application/json` and has no retries (a GET the caller repeats); the URL is built in a
  `Compose_Medusa_Url` action. The token lookup and both 401 branches are identical to the order
  workflow (checked by comparison).
- Test calls added beyond the intent: `since`, `after` + `since` (400), XML 404, an encoded
  injection through `after`, APIM's own error (subscription key) and an optional Medusa-unreachable
  case. The test file is `test-calls.md` (NIMBUS-146 used `test-payloads.md`; a GET has no payload).
- The offline render check (generator plus .NET harness) lives in the run scratchpad
  (`task10-render/`), not in the case folder, as task 01's validation scripts do.
- Resumption: the previous harness was unavailable. Recreated it under
  `.tmp/NIMBUS-130-20261019-resume/task10-render/` using a PowerShell expression extractor instead
  of the previous Node generator; no artifact or seam changes were needed. Backend checks were
  not repeated for this artifacts-only task; dispatcher measured 22 existing backend type errors.

## Done-when evidence

- Artifacts written: `issues/NIMBUS-130/artifacts/apim-policy.xml`,
  `logic-app-workflow-definition.json`, `parameters.json`, `deployment-instructions.md`,
  `test-calls.md`.
- Deployment instructions walk the task 01 JSON examples to the task 01 XML examples, success and
  error: `deployment-instructions.md` section 4 (success, service error, gateway error). Backed by
  resumption harness `.tmp/NIMBUS-130-20261019-resume/task10-render/` (`gen.ps1 -Artifacts <dir>`
  extracts the policy expressions verbatim; `dotnet run --project <harness> -- <artifacts>`
  compiles them against Newtonsoft.Json 13.0.3 under `da-DK`): all three example XML trees equal
  the task 01 examples and validate against the XSD; 69 checks, ALL PASS. The original run fixed
  `recorded_at` `.530Z` rendering as `.53Z`; the resumption checks cover `.530Z`, `.100Z` and an
  offset timestamp. Log: run scratchpad `task10-render/render-checks.log`.
- APIM inbound forwards only `after`/`since`/`limit` plus SAS parameters: policy text
  (`copy-unmatched-params="false"`, three conditional `set-query-parameter`); live behaviour: not
  provable in this task, needs deploy (test calls TC-4, TC-10, TC-11).
- APIM outbound XML for 200 and errors, JSON otherwise: harness checks "Accept application/json:
  JSON passes through", "400 invalid_data with code (code not rendered)", "401 Not allowed",
  "500 Medusa unknown_error", "502 non-JSON body", on-error JSON/XML checks; on the gateway: not
  provable in this task (TC-6 to TC-9, TC-12).
- Logic App: JSON well-formed; every `body()`/`outputs()` reference names an action; every
  parameter it reads is in `parameters.json`; token lookup and 401 branches identical to the
  NIMBUS-146 workflow; the Medusa URL expression emulated in Node (customer number and values
  url-encoded, absent parameters not forwarded, `after=0&customerNumber=…` stays one encoded
  value). Recreated `validate-workflow.cjs` evaluates the artifact's actual URL expression and
  compares lookup/401 branches to NIMBUS-146: 29 checks PASS, log in run scratchpad
  `task10-render/workflow-checks.log`. On Azure: not provable in this task (TC-1 to TC-5, TC-10, TC-11).
- Also update: none found (new artifacts; NIMBUS-145/146 artifacts stay frozen; no test, doc or
  `ai/` row describes this path yet; `docs/architecture/` is the documentation-writer's after ship).
