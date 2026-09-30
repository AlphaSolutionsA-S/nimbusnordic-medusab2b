# NIMBUS-171: Validate country codes in submitted orders

## 2026-09-29 - Created from NIMBUS-149 code review

- **Outcome:** Follow-up to NIMBUS-147 raised in Jira (child of epic NIMBUS-129, linked to
  NIMBUS-147 and NIMBUS-149). The canonical schema accepts any string for `country`
  (`apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`, `z.string().min(1)`),
  and since NIMBUS-149 `mapCanonicalOrderHeader`
  (`apps/backend/src/workflows/order-ingestion/utils/map-canonical-order-header.ts`) lowercases
  it straight into the order address's `country_code`. Values like "DNK" or "Denmark" are stored
  as invalid codes. Decide whether validation lives in the zod schema, in NIMBUS-145's APIM
  contract, or both, and update the XML/JSON contract docs.
- **Handover to:** scoper agent
- **Handover prompt:** Scope NIMBUS-171 from this PROGRESS.md and the Jira issue: require
  ISO 3166-1 alpha-2 country codes on canonical order addresses, reject invalid values with a
  validation error before order creation, and reflect the rule in the NIMBUS-147/NIMBUS-145
  contracts. Create SCOPE.md in this folder.

## 2026-09-30 - Scope drafted, awaiting direct user approval

- **Updated by:** scoper agent
- **Outcome:** `SCOPE.md` written as a Story, Medium, size S, base branch `develop`. It records
  the user's answers from 2026-09-30, relayed through the main session, as decisions D1–D11. The
  backend checks ISO 3166-1 alpha-2 codes on every order address: any case, trimmed, stored in
  lowercase, with an empty, documented exceptions allowlist for later. APIM and the contracts
  run only a shape check. Invalid codes get the existing 400 validation error before order
  creation. The user's reply on the last open questions was relayed as approval with
  amendments. The scoper does not treat a relayed message as approval, so the scope is not yet
  marked approved. No Jira change: the description is non-empty and already states the goal.
- **Handover to:** user — confirm approval of `SCOPE.md` directly. Then the scoper (or main
  session) records approval here and hands over to the implementation-planner.
- **Handover prompt (for the implementation-planner, after approval):** Plan NIMBUS-171 from
  `issues/NIMBUS-171/SCOPE.md` (decisions D1–D11). Make the canonical order address `country`
  in `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts` trim input, ignore
  case and accept only officially assigned ISO 3166-1 alpha-2 codes. Take the list from an
  already-installed library, or else a fixed backend list, and put one documented, empty
  exceptions allowlist next to the check. Return the existing 400 validation error, naming the
  field path and the value sent, before anything is created. Keep lowercasing in
  `map-canonical-order-header.ts`. Add a shape-only check (two letters, any case, spaces
  allowed around them) to the NIMBUS-145 JSON schema and XSD in `issues/NIMBUS-145/artifacts/`.
  Update the test payloads and the NIMBUS-147 contract description. Check what country format
  the Business Central payload (NIMBUS-148) needs and record it. Extend the schema, mapping and
  HTTP integration tests. No storefront changes and no data cleanup.

## 2026-09-30 - Scope approved

- **Updated by:** main session
- **Outcome:** The user approved `SCOPE.md` directly in the main session. They gave the OQ
  answers that became D9–D11: "1 no second list - smaller check in APIM / 2 yes / 3 fine - but
  have a place to handle exceptions". Then they approved the rest: "approved for the rest".
  SCOPE.md status is set to approved. Implementation planning is the next stage. No Jira
  change: the status stays Scoping until the planning stage moves it on.
- **Handover to:** implementation-planner
- **Handover prompt:** Use the implementation-planner handover prompt in the previous entry
  ("Scope drafted, awaiting direct user approval"). The scope is now approved.

## 2026-09-30 - Implementation plan drafted, awaiting user approval

- **Date:** 2026-09-30
- **Updated by:** implementation-planner agent
- **Outcome:** `PLAN.md`, `manifest.md` and three task files written. Branch `feature/NIMBUS-171`
  was created from `develop` and checked out. The uncommitted NIMBUS-171 docs carried over, and
  nothing was committed. Jira is unchanged.
  - **Tasks.**
    - 01: backend rule. New `country-code.ts` and the schema `country` refine + normalize, with
      unit tests.
    - 02: HTTP and workflow integration tests.
    - 03: APIM shape-only pattern in the NIMBUS-145 JSON Schema/XSD, test payloads, deployment
      note, the NIMBUS-147 contract bullet, and an artifact-consistency unit test.
  - **ISO list.** No ISO package is installed (`i18n-iso-countries` is absent). Medusa's
    `defaultCountries` (`@medusajs/framework/utils`, 250 codes) minus `XK` gives the 249 officially
    assigned codes. No new dependency.
  - **Business Central format.** BC `billToCountry`/`shipToCountry` are Country/Region Codes
    (`Edm.String`, max 10, upper case, ISO alpha-2 in the standard table). BC reads
    `metadata.canonical_order`, which the plan normalizes to upper case. Follow-up suggested: check
    that the BC Country/Region table covers the codes customers use.
  - **Planning gate.** Open questions for the user are in PLAN.md "Questions for the user":
    Q1 plan approval, Q2 ISO list source, Q3 manual APIM testing. `manifest.md` "Ready for
    Dispatch" is false until approval.
- **Handover to:** user, for plan approval (PENDING USER APPROVAL). After approval, the main
  session sets `manifest.md` "Ready for Dispatch" to true, records the answers here, and hands over
  to the implementor agent.
- **Handover prompt (for the implementor agent, only after user approval):** Implement NIMBUS-171
  on branch `feature/NIMBUS-171` from `issues/NIMBUS-171/manifest.md`, in dependency order:
  Task 01, then Tasks 02 and 03. Follow each task file verbatim: code skeletons, file paths, test
  cases. Apply the user's answers to PLAN.md Q1–Q3 recorded in this PROGRESS.md. If Q2 was
  answered "(b) fixed list", replace the `defaultCountries` source in `country-code.ts` with a
  literal 249-code set and keep all tests.
  - Run `cd apps/backend && pnpm test:unit`, `pnpm test:integration:http`, `pnpm build`, and
    `pnpm lint` from the root. If the HTTP suite cannot run locally, say so explicitly.
  - Do not deploy to APIM, do not change Jira, and do not commit unless the user asks.
  - When done, append a PROGRESS.md entry that lists the manual follow-ups: re-register both APIM
    schemas (NIMBUS-145 deployment-instructions section 2), run test-payloads TC-16/TC-17/TC-13c,
    and tell customer systems that non-ISO countries are now rejected.

## 2026-09-30 - Implementation plan approved

- **Date:** 2026-09-30
- **Updated by:** implementation-planner agent, on the main session's instruction. The user gave
  the approval directly in the main session, which relayed it.
- **Outcome:** The user approved the plan with "yes to all". Each answer matches the recommendation.
  - **Q1, plan approval.** Tasks 01–03 are approved. That includes storing the country upper case
    in `metadata.canonical_order` (`SE`, which Business Central receives) and lower case on the
    Medusa order address (`se`).
  - **Q2, ISO list.** Option (a): Medusa's installed `defaultCountries` minus `XK`, pinned at 249 by
    a count test. No new dependency.
  - **Q3, APIM testing.** Manual testing of the deployed APIM policy is accepted. It is covered by
    the automated consistency test plus manual payloads TC-16, TC-17 and TC-13c after the redeploy.

  PLAN.md ("Resolved decisions") and the three task files record the answers. `manifest.md` is
  "Ready for Dispatch: true". Branch `feature/NIMBUS-171` is checked out. Nothing is committed, and
  Jira is unchanged.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-171 on branch `feature/NIMBUS-171` from
  `issues/NIMBUS-171/manifest.md`, in dependency order: Task 01, then Tasks 02 and 03. Follow each
  task file verbatim: code skeletons, file paths, test cases. The approved decisions are in
  PLAN.md "Resolved decisions":
  - use Medusa `defaultCountries` minus `XK` (249 codes);
  - normalize the canonical `country` to the trimmed upper-case code;
  - keep the lower-case mapping onto the Medusa address;
  - test APIM by hand after redeploy.

  Then:
  - Run `cd apps/backend && pnpm test:unit`, `pnpm test:integration:http`, `pnpm build`, and
    `pnpm lint` from the root. If the HTTP suite cannot run locally, say so explicitly.
  - Do not deploy to APIM, do not change Jira, and do not commit unless the user asks.
  - When done, append a PROGRESS.md entry that lists the manual follow-ups: re-register both APIM
    schemas (NIMBUS-145 deployment-instructions section 2), run test-payloads TC-16/TC-17/TC-13c,
    tell customer systems that non-ISO countries are now rejected, and consider a follow-up that
    checks BC's Country/Region table covers the codes customers use.

## 2026-09-30 - Implementation complete, ready for code review

- **Date:** 2026-09-30
- **Updated by:** implementor agent
- **Outcome:** Tasks 01, 02 and 03 are DONE (manifest and task files updated). Branch
  `feature/NIMBUS-171`. Nothing committed or pushed. Jira unchanged. Nothing deployed to APIM.
  - **Task 01:** new `apps/backend/src/modules/order-ingestion/country-code.ts` (Medusa
    `defaultCountries` minus `XK` = 249 codes, empty documented `COUNTRY_CODE_EXCEPTIONS`,
    `normalizeCountryCode`, `isAllowedCountryCode`). `canonical-order-schema.ts` address `country`
    now uses `CanonicalCountryCodeSchema` (refine on the raw value, then normalize to trimmed upper
    case). Unit tests: new `country-code.unit.spec.ts` (TC-1–TC-6), `canonical-order-schema.unit.spec.ts`
    TC-15–TC-19, `map-canonical-order-header.unit.spec.ts` TC-3. Mapping code unchanged.
  - **Task 02:** `integration-tests/http/orderapi/orders.spec.ts` TC-8–TC-10 (plus helper
    `listOrdersForExternalNumber` and `countryTestAddress`), `create-order-workflow.spec.ts` TC-11.
    No production code changed.
  - **Task 03:** NIMBUS-145 JSON Schema and XSD shape-only pattern, test-payloads (TC-13c, TC-16,
    TC-17, APIM-only list, summary rows), deployment-instructions note, NIMBUS-147 SCOPE bullet, and
    new `apim-country-shape.unit.spec.ts` (TC-1–TC-3).
- **Deviations from the task files:**
  - `apim-country-shape.unit.spec.ts`: the skeleton's fixed `../../../../../../issues/...` path
    broke after `pnpm build`, because `pnpm test:unit` also runs the compiled copy under
    `apps/backend/.medusa/server/...` (two levels deeper), which failed with `ENOENT ...
    apps\backend\issues\NIMBUS-145\artifacts\canonical-order-schema.json`. Replaced with a small
    `findArtifactsDir()` that walks up from `__dirname` until `issues/NIMBUS-145/artifacts` exists.
    The test cases are unchanged.
  - Everything else was applied as written in the task files.
- **Test environment (shell only, no `.env` written):** `pnpm` via `corepack pnpm` (9.15.0), with a
  `pnpm.cmd` shim in the session scratchpad on PATH so turbo can find it. Dummy
  `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` for the storefront lint. For the HTTP suite: a throwaway
  `postgres:16` container `nimbus171-test-pg` on port 55171 (`DB_HOST`, `DB_PORT`, `DB_USERNAME`,
  `DB_PASSWORD`) and a dummy TestDK-shaped `BUSINESS_CENTRAL_DISCOVERY_URL`. For the quotes-only
  rerun, dummy `JWT_SECRET` and `COOKIE_SECRET` too. The container is stopped and removed.
- **Validation (commands and results):**
  - Baseline before any edit, `cd apps/backend && pnpm test:unit`: 19 suites, 110/110 passed.
  - `cd apps/backend && pnpm test:unit` (final, after `pnpm build`): 23 suites, 140/140 passed.
    That includes the `.medusa/server` compiled copies of the new specs.
  - `cd apps/backend && pnpm build`: backend and frontend build completed successfully. Its lint
    step reports 0 errors and 13 warnings, all in pre-existing untouched files.
  - `pnpm lint` (root, turbo): 3/3 tasks successful. Backend 0 errors and 13 warnings, the same 7
    untouched files (`initial-data-seed.ts`, `business-central-test-environment.ts`,
    `create-approvals.ts`, `update-approval-statuses.ts`, `validate-add-to-cart.ts`,
    `validate-cart-completion.ts`, `validate-update-cart.ts`). Storefront shows only pre-existing
    `react-hooks/exhaustive-deps` warnings.
  - `cd apps/backend && pnpm test:integration:http -- integration-tests/http/orderapi/orders.spec.ts integration-tests/http/order-ingestion/create-order-workflow.spec.ts`:
    2/2 suites, 21/21 passed (orders TC-1–TC-10, workflow TC-1–TC-11).
  - `cd apps/backend && pnpm test:integration:http` (full): 9/11 suites, 107/115 passed. The 8
    failures are pre-existing, in `quotes/quotes.spec.ts` (7) and `admin/quotes/quotes.spec.ts`
    (1), which is the same count NIMBUS-148 recorded. The 7 store failures first showed
    `secretOrPrivateKey must have a value` because `JWT_SECRET` was unset. A rerun of the two
    quotes suites with dummy secrets gave the known `AxiosError: Request failed with status code
    400` at `cartSeeder (integration-tests/utils/seeder.ts:57:5)`, `POST /store/carts`. The admin
    failure in the full run is the same `cartSeeder` 400. In the rerun it failed earlier, in
    `regionSeeder` with a 401 under the dummy secret. Neither path touches the order API or the
    canonical schema.
  - `npx tsc --noEmit -p .` (backend, informational; `medusa build` skips type errors): 22 errors in
    the 6 `integration-tests/` files that NIMBUS-172 already recorded (18 errors). The 4 extra are the
    new `createCompanies({...})` calls in TC-8/TC-9/TC-10/TC-11. They copy the pattern of the
    existing tests, which fail the same way (`ModuleCreateCompany` requires phone, address, ...).
    No errors in `src/`. Not fixed, as it is out of scope.
  - `node -e "JSON.parse(...canonical-order-schema.json...)"`: valid.
- **Not done (manual, outside implementor scope):**
  - Re-register both schemas in APIM (NIMBUS-145 deployment-instructions section 2), then run
    test-payloads TC-16, TC-17 and TC-13c.
  - Tell customer systems that non-ISO countries (`Denmark`, `DNK`, `XX`) are now rejected with a
    400, before the backend and APIM are deployed.
  - Consider a follow-up that checks BC's Country/Region table covers the ISO codes customers use.
- **Handover to:** code review (code-review skill), then the main session for commit.
- **Handover prompt:** Review NIMBUS-171 on branch `feature/NIMBUS-171` (uncommitted working tree)
  against `issues/NIMBUS-171/PLAN.md`, `SCOPE.md` D1–D11 and the three task files. Focus on:
  - `apps/backend/src/modules/order-ingestion/country-code.ts` and the `country` change in
    `canonical-order-schema.ts` (error message echoes only the field path and the sent value; ASCII
    shape check before upper-casing);
  - the walk-up path deviation in `apim-country-shape.unit.spec.ts`;
  - the NIMBUS-145 JSON Schema/XSD patterns, which must never reject what the backend accepts.

  Rerun `cd apps/backend && pnpm test:unit` and `pnpm build`, and `pnpm lint` from the root. The
  HTTP suite needs a test Postgres and the shell-only env values listed above. Do not deploy to
  APIM or change Jira as part of the review.

## 2026-09-30 - Code review (Alpha checklist)

- **Updated by:** main session
- **Outcome:** Reviewed the uncommitted NIMBUS-171 diff on `feature/NIMBUS-171`: the new
  `country-code.ts`, `canonical-order-schema.ts`, the NIMBUS-145 JSON schema and XSD, the
  NIMBUS-147 contract note, and the unit and HTTP tests. No must-fix items. What the review
  confirmed:
  - The check runs on the raw value before normalizing, and requires two ASCII letters before
    upper-casing (this covers the Unicode case-mapping trap).
  - The trimmed whitespace set matches the APIM pattern. The JSON pattern is explicitly
    anchored, and the XSD pattern is implicitly anchored.
  - The exceptions allowlist is one documented, empty set, as D11 requires.
  - The consistency test proves APIM never rejects a code the backend accepts.
  - Type failures are caught by `z.string()` before the refine runs.
  - The unit and HTTP tests cover the rejected values ("Denmark", "XX") and normalization.
- **should:** the 400 message repeats the sent `country` value in full, with no length limit.
  Behind APIM only two-letter values get through. A direct call to the backend could make the
  error echo a long string. Consider cutting the echoed value to about 20 characters. This is
  optional and low risk.
- **nit:** the `NOT_OFFICIALLY_ASSIGNED_CODES` set (XK) and the exceptions set sit next to
  each other in `country-code.ts`. The comments explain the difference, so no change is needed.
- **Still manual:** re-register both schemas in APIM (NIMBUS-145 deployment instructions,
  section 2) and run test payloads TC-16, TC-17 and TC-13c. Tell customer systems about the
  rule before deployment.
- **Next owner:** user. Decide on the truncation should-item, then commit and merge.

## 2026-09-30 - Review fix: cap the echoed country value

- **Updated by:** main session
- **Outcome:** Fixed the review's should-item, as the user asked. `canonical-order-schema.ts` now
  echoes at most 20 characters of a rejected `country` value, adding "..." when it is cut. New
  unit test TC-16b in `canonical-order-schema.unit.spec.ts`. Short values like "Denmark" are
  still echoed in full, so the existing HTTP assertions are unchanged.
- **Verification:** `TEST_TYPE=unit jest src/modules/order-ingestion` gave 10 suites, 77 of 77
  tests passed. ESLint on `canonical-order-schema.ts` gave 0 errors.
- **Next owner:** user. Commit and merge to develop, then do the manual APIM steps from the
  code review entry.

## 2026-09-30 - Committed and merged to develop

- **Updated by:** main session
- **Outcome:** Committed on `feature/NIMBUS-171` as `ded0f97`, on top of the plan commit
  `9158a8a`. Merged into `develop` (no fast-forward) as `231c951`. Local develop had diverged
  from `origin/develop`, which had two new commits with NIMBUS-175 plan docs and NIMBUS-129 e2e
  test cases, docs only. These were merged in with `git pull --no-rebase` (`0e68a8a`), without
  conflicts. The new NIMBUS-129 e2e sample orders use `DK`, which the new rule accepts. Not
  pushed. Jira not updated (NIMBUS-171 is still in Estimation).
- **Still open:** re-register both schemas in APIM (NIMBUS-145 deployment instructions,
  section 2) and run test payloads TC-16, TC-17 and TC-13c. Tell customer systems about the
  rule before deployment.
- **Next owner:** user. Push develop, update Jira, and do the manual APIM steps.
