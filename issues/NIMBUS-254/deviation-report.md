# Deviation report: Sync a company from Business Central now, from the Admin company page

> Record of NIMBUS-254, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Branch `feature/NIMBUS-254`, merge-base `374c670`, commits 8286447 (NIMBUS-258, task 01), ec89c92
(NIMBUS-259, task 02), e65ed1c (NIMBUS-260, task 03), 9e764aa (consolidation). Reviewed 2026-10-26.

## Deviations from scope and plan

- Task 01: `SyncCompanyFromBusinessCentralInput` is now an alias of the step's
  `PrepareCompanyBcSyncInput` union, and the workflow passes its input to the step whole. The seam
  contract is unchanged. Acceptable.
- Task 01: the old `as { id?; business_central_customer_number? }` cast on the customer path was
  replaced by a typed `toCompanyBcKey` helper that both paths share. This removes a cast.
  Acceptable.
- Task 01: extra assertions were added: the company is unchanged on BC errors, and `getCustomer` is
  called with the company's own BC number. Acceptable.
- Task 02: the workflow's result `transform` now declares `SyncCompanyFromBusinessCentralResult` as
  its return type. Without it, `status` widened to `string` and the typed route response did not
  compile. This is a type annotation only, with no behaviour change. Acceptable.
- Task 02: test companies are created through the company service with no employees, so the cases
  exercise the company-id path. Acceptable.
- Task 02, **open (blocking for `pnpm ai:check`)**: the new `decisions.md` row pushes the generated
  root `AGENTS.md` to 32930 bytes, 162 over `limits.agents_md_bytes` (32768, `ai/harness.json`).
  See open question 1.
- Task 03: `ActionMenu` now ignores a click on a disabled `onClick` action, because Radix calls
  `onClick` on disabled items. The task says "no existing action sets `disabled`", but that is
  wrong; see finding 2. The change is still acceptable.
- Task 03: the tooltip wrapper brings its own `TooltipProvider`. Acceptable.
- Task 03: the hook spreads caller options first and chains `onSettled`, so a caller cannot drop
  the invalidation. Acceptable.
- Task 03: the `skipped` toast names only "BC has no customer for this number". The no-number case
  cannot be reached from the UI because the action is disabled. Acceptable, and within R3/R4.
- All tasks: contract and integration cases are written but were not run (plan section 2). See
  Tests.

No hand-written migration, no new module and no data-model change.

## Consolidation changes

1. In `prepare-company-bc-sync.ts`, the step input union now forbids the other variant's keys
   (`companyId?: never` on the customer variant; `customerId?: never; expectedCompanyId?: never` on
   the company variant). It now branches on `input.companyId !== undefined` instead of
   `"companyId" in input`. So `{ customerId, companyId }` no longer type-checks and cannot skip the
   NIMBUS-161 guard. Valid inputs are unchanged.
2. In `company-actions-menu.tsx`, the `SYNC_OUTCOME_TOASTS` const moved below all imports.

No duplicates or dead code were found.

## Findings

Plan tables, checked against the code:

- Data model: the sync writes only the 12 BC-managed fields plus `business_central_synced_at`,
  through one `ModuleUpdateCompany` literal
  (`apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`:145-162). The sync never
  writes the BC number or the Medusa-only fields. `adminCompanyFields` adds
  `business_central_synced_at` (`api/admin/companies/query-config.ts`:19). Holds.
- State table: unknown id throws `NOT_FOUND` before any BC call (step :79-84). No BC number gives
  `skipped` with no BC call (:115). BC `null` gives `skipped` (:138). A `MedusaError` gives
  `failed` and logs the company id only (:127-135). Any other error propagates. A body field gives
  400 through the strict `z.object({}).strict()` (`validators.ts`:61, `middlewares.ts`:68-72). The
  store triggers still pass `{ customerId, expectedCompanyId }` (`api/store/companies/[id]/route.ts`:56,
  `api/store/customers/me/company/sync-business-central/route.ts`:16), and the guard is intact.
  Holds.
- Security matrix: Admin auth is Medusa's default for `/admin`. Writes go only to the target
  company, because the path id and the company's own BC number are used and the body is
  empty-strict. Medusa-only fields are covered by the single mapping. Logs carry the company id
  only. Every negative test the matrix names exists (see Tests). Holds.
- Layers and boundaries: the route body (`api/admin/companies/[id]/sync-business-central/route.ts`)
  is 22 lines with no `if` and no service import (`limit-route-body`, `bound-route-no-service`).
  The Admin UI calls the backend only through `admin/lib/client.ts`. No `as unknown as`, no `any`,
  and no plan ids in comments (the validator comment cites NIMBUS-254, which is allowed). Holds.
- Business-rule registry: one new row, "BC company sync", owned by the prepare step. There is no
  second mapping. Holds, apart from the size limit (open question 1).
- Framework assumption, middleware matching: the new POST matcher sits beside the existing
  `POST /admin/companies` and `POST /admin/companies/:id` body validators. The existing
  `POST /admin/companies/:id/employees` route uses the same layering, so the matchers do not bleed
  into sub-paths. Not re-verified from dist; the contract case "updated with `{}`" proves it once it
  runs.

Design findings, for the human:

1. Low. `apps/backend/src/admin/routes/companies/[companyId]/page.tsx`:139-142: the page reads
   `business_central_synced_at` as an ISO string, while the shared `QueryCompany` declares `Date`.
   The plan accepted this as a known gap (plan section 8), and it is commented. It needs follow-up
   if more consumers read the field.
2. Low. `apps/backend/src/admin/components/common/action-menu.tsx`:84-89: ignoring clicks on
   disabled actions also changes an existing consumer. The quote manage-item "Remove" action
   (`admin/routes/quotes/components/quote-manage/manage-item.tsx`:252-257) is disabled when the
   line is fully fulfilled. Before this branch, Radix still called `onRemove` on a programmatic or
   synthetic click; now it does not. This is the intended direction, since a disabled action must
   not fire, and a real pointer was already blocked by CSS. So no user-visible regression is
   expected, but task 03's statement "no existing action sets `disabled`" is inaccurate.
3. Info. There is no route-level contract case for "unexpected error gives 5xx". The workflow-level
   case ("rejects on an unexpected Business Central error", `company-sync.spec.ts`) covers the
   propagation, and the plan's test intent did not ask for one.
4. Info (plan section 10, existing): a secret Admin API key, such as the Logic App's order API key,
   can call this route like any other `/admin` route. Nothing new.

Mechanical wiring: no issues. The new types are exported through `src/types/index.ts` →
`company/index.ts` → `http.ts` and imported where used. There are no dead exports
(`AdminSyncCompanyBusinessCentralType`, `AdminSyncCompanyBusinessCentralResponse`,
`useSyncCompanyFromBusinessCentral` and `PrepareCompanyBcSyncInput` all have importers), no
duplicate routes and no cross-app change; the storefront still calls only the unchanged store
route. The "Also update" search for the banner wording, `sync-business-central` and
`business_central_synced_at` found no stale test, `docs/` section or `ai/` file; there is no
`docs/architecture/` company sync section. Whole-branch checks: no new module and no new
company-scoped store route. `react/jsx-no-literals` applies to the storefront and is not touched;
there is no env or secret change.

`git status`: only `apps/backend/medusa-config.ts` is modified, uncommitted and not part of this
branch. See open question 2.

## Tests

Security-path coverage:
- Admin only: `security-boundaries.spec.ts` "denies %s credentials on the Admin company Business
  Central sync". With no auth or a customer token it expects 401, no `getCustomer` call and the
  company unchanged.
- Target company only: `companies.spec.ts` "updates the company from Business Central and leaves
  other companies alone" (the second company and its synced-at are unchanged), and "returns 404
  without a Business Central call for an unknown company".
- No client values: `companies.spec.ts` "refuses a body of %j and leaves the company unchanged", for
  `name` and `business_central_customer_number`.
- Medusa-only fields: the `updated` case asserts `order_api_enabled`, `logo_url`,
  `spending_limit_reset_frequency` and the BC number are unchanged. The company-path cases in
  `company-sync.spec.ts` assert the same.
- Store triggers and the NIMBUS-161 guard: the existing `company-sync.spec.ts` cases are unchanged.

Run status:
- Ran locally: `test:unit` (83 suites, 1114 tests) and `test:admin` (11 suites, 79 tests) pass. This
  includes `company-bc-sync.test.tsx` (8 tests) and `bc-managed-fields.unit.spec.ts`. Lint has 0
  errors. Typecheck has 22 errors, equal to the baseline. The build passes.
- **Code complete, unverified because the BC test environment and `.env` are missing locally**:
  every new or touched case in `customers/company-sync.spec.ts`, `companies/companies.spec.ts` and
  `security/security-boundaries.spec.ts`. `test:integration:http` aborts in Jest globalSetup
  (`BUSINESS_CENTRAL_DISCOVERY_URL is missing`). NIMBUS-236 (401 on login) would also affect
  `companies.spec.ts` and `security-boundaries.spec.ts`. This is the plan section 2 rule; the
  after-deploy checks below are the proof.

Volume: about 686 test lines against 294 source lines added (about 2.3). Mock hygiene is sound:
`restoreAllMocks` in the before/after hooks, `mockRestore` in `finally`, and DB reset per test in
the integration runner. Tests are not duplicated. The company-path cases appear at the workflow
level (`company-sync.spec.ts`) and the HTTP level (`companies.spec.ts`), but they assert different
contracts (workflow result and rejection type vs HTTP status, body schema and read shape), so the
overlap is deliberate.

## Open questions

1. **`pnpm ai:check` fails on the AGENTS.md size limit.** The new Tier 0 row puts the generated
   root `AGENTS.md` at 32930 bytes, 162 over `limits.agents_md_bytes` (32768, `ai/harness.json`).
   HEAD had 19 bytes of headroom, so any Tier 0 growth fails. Options:
   (a) raise the limit in `ai/harness.json`, after checking whether Codex really truncates at
   32 KiB, since that is why the limit exists;
   (b) trim existing Tier 0 text (e.g. shorten other `decisions.md` rows or `verification.md`
   prose) by at least 162 bytes, preferably more for headroom;
   (c) drop or shorten the new row. The row is the scope's "one rule" requirement, so this is not
   recommended.
   The branch should not be pushed with `ai:check` red.
2. **Uncommitted `apps/backend/medusa-config.ts`.** It re-adds the `notification-local` provider
   that develop commit 0e0231c removed. It is not part of this branch and must not be committed.
   Options: discard it locally, or keep it as a private dev tweak (e.g. stash it). Your call.
3. **Integration verification.** Do you accept "code complete, unverified" for the contract and
   integration cases (plan section 2), with proof after deploy? Or can you supply an
   `apps/backend/.env` with local Postgres and the BC test discovery URL, so the three specs run
   before push? Even then, NIMBUS-236 limits what `companies.spec.ts` and
   `security-boundaries.spec.ts` can show.

### Answers (Klaus Petersen, 2026-10-26, relayed by the main session)

1. Option (a): raise `limits.agents_md_bytes` in `ai/harness.json` with sensible headroom, but
   only after checking whether Codex really truncates at 32 KiB; if it does, stop and report
   instead of raising.
   **Result (task-dispatcher, 2026-10-26): it does, so the limit was not raised.** OpenAI's Codex
   AGENTS.md guide (https://learn.chatgpt.com/docs/agent-configuration/agents-md.md, redirected from
   developers.openai.com/codex/guides/agents-md) says Codex "stops adding files once the combined
   size reaches the limit defined by `project_doc_max_bytes` (32 KiB by default)" and "The larger
   byte limit allows more combined guidance before truncation". The documented way to raise it is
   `project_doc_max_bytes` in the user's `~/.codex/config.toml`; the page does not mention the
   project `.codex/config.toml`, and this repo's `.codex/config.toml` does not set it. So every
   Codex user would read a truncated `AGENTS.md` (the last 162+ bytes, the end of Tier 0) unless
   each raises it locally.
   **Corrected answer (Klaus Petersen, 2026-10-26): option (b).** Do not raise the limit. Trim at
   least 162 bytes, plus headroom, of Tier 0 text in `ai/architecture/*.md` or `ai/AGENTS.md` by
   tightening wording, without losing any rule, rule ID or meaning; keep the new `decisions.md` row
   intact; `pnpm ai:check` must pass. Done by fix brief `fix-ai-check-budget.md`.
2. Commit the uncommitted `apps/backend/medusa-config.ts` change on this branch as its own commit,
   restoring the local notification provider removed in 0e0231c.
3. Accepted: the integration and contract cases are "code complete, unverified", proven after
   deploy.
4. Jira: the main session moves NIMBUS-254 to Internal review; the dispatcher does not transition
   it.

## Verify after deploy

- 01, BC company sync starts from a company id as well as a customer: "see task 02."
- 02, Admin sync route and last-synced time in the Admin company read:
  "`company.business_central_synced_at` for one company with a BC customer number (pick it in
  Admin) changes from its prior value to the time of the Admin sync. On a company without a BC
  number the action is disabled."
- 03, Admin action, outcome toasts, last-synced row and banner text: "on the Admin page of one
  company with a BC customer number, the \"Last synced from Business Central\" row shows the time
  of a sync run there. Check the storefront company card after about 120 s."
