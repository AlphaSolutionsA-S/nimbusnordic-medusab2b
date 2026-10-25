# Deviation report: Show the size on shipment notice lines

> Record of NIMBUS-231, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-231` at f500507, merge-base 93d3c03 (`develop`). 7 commits: plan, tasks 01–04
(NIMBUS-238 to NIMBUS-241), fix-01 (stale-snapshot spec), consolidation. Backend only; no migration,
no table or column change. `git status` clean.

## Deviations from scope and plan

None blocking. All are recorded in the task files and match the diff.

- Task 01: a `TRCShipmentLine` row with a missing or non-string `variantCode` throws as a malformed row
  instead of mapping to null. Acceptable: BC sends `""` for "no variant"; this follows the plan's
  "a missing size is never guessed".
- Task 01: the company-name read goes through `getShipmentJson`, so its errors say "Business Central
  shipment request …" and it sends the harmless `Prefer: odata.maxpagesize` header. Acceptable, and the
  plan (§8) asked for it.
- Task 01: `getShipmentJson` and `getAllShipmentPages` are now generic over the row type
  (`service.ts:1115`, `:1168`). Existing callers are unchanged. Acceptable.
- Task 01: when BC's token response has no `expires_in`, neither the token nor the company name is
  cached, so each call reads the company name again. Acceptable: this matches the existing token rule,
  and it costs one extra GET per batch only in that case.
- Task 02: the missing-row check (B4) runs before netting, so a shipment with both a missing row and an
  unpairable correction fails `variant_missing`. The plan did not set the order; pairing needs the
  sizes, so this is acceptable. Consequence: if `TRCShipmentLine` loses rows for a shipment that was
  already notified and has not changed, that shipment's check fails (and eventually gives up) instead of
  "nothing". This matches the plan's B4 row and the doc's dependency-risk paragraph.
- Task 02: only `item` lines need a row (`comment` and `other` lines do not). This matches the plan's
  wording "every item line".
- Task 02: the empty-to-null mapping exists in both the adapter (`shipment-reads.ts:294-299`) and the L5
  rule (`decide-shipment-notice.ts:573`, `|| null`), so B1 holds in the rule on its own. Acceptable;
  the consolidation pass kept it on purpose.
- Task 02: an extra integration case was added (deadline before the size read). A stale comment was
  updated in `shipment-check-schedule.ts`. `pnpm ai:check --fix` regenerated `AGENTS.md` and
  `.github/copilot-instructions.md` after the `decisions.md` edit; these are the only generated-file
  changes. The fixture is no longer identical to the NIMBUS-130 customer example; task 04 publishes the
  new one. Acceptable.
- Task 03: the HTTP spec uses `dbConnection.raw` (test-only SQL) to strip the key from a stored row.
  It is the first spec in the repo to use raw SQL. Acceptable, since it is test-only.
- Task 04: the error schema and error examples were not copied (they did not change; the doc and the
  release note point to NIMBUS-130). Doc additions go beyond the Also-update list: a
  `modules/business-central` row and the full list of `last_error` codes. The release note adds a
  timing note: XML customers can switch early, JSON customers who validate switch at the release.
  Acceptable.
- Fix-01 (finalization): the stale-snapshot case in `check-shipments.spec.ts` failed with
  `variant_missing` because the size stub was built from an outdated `bcShipments`. The defect was in
  the test setup, which is now fixed; production code is unchanged and the assertion is unchanged.

## Consolidation changes

- Removed one duplicate fixture-only test ("carries a sized and an unsized line in the example") from
  `shipment-notice-contract.unit.spec.ts`. The same assertion lives in
  `shipment-notice-page.unit.spec.ts`.
- No code merged:
  - The two filters already share `buildEqualsAnyFilter`.
  - `getShipmentJson` and `getAllShipmentPages` are generic.
  - `getShipmentReadCompanyName` stays separate from `getCompanyName` on purpose (plan §8: the old one
    has no timeout, deadline or throttling classification).
- Empty-to-null mapping kept in both the adapter and the rule (see above).

## Findings

Design against the plan (§5 data model, §6 state table, §7 security matrix, §9 framework assumptions):
every row holds in the code.

- Data model: `variant_code` is written only by the check step, from `decideShipmentNotice`
  (`decide-shipment-notice.ts:203`). Every listed line carries it, including the quantity-0 lines of
  `revised` and `cancelled` notices, which take it from the current netted BC line.
  - Stored rows are never rewritten. The page builder fills null on read (`shipment-notice-page.ts:47`).
  - The stored-row type is loosened (`StoredShipmentNoticePayload`) while the write input stays strict.
  - The one other reader of stored payloads, `prepare-shipment-checks.ts:49-50`
    (`ListedLinesSchema`), parses only `bc_line_number`, so old rows still parse.
  - Content hash unchanged (B2), with a golden test.
- State table: all eight rows hold.
  - B5: the size read sits in the same `try` as the shipment read (`check-shipments.ts:210-228`), so
    throttling, the deadline and other errors behave exactly as for the shipment read.
  - B4: `variant_missing` fails only its own shipment, with the BC line number in the log line
    (`:144-146`). The log line also names the shipment and BC order number, as the plan requires.
- Security matrix: each control is in place and has its negative test.
  - Next link pinned to the BC origin: the variant read reuses `getAllShipmentPages` →
    `resolveShipmentNextLink`.
  - Request shape: GET only, exact `$select`.
  - OData filter escaping covers numbers and the company name (`buildODataCompanyParameter`).
  - Logs and `last_error` hold codes only.
  - A missing size is never guessed.
- Framework and vendor: no Medusa primitive is newly relied on. The `TRCShipmentLine` claims are
  verified (§9 rows 1–6; row 4 by Klaus's probe).
- Business rules: one home. The size join, the missing-row rule and size-aware undo pairing are in
  `B/workflows/shipment-notice/utils/decide-shipment-notice.ts`, and the `decisions.md` row is updated.
  The adapter holds no domain rule.

Mechanical wiring:

- Imports resolve; no new cast. The existing `response.json() as TBody` replaces the prior
  `as {…}` and is not `as unknown as`.
- No circular imports, no duplicate routes. Nothing depends on generated or gitignored files.
- All `IBusinessCentralModuleService` spies in integration specs stub the new read
  (`check-shipments`, `poll-shipment-notices`, `admin/shipment-tracking`), so no spec calls TestDK.
- No storefront or CMS consumer of shipment notices exists, so there is no cross-app change.
- Comments cite only issue keys; no plan, task or scope ids appear in source or test names.
- Whole-branch checks: no new module, no store route, no UI text, no env variable reaching the client.
- Also-update search done: `docs/architecture/order-api/shipment-notices.md` updated; `overview.md`
  needs no change; the Admin tracking page shows `last_error` as is, with no code map to extend.

Findings:

1. Low, no action needed: `StoredShipmentNoticeLine` (`shipment-notice-storage.ts:101`) is exported but
   has no importer outside its own file. It is used by the exported `StoredShipmentNoticePayload`. It is
   a type-only export, so there is no runtime cost; it can stay as the named stored-line type.
2. Low, informational: the size read requires `BUSINESS_CENTRAL_COMPANY_ID` in the shipment check run.
   It is already required by the return reads (NIMBUS-138/141) and is validated as a GUID before any
   request. If it were unset in an environment, every check there would fail `bc_error` and back off.
   It is covered by the after-deploy check below.

## Tests

- Security paths are tested on the branch:
  - foreign next link refused and never requested;
  - GET with exact `$select`;
  - quote escaping in shipment numbers and the company name;
  - throttling on the variant read and on the company-name read;
  - no BC text in errors, logs or `last_error`;
  - missing row → `variant_missing`, nothing stored;
  - deadline handling.
- Every §6 state row and §7 security row has a named test (task Done-when evidence; consolidation
  confirmed).
- Volume: tests +735/−10 lines in 9 files against source +235/−36 in 9 files (about 3:1). Most of it is
  `shipment-reads.unit.spec.ts` (+339, fetch-mock cases for one new adapter method with
  throttle/deadline/timeout/paging variants) and the decision-rule spec (+173). There is no remaining
  duplication beyond the case consolidation removed.
- Finalization:
  - Unit 917/917; admin 71/71.
  - Integration modules 548 passed, 2 failed. The two failures are the documented baseline
    (`service.spec.ts › listOrders › … round-trip guardrail`, source and compiled copy).
  - Integration HTTP: 79 failed, 257 passed. The 76 distinct failing tests are identical on `develop`
    93d3c03 (lists in the run scratchpad: `http-failures-branch.txt`, `http-failures-develop.txt`). The
    one branch-caused failure was fixed in 4625bf4. All shipment-notice, orderapi and shipment-tracking
    specs pass.
  - Typecheck 22 = baseline. Lint 0 errors (13 pre-existing warnings). Build OK.
  - No architecture check exists.

## Open questions

1. Release timing of the new schemas (B7). Customers who validate JSON against the closed NIMBUS-130
   schema will reject responses from the moment this deploys.
   - Options: (a) deploy and publish the new schemas from `issues/NIMBUS-231/artifacts/` at the same
     time (the plan's default); (b) send the release note and schemas to customers first, then deploy.
   - Not blocking the push, but decide before the deploy.
2. Confirm before publishing the schemas that the deployed APIM policy and Logic App match the
   NIMBUS-130 repo files (plan, Needs your decision 2; owner Klaus, at release). No code depends on it.

No other question needs an answer before push.

**Answers (Klaus Petersen, 2026-10-25, relayed by the main session):** Klaus said "push and merge to
develop" without choosing between the publishing options, so the plan's defaults are recorded.
1. (a): deploy and publish the new schemas from `issues/NIMBUS-231/artifacts/` at the same time.
2. Klaus checks the deployed APIM policy and Logic App against the NIMBUS-130 files before publishing
   the schemas, as agreed in the plan.
No answer needs a code change.

## Verify after deploy

- Task 02 (`variant_code` on notice lines: contract, decision rule, check wiring): `GET
  /orderapi/shipment-notices` (JSON and XML via APIM) for a TestDK shipment of a sized item (e.g.
  `HEND-L-MIDNBLUE`) recorded after deploy: `lines[].variant_code` equals the shipped size; an open
  shipment notified before the release gets no extra `revised` notice (`shipment_notice` row count for
  its `bc_shipment_id` unchanged).
- Task 03 (Notices stored before the release are served with `variant_code: null`): `GET
  /orderapi/shipment-notices` in TestDK for a company with notices recorded before the release: those
  notices' lines show `variant_code: null` (JSON) and no `<variant_code>` (XML).
- Task 04 (artifacts and docs), from its Done-when: a sized TestDK shipment shows its size through
  APIM in JSON and XML; listed in the release note's "After deploy".
- Task 01 (BC adapter reads `TRCShipmentLine`): no `Verify after deploy` line. Implied check: after the
  first poll run following deploy, no new `shipment_tracking` rows fail with `bc_error` or
  `variant_missing` (Admin shipment tracking page or job log). This confirms the ODataV4 read, the
  company-name read and `BUSINESS_CENTRAL_COMPANY_ID` in the deployed environment.
- Klaus: the deployed APIM `GET /shipment-notices/{token}` policy and the `shipment-notices` Logic App
  match `issues/NIMBUS-130/artifacts/apim-policy.xml` and `logic-app-workflow-definition.json` (plan,
  Needs your decision 2).
