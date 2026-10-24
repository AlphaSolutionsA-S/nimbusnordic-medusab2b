# Deviation report: Order API matches size barcodes to the right Business Central item and size

> Record of NIMBUS-180, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-180` at `a994408`, merge-base `eea3a01` (`develop`). Commits: `1f91a1e` (plan),
`3ec103c` (NIMBUS-232, task 01), `7909708` (NIMBUS-233, task 02), `f016624` (NIMBUS-234, task 03),
`915dfb9` (NIMBUS-235, task 04), `a994408` (consolidation). Tree clean, not pushed.

## Deviations from scope and plan

- **Blocking (needs a human): `pnpm ai:check` fails on size.** The new business-rule registry row in
  `ai/architecture/decisions.md` (task 02) takes the generated root `AGENTS.md` to 32 880 bytes, over
  the 32 768-byte limit Codex reads. It was about 32 710 bytes before the branch, so no row fits
  without trimming other Tier 0 text (about 112 bytes). See open question 1.
- Item numbers and size codes are compared trimmed and case-insensitively, like units (task 02). The
  plan's decision 4 names only units; BC stores all three upper-case. Acceptable: same reasoning as
  decision 4.
- A line without a unit whose Item Reference row names an item the number read did not return keeps
  that row (base unit unknown), so the line is refused as `not_found` (state table row 9), not
  `unit_mismatch` (task 02). Acceptable: matches row 9.
- A size code on an item without sizes refuses as `size_unresolved` (plan section 8; the state table
  covers it only implicitly). Tested. Acceptable.
- Input with no usable barcode and no usable item number returns empty evidence with no request at
  all, including no token request (task 01). Acceptable: needed for the 21-character negative case.
- Reads run one request at a time, not in parallel; the Item Reference read adds one company-name
  request per order through `getODataV4Url` (not cached) (task 01). Acceptable: same load profile as
  before, documented in the request budget.
- A non-OK read, including 429, throws a plain `MedusaError` with the status only, not
  `BusinessCentralThrottledError` (task 01). Acceptable: the step maps any thrown error to
  `bc_item_lookup_failed`, as the plan requires.
- The item-card barcode read also expands `itemVariants` (task 01). Required by rule rows 7 and 8.
- New adapter tests are fetch-mocked in `__tests__/item-lookup-evidence.spec.ts` (no `.unit` suffix),
  so they run under `test:integration:modules`, like the module's other fetch-mocked specs (task 01).
  Acceptable.
- Task 03 also removed the private `findItemsByFilter` (its only caller was the removed lookup) and
  added a `beforeEach` in `send-order-to-bc.spec.ts` that makes `globalThis.fetch` reject, so an
  unstubbed BC call fails the test instead of reaching a tenant. Acceptable.
- The "Admin GET returns the new reason" check is a new test in
  `integration-tests/http/admin/bc-integration.spec.ts`, whose fake vendor now also answers
  `/companies(<id>)` and ODataV4 `ItemReferenceEntries`. **Unverified**: the spec fails locally with
  401 on admin auth, at `develop` as well (see Tests). See open question 2.
- Task 04 added two rows to the doc's Components table and counts the token and company-name reads
  in the request budget. Acceptable.

No hand-written migration, no data-model change, no new endpoint, no new module.

## Consolidation changes

- Removed the scope id "scope F3" from a comment and renamed 22 "row N:" test titles in
  `resolve-order-line-item.unit.spec.ts` to behaviour descriptions (Tier 0 `no-plan-id-comments`).
- Made `ITEM_LOOKUP_VALUES_PER_REQUEST` in `item-lookup-evidence.ts` module-private (only used there).
- No behaviour or seam change; no duplicate helpers; overlapping reason tests at the parse, DTO and
  HTTP layers kept, since each covers a different contract.
- Left as they predate the branch: `TC-N` titles and the NIMBUS-129 `PROGRESS.md` / `SCOPE.md`
  comments in `prepare-bc-order.ts`.

## Findings

Design, checked against the plan's tables (no blocking design finding):

- Layers hold. The adapter (`modules/business-central/service.ts` `getItemLookupEvidence`,
  `item-lookup-evidence.ts`) only reads and maps, with no type, unit or match decision. The rule is
  pure L5 in `workflows/business-central-order/utils/resolve-order-line-item.ts`, importing types only.
  The step (`steps/prepare-bc-order.ts:217-264`) wires them. One home for the rule, registered in
  `decisions.md`; the old adapter decision (`findItemsForOrderLines`, `buildItemLookupCandidates`) is
  fully removed, and no live reference remains outside frozen case folders.
- State table rows 1-12 map to code: unit filter `rowUnitFits` (row 2 → `unit_mismatch`), ambiguity on
  more than one item or size code with no fallback (rows 3-4, decision 2), size resolution
  `resolveSize` (rows 5-8, 11), item missing from evidence → `not_found` (row 9), and the number
  fallback `resolveByNumber` only when the barcode matches nothing (rows 10-12). Order-level outcomes
  (`partial`, `no_lines_resolved`, `bc_item_lookup_failed`) are unchanged in the step.
- Security matrix: escaping uses the existing `escapeODataString` in every `or` term
  (`service.ts`, `fetchItemLookupRows`); values over 20 characters are dropped in
  `collectItemNumbers` (`item-lookup-evidence.ts:113-121`); errors carry the status or a fixed
  message only; refusals are reason codes; new reasons are added to the parsed list in
  `bc-integration-state.ts`. Negative tests for each property are present (see Tests).
- Framework assumptions: the ODataV4 and API v2.0 call shapes are used as probed. `itemVariantId` on
  POST is still verified only from documentation (decision 3, accepted); the after-deploy check proves
  it.
- Low, note only: the rule compares item numbers case-insensitively, but BC's `number eq '<value>'`
  filter was not probed for case (branch notes, task 01). A lower-case item number may find nothing in
  BC and refuse as `not_found`. This is no regression (the old lookup sent the same raw value) and
  applies only to the fallback for items without sizes.

Mechanical wiring:

- Imports resolve. The rule imports types only from the module's `types.ts` and
  `order-ingestion/bc-integration-state.ts`, as the existing utils in that folder do. No circular
  imports, no `as unknown as`, no new `any`.
- Line failures are paired by index with `toLineIdentifiers(payload)`, which maps `payload.lines` in
  the same order (`prepare-bc-order.ts:80-87`). Correct.
- Exported but not imported elsewhere: `BCItemVariant` (`types.ts`), `OrderLineItemInput` and
  `OrderLineItemResolution` (`resolve-order-line-item.ts`). They type a public signature (the
  `variants` field, and the exported rule's parameter and return), so they are kept. Not a defect.
- `git status` is clean. No new module, store route, storefront UI text or client-side env var, so
  the whole-branch checks in `verification.md` don't apply beyond this.
- Comment rule: one modified test title keeps a pre-existing test-case id,
  `sales-order-create.spec.ts` "TC-3: sends lineType Item, the itemId, the size, and nothing Business
  Central prices". The branch changed this title, but the prefix predates it and matches the file's
  other titles. Low; left as consolidation decided.
- Also update: no stale reference in `docs/`, `ai/` or `apps/` to the removed lookup. The
  canonical-schema comment was corrected and `docs/architecture/business-central-order.md` documents
  the new resolution.

## Tests

Finalization (dispatcher run): `test:unit` 840/840, `test:admin` 71/71. Typecheck 22 errors, the same
as the baseline. Backend build passes. `test:integration:modules`: only the known baseline failure
(the `service.spec.ts` listOrders guardrail, plus its stale `.medusa` copy). `test:integration:http`:
7 suites fail with admin-auth 401. The same 77 tests fail at `develop` `eea3a01`
(`base-failed-tests.txt` vs `branch-failed-tests.txt` in the run folder). The only extra failure is
the branch's new test "returns the size and unit refusal reasons of a partial submission"
(`integration-tests/http/admin/bc-integration.spec.ts`), with the same 401, so it is **unverified**.
All business-central-order, orderapi, order-ingestion and shipment-notice specs pass.
`ai/architecture/verification.md` lists only the quote HTTP specs as a failing baseline; local admin
auth now fails more broadly at `develop` too.

Security-path coverage (plan section 7):

- Escaping: an item number containing `'` and ` or ` is sent as one escaped literal, and a
  21-character number causes no request (`item-lookup-evidence.spec.ts`).
- No response body in errors: tests for 500, 429 and 400, next link, and a read that does not
  complete. The exact log line for `bc_item_lookup_failed` is asserted (`send-order-to-bc.spec.ts`).
- An unknown reason still parses: covered by existing tests.
- No size omitted for an item with sizes: rule tests for rows 6, 8 and 11, plus the HTTP test
  "sends no line without its size".

Volume (`apps/backend` vs merge-base): tests +1217/-319, source +485/-204, about 2.5:1 added and 3.2:1
net. Most of it is the 12-row rule table plus negatives and the fetch-mocked request-shape tests. The
reason checks overlap at the parse, DTO and HTTP layers, but each covers a separate contract, so none
looks redundant.

## Open questions

1. **`ai:check` size overrun (blocking for `ai:check`).** The root `AGENTS.md` is 32 880 bytes, over
   the 32 768-byte Codex read limit, after the `decisions.md` row. Options:
   a. Trim about 120+ bytes of existing Tier 0 text (for example, shorten the long "Supported and
      reference locales" or "Country language assignment" rows in `decisions.md`, or tighten prose
      in `ai/AGENTS.md`), then run `pnpm ai:check --fix` and commit it on this branch.
   b. Do the same trim in a separate small change on `develop` first, then rebase.
   c. Push with the overrun and accept that Codex truncates the tail of `AGENTS.md`. Not
      recommended: the Tier 0 rules index is at the end.
2. **Unverified Admin HTTP test.** "returns the size and unit refusal reasons of a partial
   submission" and the fake-vendor additions in `bc-integration.spec.ts` cannot run locally (401 on
   admin auth, also at `develop`). Options:
   a. Push as is and record it as unverified in the PR.
   b. Fix the local admin-auth setup first (separate issue) and rerun.
   Separately: should the `verification.md` baseline be updated to say that admin-auth HTTP specs
   fail locally (separate change)?
3. **`itemVariantId` write behaviour (decision 3, already accepted).** It is proven only by the
   after-deploy check below. Confirm that a TestDK order may be created for it after deploy.

**Answers (Klaus Petersen, 2026-10-23, relayed by the main session):**

1. Option (a): trim Tier 0 text on this branch so `pnpm ai:check` passes, without dropping any rule
   (tighten wording only) and keeping the new `decisions.md` row.
2. Option (a): the Admin HTTP test is accepted as unverified and the PR description says so plainly.
   The broken local admin login (401 in 7 HTTP suites, also on develop `eea3a01`) is registered as its
   own bug by the main session. The `ai/architecture/verification.md` baseline is updated on this
   branch to record the wider 401 failures factually (suites, measured on develop `eea3a01`, date).
3. Klaus runs the after-deploy TestDK order himself; it stays under "Verify after deploy".

## Verify after deploy

- Task 03, "Submission uses the rule and sends the size": submit an order with line barcode
  `5712094132141` through `POST /orderapi/orders` into BC TestDK; the BC sales order line
  (`salesOrderLines?$expand=itemVariant`) shows item `HEND-L-MIDNBLUE` and `itemVariant.code = L`; the
  Medusa order's `metadata.business_central_integration.bc_lines` has `ean_no = 5712094132141`.
- Tasks 01, 02 and 04 have no "Verify after deploy" line. Task 04's documentation notes that live
  behaviour against BC (a real size barcode resolving to its size, the request budget under
  throttling) is verified only after deploy, by the task 03 check above.
