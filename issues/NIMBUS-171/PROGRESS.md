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
