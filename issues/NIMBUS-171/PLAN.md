# NIMBUS-171: Validate country codes in submitted orders

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-171

**Status:** Approved on 2026-09-30. The user answered "yes to all" in the main session, and the
main session relayed it to the planner. Branch `feature/NIMBUS-171` from `develop`.

## Objective
Reject any canonical order whose `billTo`/`shipTo` `country` is not an officially assigned ISO
3166-1 alpha-2 code, with the existing 400 before anything is created. Accept any case and
surrounding whitespace, and keep storing the code lower case on the Medusa order address.

## Analysis

**Where the value flows today.**
`POST /orderapi/orders` runs `validateAndTransformBody(CanonicalOrderSchema)`
(`apps/backend/src/api/orderapi/middlewares.ts`). Then `createOrderFromCanonicalPayloadWorkflow`
→ `createIngestedOrderStep` stores the order.
- `mapCanonicalOrderHeader` lowercases `country` into `shipping_address`/`billing_address.country_code`.
- The parsed body is kept verbatim in `metadata.canonical_order`.
- NIMBUS-148 later reads `metadata.canonical_order` (`bc-order-payload.ts`, `prepare-bc-order.ts`)
  and sends `address.country` unchanged as `billToCountry`/`shipToCountry` to Business Central.

The workflow does not re-validate, and the route is the only production entry point. So the
schema is the right single place for the check (D1).

**ISO list (D10).** Checked what is installed:
- `i18n-iso-countries` is **not** installed. Nor is any other ISO-country package: `node_modules`
  has only `react-country-flag` (storefront) and the i18next packages.
- Medusa ships `defaultCountries` (`@medusajs/utils`, re-exported from
  `@medusajs/framework/utils`, typed `{ alpha2, alpha3, name, numeric }`). It has 250 upper-case
  entries. It is the list Medusa's region module uses.
- The list includes `XK` (Kosovo), which is user-assigned, not officially assigned. It has no
  other user-assigned or reserved codes: none of `UK`, `EU`, `AA`, `ZZ`, `Q*` other than `QA`, or
  the withdrawn `AN`/`CS`/`YU`/`TP`.
- Medusa's list minus `XK` is exactly the 249 officially assigned codes. So: **no new
  dependency**. Use `defaultCountries`, remove `XK` explicitly, and pin the count at 249 in a
  unit test so that a Medusa upgrade changing the list fails the build's tests.

**Error format (D4).** Medusa's `zodValidator` turns zod failures into
`MedusaError(INVALID_DATA, "Invalid request: …")`, which is the existing 400. For `custom` issues it
uses the issue message as is, without the path. So our message carries the path. A throwaway
probe against the installed Medusa 2.21 / zod 4 confirmed the full path is available at message
time, and that the refine must run **before** the normalizing transform to echo the value sent. The result:
`Invalid request: Field 'shipTo.country' must be an ISO 3166-1 alpha-2 country code, but got: 'Denmark'`.

**Business Central country format (D8).** From `issues/NIMBUS-129/bc metadata/std odata metadata.xml`:
- `salesOrder.billToCountry` / `shipToCountry` / `sellToCountry` are `Edm.String`, `MaxLength="10"`.
  These are BC's Country/Region Code fields. They look up the `countryRegion` entity
  (`code`, `MaxLength="10"`).
- BC Code fields are upper case, and BC's standard Country/Region table uses ISO alpha-2 codes
  (`DK`, `SE`, …). The existing NIMBUS-148 tests send `"DK"`.
- **What is stored vs what BC gets.**
  - The Medusa order address stores lower case (`dk`).
  - BC does not read the Medusa address. It gets `metadata.canonical_order`.
  - With this plan that value is the trimmed **upper-case** code (`DK`), which fits BC's format.
  - Today it is whatever the sender typed.
- **Remaining gap (follow-up, not in this story):** a code that is valid ISO but missing from this
  tenant's BC Country/Region table will still fail at BC submission (NIMBUS-148 records it as a
  failed submission). Suggested follow-up: check the ISO codes customers use against BC's
  `countriesRegions` list, or add a BC-side check.

**The Unicode pitfall found during planning.** `"ß".toUpperCase()` is `"SS"` (South Sudan),
`"ıt"` becomes `"IT"` and `"ſe"` becomes `"SE"`. The backend therefore checks the ASCII two-letter
shape **before** it upper-cases.

**Whitespace.** The backend trims only space, tab, CR and LF, the same set the APIM pattern
allows. Then APIM (XSD `\s` is not Unicode-wide) can never reject a value the backend accepts.

**Guardrails.** Only backend and issue docs change. There are no migrations, no new network or DB
calls, and no storefront changes.

## Execution Plan
1. **Task 01: Backend rule.**
   - New `apps/backend/src/modules/order-ingestion/country-code.ts` holds:
     - `OFFICIAL_ISO_COUNTRY_CODES` (Medusa `defaultCountries` minus `XK`);
     - `COUNTRY_CODE_EXCEPTIONS`, an empty, documented allowlist (D11);
     - `normalizeCountryCode`;
     - `isAllowedCountryCode(value, exceptions = COUNTRY_CODE_EXCEPTIONS)`.
   - `CanonicalOrderAddressSchema.country` becomes `z.string().refine(isAllowedCountryCode, <message with path and raw value>).transform(normalizeCountryCode)`.
   - Mapping is unchanged (still lowercases).
   - Unit tests for the helper, the schema and the parse → map wiring.
2. **Task 02: Integration tests.** HTTP tests in `orders.spec.ts`:
   - an invalid `shipTo` country gives 400 with the exact message and no order or reference;
   - `billTo` `XX` gives 400;
   - `" se "` gives 201, stored `se`, metadata `SE`.

   Workflow test in `create-order-workflow.spec.ts`: both addresses are persisted lower case from a
   schema-parsed payload.
3. **Task 03: Contract artifacts.**
   - Shape-only pattern in the NIMBUS-145 JSON Schema and XSD (`[ \t\n\r]*[A-Za-z]{2}[ \t\n\r]*`).
   - Test-payloads TC-16/TC-17 and TC-13c, a deployment-instructions note, and the NIMBUS-147
     contract description bullet.
   - A backend unit test that reads both artifacts and proves every backend-accepted value passes
     APIM.
4. **After implementation (manual, not the implementor):** re-register the two schemas in APIM and
   run the manual payloads.

## Decisions & Trade-offs
- **Medusa `defaultCountries` over a hand-kept list.** It is already installed and it is what
  Medusa regions use. The cost is one explicit `XK` exclusion and a count-pinning test against
  upgrade drift. The alternative is a fixed 249-code literal in the backend: no upgrade coupling,
  but a list to maintain. The user chose Medusa's list (Q2 (a), 2026-09-30).
- **Canonical value normalized to upper case** (`" se "` → `"SE"`) in `metadata.canonical_order`.
  So Business Central gets its own code format, and the metadata is the canonical form. The Medusa
  address stays lower case (D3). Trade-off: the metadata no longer holds the sender's exact
  spelling. The 400 message still echoes the raw value. The user approved this (Q1, 2026-09-30).
- **Message format** `Field 'shipTo.country' …` uses the dotted path from D4's example. Medusa's
  built-in messages write paths as `shipTo, country`. We chose the D4 form because it reads better
  for external senders.
- **Allowlist is a parameter-defaulted `ReadonlySet`**, so tests can show an added code is accepted
  without changing the check (D11). Production code never passes the parameter.
- **APIM stays generic.** Its 400 body does not name fields (NIMBUS-145 design). Non-two-letter
  values (`Denmark`, `DNK`) are stopped there with the generic body. The detailed D4 message
  reaches senders only for two-letter values that are not codes (`XX`, `XK`), because the backend
  rejects those.
- **No change to `map-canonical-order-header.ts` or `bc-order-payload.ts`.**
- **The BC check (scope task 3) is done in this plan**, and no code task is needed for it.

## Risks
- **Behavior change for senders.** Orders that were accepted before with `DNK`, `Denmark` or `XX`
  now get a 400. Customer systems that send names or alpha-3 codes need to be told before APIM and
  the backend are deployed.
- **Medusa upgrade drift.** If `defaultCountries` changes, TC-1 in `country-code.unit.spec.ts`
  fails on purpose, and someone has to review it.
- **BC Country/Region table coverage** (see Analysis): valid ISO codes that BC does not know still
  fail at submission. Follow-up suggested.
- **APIM redeploy is manual.** Until the schemas are re-registered, APIM keeps accepting any
  non-empty country. The backend still rejects bad values, so correctness holds and only the early
  rejection is missing.
- **Test couples to the issue folder.** `apim-country-shape.unit.spec.ts` reads
  `issues/NIMBUS-145/artifacts/*`. Moving those files breaks the test, which is intended: the
  artifacts are the deployable source.
- **HTTP integration tests need the local test database.** If it is not available, the implementor
  must say so rather than skip silently.

## Resolved decisions (approved 2026-09-30)
The user answered "yes to all" in the main session. Each answer matches the recommendation.

1. **Q1, plan approval: approved.** Tasks 01–03 go ahead as written. That includes normalizing the
   canonical value to upper case (`" se "` → `SE` in `metadata.canonical_order`, which BC
   receives) and storing `se` on the Medusa address.
2. **Q2, ISO list source: option (a).** Use Medusa's installed `defaultCountries` minus `XK`, pinned
   by the count test (249). There is no fixed list in the backend and no new dependency.
3. **Q3, APIM testing: manual testing accepted.** The deployed APIM policy is tested by hand. It is
   covered by the automated consistency test (`apim-country-shape.unit.spec.ts`) plus manual
   payloads TC-16, TC-17 and TC-13c after the redeploy.

## Verification
- [ ] `cd apps/backend && pnpm test:unit` is green:
  - `country-code.unit.spec.ts` TC-1–TC-6: 249 official codes pinned; any case and padding
    accepted; `DNK`/`Denmark`/`XX`/`XK`/`UK`/`EU`/empty rejected; the `ß`/`ıt`/`ſe`/NBSP bypass is
    closed; the allowlist is empty and works when a code is added.
  - `canonical-order-schema.unit.spec.ts` TC-15–TC-19: the message names the path and the value
    sent; `billTo` is covered; both addresses are reported; type error.
  - `map-canonical-order-header.unit.spec.ts` TC-3: `" se "` → `se`.
  - `apim-country-shape.unit.spec.ts` TC-1–TC-3: APIM never rejects what the backend accepts.
- [ ] `cd apps/backend && pnpm test:integration:http` is green:
  - `orders.spec.ts` TC-8: `Denmark` gives 400 with the exact message and no order or reference.
  - TC-9: `billTo` `XX` gives 400.
  - TC-10: `" se "` gives 201, stored `se`, metadata `SE`.
  - `create-order-workflow.spec.ts` TC-11: both addresses are stored lower case.
- [ ] `pnpm build` and `pnpm lint` pass.
- [ ] After APIM redeploy: manual test-payloads TC-16 (400 generic), TC-17 (201), TC-13c (Medusa 400
  passed through).
