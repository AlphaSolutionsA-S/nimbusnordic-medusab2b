# AGENTS.md

The shared AI base for this repository lives in [`ai/`](./ai/AGENTS.md); see
[ai/CONTRIBUTING.md](./ai/CONTRIBUTING.md) to extend it. Because not every tool follows links, the
blocks below are copied from `ai/AGENTS.md`, `ai/instructions/` and `ai/architecture/`. Edit them
there and run `pnpm ai:check --fix`.

<!-- context:begin (generated from ai/AGENTS.md by ai:check --fix; do not edit) -->

## Project context

Nimbus Nordic's B2B customer portal: a Medusa backend (companies, spending limits, approvals,
quotes, Business Central sync, an order API, DB-backed UI translations), a Next.js storefront and a
Payload CMS. pnpm 9.15 workspace (`apps/*`), Turborepo, Node 22+.

| App | Path | Stack |
|-----|------|-------|
| Backend + Admin (`@b2b-starter/backend`) | `apps/backend` | Medusa 2.21.0, TypeScript (only `strictNullChecks`), PostgreSQL |
| Storefront (`@b2b-starter/storefront`) | `apps/storefront` | Next.js 15.5, React 19, Medusa JS SDK, next-intl 4, TypeScript strict |
| CMS (`@dtc/cms`) | `apps/cms` | Payload 3.90 on Next.js 16, own PostgreSQL |

Integrations: Business Central, an Azure Logic App calling `/orderapi/orders`, Stripe and PayPal.
Hosting: Medusa Cloud (backend, storefront); Azure App Service (CMS).

### Commands

Run from the repo root, one command at a time. `<path>` is a test file path or pattern.

`<f>` is `pnpm --filter <package>` with the package from the table above.

| App | Scoped tests | Full tests | Lint | Typecheck / build |
|-----|--------------|------------|------|-------------------|
| Backend | `<f> test:unit -- <path>`; admin: `<f> test:admin -- <path>` | `pnpm test:unit`, `pnpm test:integration:modules`, `pnpm test:integration:http` (local Postgres), `<f> test:admin` | `<f> lint` | `<f> exec tsc --noEmit`; `<f> build` |
| Storefront | `<f> test -- <path>` | `<f> test`; visual: `<f> test:visual` | `<f> lint` | `<f> exec tsc --noEmit`; `<f> build` |
| CMS | `<f> test -- <path>` | `<f> test` | `<f> lint` | `<f> exec tsc --noEmit`; `<f> build` |

Root `pnpm test` skips the backend (no `test` script). Typecheck and some tests fail today
(baseline: `ai/architecture/verification.md`). Dev servers: `<f> dev` (the root `backend:dev` and
`storefront:dev` scripts filter package names that don't exist).

Architecture check: none (no boundary lint yet; `medusa lint` covers Medusa's own rules).

### Tools and vendor documentation

- `atlassian` MCP: Jira. `medusa` MCP: Medusa docs and API signatures (token in the
  `MEDUSA_MCP_TOKEN` user environment variable, never in a file). `mcloud` CLI: Medusa Cloud.

Skills hold this repo's patterns; check a signature a skill shows against the vendor documentation
server before relying on it.

Read and search with the file-read and search tools (Read, Grep and Glob in Claude Code), not
`grep`, `cat`, `head` or `sed` in the shell: they behave the same in every shell and are much faster
(a measured shell search took about 5 s against 0.2 s for the tool). The shell may be Bash or
PowerShell; PowerShell has no `grep`, `head`, `tail` or `wc`, and Windows PowerShell 5.1 has no `&&`,
so run commands from the repo root in the form the Commands table (or a manifest) gives, not by
chaining `cd` with `&&`. Write files with the file-write tool, not shell heredocs, which mangle
backslashes on Windows. Each agent's own constraints say what else it may use the shell for.

### Starting work

Start every piece of work with the `triage` agent: "let's start working on <key>" for an existing issue,
or paste the request (an email, a message, a screenshot) for a new one. Triage registers new work and
routes it: `quick-fix` for a bug or a small change, the full pipeline (`scoper` → `implementation-planner`
→ `task-dispatcher`) for epics and larger stories, `analyse` when the request is too unclear to route.

Choosing a flow (triage proposes, the first flow step confirms; `quick-fix` escalates up, `scoper` hands down):

| Full pipeline when the work involves any of | Otherwise `quick-fix` |
|---|---|
| a data-model change or migration | a bug with a concrete symptom, or a small change with clear rules |
| auth, personal data, payment or other regulated data | in one app |
| a contract between apps or with a vendor | no contract change |
| a business rule nobody has stated, or a decision only the business can make | rules already clear |
| more than about three tasks' worth of work, or several apps | about three tasks' worth or less |

Always the full pipeline here: Business Central sync, the order API (`/orderapi`), company
authorization, spending limits and approvals, and checkout payments.

A simple fix (for the start-simple-fixes setting): one app, a handful of files, no new dependency,
cause certain, no full-pipeline signal.

Quick-fix confirmation: always

### Pipeline runs

During a pipeline or quick-fix run, agents act without asking. What needs a human goes into the
task's `## Deviations`, a review finding, or the deviation report's open questions (in quick-fix: its
report). Nothing is pushed without the human's go-ahead. An agent that invokes subagents runs each in
the foreground and waits for its result; a dispatcher that backgrounded one once handed back early
with tasks half-run.

### Results

A result is a value read from the real system after the change ran; tests prove logic, not delivery.
Report what tests verified and what is not yet verified after deploy separately.

### Tracker

Work items live in Jira (NIMBUS), the source of truth for what is agreed and how it changed. The
`tracker-workflow` skill holds the procedure (issue hygiene, commit references, closing comments, the
pipeline change history) and `jira-workflow-dev` says how each step is done in Jira (NIMBUS). Its
`ai/skills/jira-workflow-dev/project.md` holds this project's Jira rules (component
`Customer Portal` on every issue and search); read it with the skill. Integration branch: `develop`;
work branches `feature/NIMBUS-<number>`.

### Case folders

Each tracked piece of work has one folder, `issues/<key>/`, named with the tracker key as the tracker
shows it (`NIMBUS-150`); work with no tracker issue yet uses a short kebab-case slug, renamed to the key
once the issue exists. One folder per case, committed with the work:

| File | Written by | Kept |
|---|---|---|
| `feature.md` or `bug.md` | `feature-requests` / `bug-reporting` when the work is registered | yes |
| `scope.md` | `scoper` | yes |
| `plan.md` | `implementation-planner` | yes |
| `deviation-report.md` | `integration-reviewer`, with the human's answers | yes |
| `change-report.md` | `quick-fix`, after the fix: what changed, in the plan's format | yes |
| `analysis.md` | `quick-fix` in bug mode (reproduction, root cause), or anyone investigating | yes |
| `PROGRESS.md` | every agent or skill that finishes a workflow stage (below) | yes |
| `notes.md`, `samples/`, `logs/`, `mockups/` | anyone, as needed | yes |
| `manifest.md`, task files `NN-<slug>.md`, fix briefs, `branch-notes.md` | the pipeline, while it runs | no: `cleanup` deletes them |
| `task.md` | `quick-fix`: its short plan and task file | no: the change report replaces it |

`PROGRESS.md` (project rule): check it before acting when it exists and treat its latest entry as the
current workflow state and handover target. Before finishing a workflow stage, append a dated entry
with the outcome, the next owner and any handover prompt; create the file when your workflow first
records a handover; never replace earlier entries.

Case folders up to NIMBUS-176 use v1 upper-case names (`SCOPE.md`, `PLAN.md`); they stay as they are.

The folder follows the unit of work that goes through a flow, not the tracker hierarchy: an epic run
through the pipeline as one scope has one folder (its plan tasks become tracker sub-tasks with no
folders of their own); stories of an epic run separately each get their own. A quick-fix case holds
its intake file, `analysis.md` (bugs) and `change-report.md`.

Once the work ships, a case folder is a frozen record: read it for why something was built as it was,
never update it in later work, and never treat it as current behaviour. New work on the same area gets
its own case. The code and `docs/architecture/` describe the system as it is; read the architecture
doc for the area you change. What must stay current belongs in `docs/architecture/`, the tracker,
commit messages or the PR description, never in a case folder or a code comment.

### Shared skill catalog

Skills here can come from, and go back to, the Alpha Solutions catalog (`harness_repo` in
`ai/harness.json`, private). Before writing a new skill, and when `harness_released` is more than a
month old, suggest checking the catalog first; after creating a skill or making a larger change to
one, ask whether to contribute it. Both procedures are in `ai/CONTRIBUTING.md`.

### Code comments

Comment only the why: invariants, vendor quirks, deviations from the obvious implementation. Never
cite task, test-case or scope ids from pipeline plans (task numbers are reused every epic); cite
the issue key or a `docs/architecture/` section. Back any security claim made in a comment with a
test.

### Do not read

- `README.md` (root): upstream starter boilerplate with wrong versions; use this file instead.
- `docs/security-review-handover.md`: source-solution findings, context only; status is in
  `docs/security-remediation.md`.
- `apps/storefront/messages/*.json` as runtime UI text (import material only).

Known gaps (no skill yet): Payload CMS, Business Central API, Stripe and PayPal clients.

## Skills

Load the matching skill before planning or implementing in its domain. Layer skills hold the Tier 0
rules for one layer; load the technology skill alongside for API detail. Where a skill folder has a
`project.md`, read it too; it wins where the two differ.

| Skill | When to use |
|-------|-------------|
| `tracker-workflow` | Any tracker step; pipeline change history |
| `jira-workflow-dev` | How tracker steps are done in Jira (NIMBUS) |
| `commit-messages` | Committing |
| `bug-reporting` | Registering a bug |
| `feature-requests` | Registering a feature request |
| `secure-coding-owasp` | Any code change or review |
| `memory-discipline` | Before writing agent memory |
| `design-interview` | Interviewing about a plan or design |
| `code-review` | Reviewing a PR or diff outside the pipeline |
| `medusa-backend` | Any backend work in `apps/backend` |
| `medusa-module-and-data` | Models, services, links, migrations (L0–L1) |
| `medusa-infra-adapter` | Vendor API clients, e.g. Business Central (L2) |
| `medusa-workflow-and-steps` | Workflows, steps, hooks, rule helpers (L3–L5) |
| `medusa-api-route` | API routes (L6) |
| `medusa-triggers` | Subscribers and jobs (L7) |
| `medusa-admin` | Admin UI |
| `medusa-cloud` | `mcloud` and Medusa Cloud deployments |
| `medusa-storefront` | Storefront code calling the backend |
| `nextjs-data-layer` | Storefront data fetching and actions (S0–S2) |
| `storefront-best-practices` | Storefront UI/UX, cart, checkout, SEO |

## Instructions

Path-scoped conventions, applied automatically in each tool when working in the matching files.

| Instruction | Applies to |
|-------------|------------|
| `agent-discipline` | everything |
| `commit-messages` | everything |
| `typescript-style` | `**/*.{ts,tsx,mts,cts}` |
| `medusa-backend` | `apps/backend/**` |

<!-- context:end -->

<!-- always:begin (generated from ai/instructions by ai:check --fix; do not edit) -->


## Agent Discipline

### Surgical changes

- Touch only what the task needs; every changed line traces to the user's request or the task. Don't "improve" adjacent code, comments or formatting, or refactor what isn't broken.
- Match existing style and the project's conventions, even if you would do it differently.
- Don't add docstrings, comments or type annotations to, or reformat, code you did not change.
- Remove imports, variables and functions that your changes made unused. Pre-existing dead code or unrelated issues: mention them, don't fix them, unless asked.

### Simplicity first

- Write the minimum code that solves the problem: no features beyond the ask, no abstractions for single-use code, no unrequested flexibility or configurability.
- No error handling for scenarios that cannot happen; validate only at system boundaries.
- If you wrote 200 lines and it could be 50, rewrite it.

### Think before coding

- State assumptions. If uncertain, ask; if there are several interpretations, present them rather than pick silently; if a simpler approach exists, say so. During a pipeline or quick-fix run, take the reading that fits the task and plan instead, and record it as "Pipeline runs" in `ai/AGENTS.md` says.

### Reporting results

- Report results per "Results" in `ai/AGENTS.md`. The `prove-it-works` skill, where installed, holds the rest: naming the artifact before coding, the evidence tiers and the minimum tier per change type, the forbidden claims, "code complete, unverified because X", and the after-deploy check.


## Commit Message Rules

Every commit message follows the Nimbus Nordic convention: `NIMBUS-<number>: <concise description>`.

The rules (subject length, mood, confirming the key, the pipeline's key, staging) live in the [`commit-messages` skill](ai/skills/commit-messages/SKILL.md); load it before committing.

<!-- always:end -->

<!-- tier0:begin (generated from ai/architecture by ai:check --fix; do not edit) -->

## Layers (`ai/architecture/layers.md`)

Every file belongs to one layer and calls only what its row allows (checked in `boundaries.md`).
Paths are relative to `apps/backend/src/`, `apps/storefront/src/` and `apps/cms/src/`.

### Backend

| # | Layer | Location | Owns | May call | Must never |
|---|---|---|---|---|---|
| L0 | Data model | `modules/<m>/models/*.ts` | its tables (`data-ownership.md`) | — | be imported outside its module |
| L1 | Module service | `modules/<m>/service.ts` | CRUD + invariants on its own tables | its own L0, its module's L2 client | resolve another module, do HTTP itself or while holding a transaction, know a workflow exists |
| L2 | Infra adapter | `modules/business-central/service.ts` (Business Central HTTP client, no tables); notification provider `notification-local` (`medusa-config.ts`) | exactly one external system | that vendor's HTTP API | hold a domain rule |
| L3 | Step | `workflows/<domain>/steps/*.ts` | one compensatable unit | L1, L2, L5, Query | orchestrate other steps |
| L4 | Workflow | `workflows/<domain>/workflows/*.ts`; core-flow hooks in `workflows/hooks/*.ts` | logic spanning more than one module; compensation | L3, L5 inside `transform()`, other workflows via `runAsStep` | `await`, branch outside `when()`, `new Date()` |
| L5 | Decision fn | `workflows/<domain>/utils/*.ts`, `utils/*.ts` (pure parts) | one pure business rule | nothing | any I/O |
| L6 | API route | `api/{store,admin,orderapi,internal}/**/route.ts`, `api/**/middlewares.ts`, `api/middlewares/*.ts` | validate → run L4 or Query → shape the response | L4, Query, event bus | branch on a business condition; mutate via L1 |
| L7 | Trigger | `subscribers/*.ts`; `jobs/` (none yet) | call one workflow | L4 | hold logic |

Only the pure functions in `utils/` are L5. Admin UI (`admin/**`) calls the backend only over HTTP
through `admin/lib/client.ts`.

Limits: an L6 route body is at most 40 lines, with no `if` on a domain value
(`limit-route-body`); no L1 method touches more than one module's data (`limit-service-one-module`).

L5 exists to name a business rule, never as a mocking seam: two steps that do the same thing share
the step, not a helper with injected dependencies.

### Storefront (Next.js App Router, Medusa JS SDK)

| # | Layer | Location | Must never |
|---|---|---|---|
| S0 | Transport client | `lib/config.ts` (the single `sdk`); `middleware.ts` uses raw `fetch` because the Edge runtime cannot load the SDK | map, validate, decide |
| S1 | Mapper | `lib/util/*.ts` (pure helpers; no dedicated mapper files yet, UNVERIFIED as a layer) | fetch |
| S2 | Data fn / action | `lib/data/*.ts`: `"use server"` actions; `cms.ts` and `ui-translations.ts` are `server-only` loaders | hold a domain rule |
| S3 | Route / server component | `app/[countryCode]/**`, `app/api/**`, `i18n/request.ts` | fetch vendor APIs directly |
| S4 | Feature component | `modules/<feature>/{components,templates}/**` | fetch, or import `lib/` beyond S1 helpers and S2 actions |

### CMS (Payload, `apps/cms`)

`collections/*.ts` and `blocks/*.ts` define the schema, registered in `payload.config.ts`; migrations
in `migrations/`. The storefront reads the CMS only through `lib/data/cms.ts`.

Not retrofitted: each layer skill's `project.md` lists the legacy files that break these rows
("Do not copy"); new code never copies them.

## Boundaries (`ai/architecture/boundaries.md`)

The import edges of `layers.md` as rules. `B` = `apps/backend/src`, `S` = `apps/storefront/src`,
`<m>` is one module, `<other>` any other. Tests (`**/__tests__/**`, `*.spec.ts`, `*.test.ts`) are
exempt. "Value import" excludes `import type`. Existing violations get a baseline, not a retrofit.

No import-boundary lint runs yet: every row is enforced by review. `@medusajs/eslint-plugin`
(`medusa lint`) adds `link-no-cross-module-relationship` (error) and
`no-service-mutations-in-api-route` (warning), which back `bound-module-isolation` and
`bound-route-no-service`.

| ID | From | To | Verdict |
|---|---|---|---|
| `bound-model-private` | `B/**` outside `B/modules/<m>/**` | `B/modules/<m>/models/**` | forbidden |
| `bound-module-isolation` | `B/modules/<m>/**` | `B/modules/<other>/**` | forbidden |
| `bound-module-no-upward` | `B/modules/**` | `B/{workflows,api,subscribers,jobs,links}/**` | forbidden |
| `bound-links-index-only` | `B/links/**` | `B/modules/*/index.ts`, `@medusajs/medusa/*` | only these allowed |
| `bound-workflow-no-upward` | `B/workflows/**` | `B/{api,subscribers,jobs}/**` | forbidden |
| `bound-helper-pure` | `B/workflows/<domain>/utils/**` | `B/modules/*/service.ts`, `B/**/steps/**`, `@medusajs/framework/workflows-sdk` (all value) | forbidden |
| `bound-route-no-service` | `B/api/**` | `B/modules/*/service.ts` (value) | forbidden |
| `bound-api-private` | `B/**` outside `B/api/**` | `B/api/**` | forbidden |
| `bound-trigger-thin` | `B/{subscribers,jobs}/**` | `B/modules/*/service.ts` (value), `B/**/steps/**` | forbidden |
| `bound-app-isolation` | any app (`apps/backend`, `apps/storefront`, `apps/cms`) | another app's source | forbidden |
| `bound-sf-transport-private` | `S/**` outside `S/lib/config.ts`, `S/lib/data/**`, `S/middleware.ts` | `@medusajs/js-sdk`, `S/lib/config.ts` | forbidden |
| `bound-sf-server-only` | `S/lib/data/cms.ts`, `S/lib/data/ui-translations.ts` | `server-only` | required |

Baseline: `bound-route-no-service` in `B/api/store/bc-orders/[id]/returns/route.ts`,
`B/api/store/ui-translations/[locale]/route.ts` and `B/api/admin/ui-translations/*`;
`bound-sf-transport-private` in `S/app/[countryCode]/(main)/products/[handle]/page.tsx`.

### Locks

No Redis is configured, so locks are in memory and don't hold across instances (unverified for
production, `docs/security-remediation.md`).

- `lock-single-run`: a lock that keeps a sync or batch to one run at a time is acquired in the L7
  trigger that starts the workflow: try once, skip if held, release in `finally`.
- `lock-critical-section`: a lock around changing specific data (an order, a cart, a shared
  configuration) is acquired by a workflow step whose compensation releases it and released by a
  later step; a step that acquires and releases in its own body uses try/finally.
  `acquireLockStep` skips itself under `runAsStep` unless `executeOnSubWorkflow: true`.
- `lock-ttl`: every lock sets a TTL (`expire`/`ttl`) longer than the worst-case run, and an
  `ownerId` wherever a release could free another run's lock; without one the in-memory provider
  never expires the lock.
- `NO_LOCKING_IN_ROUTES`: no `.acquire()` in `B/api/**`.

## Medusa boundary (`ai/architecture/medusa-boundary.md`)

Where our code meets Medusa (2.21.0, every `@medusajs/*` package in `apps/backend`) and vendor
packages. Code examples and detail: the `medusa-backend` skill (`reference/medusa-boundary.md`,
`reference/querying-data.md`).

### Verify, don't assume

- A framework or vendor behaviour a design relies on is verified before use, from installed source
  or the `medusa` MCP (otherwise the Medusa documentation). Record the primitive, the evidence and
  the behaviours checked (repeated invocation, invalid or missing input, concurrent races). An
  unverified claim is marked UNVERIFIED in the plan and blocks dispatch.
- Security-relevant vendor claims (signatures, lock ownership, replay, token checks) are verified
  from dist code or a runnable probe, never type-doc or README prose.
- `query.graph` selection is string-based and weakly typed, so a wrong path fails silently. Verify a
  result shape once against real data and mock only the shape you verified.
- Installed source: `apps/backend` uses `node-linker=hoisted` (`apps/backend/.npmrc`), so read
  `apps/backend/node_modules/@medusajs/<pkg>/dist/...`; if a package is missing there, grep the
  store `node_modules/.pnpm/@medusajs+<pkg>@*/node_modules/@medusajs/<pkg>`. A no-match grep is
  evidence only once it has provably searched a real path.

### OOTB first

Use Medusa's workflow or step before writing your own; core workflows emit the events that raw
service calls skip. Add no pre-check, dedup, retry or compensation around an OOTB primitive unless
verified evidence shows it lacks that guarantee. Extend core flows through the hooks in
`apps/backend/src/workflows/hooks/`, not by copying the flow.

### Reading core data

- `data-schema-vs-model`: presence in the generated types does not mean `query.graph()` resolves a
  field; where the value is computed does (module service: yes; core-flows workflow: never, e.g.
  `order.payment_status`; wrong path: silent `undefined`, e.g. `items.detail.quantity` on an order).
- `data-core-read-workflows`: a substantive read of a core entity goes through its core read
  workflow (`getOrderDetailWorkflow`, `getOrdersListWorkflow`); `query.graph()` stays right for our
  own models and narrow existence or scope checks, each commented as a deliberate exemption.
- `data-no-core-internals`: call the workflow, not the core internal it wraps.

### Types

- Never `as unknown as` (`NO_UNKNOWN_CAST`). If an escape is unavoidable, there is exactly one, in a
  named helper, with a comment stating the verified runtime shape.
- A declared type matches the runtime value: `model.dateTime()` is a `Date`.
- `apps/backend/tsconfig.json` sets only `strictNullChecks` (not `strict`): implicit `any` compiles,
  so `type-no-any` is a review rule here.

### Module-service constraints

- `data-service-async`: every public module-service method is `async` or returns a Promise.
- `data-service-transaction`: a custom method that touches the database is a public
  `@InjectManager()` method calling a protected `name_` method with `@InjectTransactionManager()`,
  both taking a last optional `@MedusaContext() sharedContext?: Context`.

### Workflow failures

A failed workflow rejects with a serialised object, not an `Error`. In a test, assert with
`rejects.toMatchObject({ message })`; when logging, read `.message` defensively.

### Pitfalls

- `fields` expansions deeper than Medusa's relation-depth limit fail at runtime
  (`api/store/quotes/query-config.ts`).

## Data ownership (`ai/architecture/data-ownership.md`)

Every table has one owning module. Core tables belong to their Medusa module. The CMS
(`apps/cms`) has its own Postgres database (`DATABASE_URI`), owned by Payload; no other app touches it.

- Only the owner's L1 service reads or writes its tables; other modules read them through
  `query.graph()` (or `query.index()` to filter by linked-module fields).
- Relationships across modules are module links in `apps/backend/src/links/`, never foreign keys.
- Migrations are generated (`medusa db:generate <module>`, then `medusa db:migrate`; CMS:
  `payload migrate:create`), never hand-written; a hand-written one is a blocking deviation.
- No raw SQL outside the owning module's service, and never against another module's tables.
- Personal data: company and employee contact, address, VAT and credit data (company module, synced
  from Business Central) and Medusa customers. Never log it: errors log the message only
  (`apps/storefront/src/lib/util/customer-error.ts`); page paths stored with missing translation keys
  are sanitized first (`apps/storefront/src/i18n/request.ts`).
- Business Central is the source of truth for the BC-managed company fields
  (`apps/backend/src/admin/routes/companies/bc-managed-fields.ts`); they are synced, not edited.

### Registry (`apps/backend/src/modules`)

| Module (container key) | Tables | Migrations |
|---|---|---|
| `company` | `company`, `employee` | `modules/company/migrations/` |
| `quote` | `quote`, `message` | `modules/quote/migrations/` |
| `approval` | `approval`, `approval_settings`, `approval_status` | `modules/approval/migrations/` |
| `orderIngestion` | `order_external_reference` | `modules/order-ingestion/migrations/` |
| `storefrontTranslation` | `storefront_translation`, `translation_missing_key` | `modules/storefront-translation/migrations/` |
| `businessCentral` | none (HTTP client for Dynamics 365 Business Central) | — |

Legacy exceptions: `medusa-module-and-data` `project.md`.

## Business-rule registry (`ai/architecture/decisions.md`)

Each business rule has one home; consumers render its verdict and never re-derive it. Before adding a
rule, find its row here; a second implementation is a defect. Paths: `B` = `apps/backend/src`,
`S` = `apps/storefront/src`.

| Rule | Owning file | Verdict exposed via | Consumers | Status |
|------|-------------|---------------------|-----------|--------|
| Spending limit (per order only, finding 7) | `B/utils/check-spending-limit.ts` | checkout error (`B/workflows/hooks/validate-cart-completion.ts`) | storefront cart, checkout | duplicate: `S/lib/util/check-spending-limit.ts` |
| Cart approval status | `B/utils/get-cart-approval-status.ts`, `validate-cart-approvals.ts` | cart approvals | storefront cart, checkout, approvals | divergent duplicate: `S/lib/util/get-cart-approval-status.ts` (approved = all vs any) |
| BC-managed company fields are read-only | `B/admin/routes/companies/bc-managed-fields.ts` | admin form; BC sync | storefront company card | ok |
| Free-shipping threshold | `B/api/store/free-shipping/utils.ts` | `/store/free-shipping/prices` | `S/lib/data/fulfillment.ts` | ok |
| Supported and reference (`en`) locales | `B/modules/storefront-translation/service.ts` | `/store/ui-translations/:locale` | `B/admin/lib/translations.ts`, `S/lib/i18n/country-language-map.ts` | duplicate |
| Runtime UI text from the database, not `S/messages/*.json` | `B/modules/storefront-translation` | `/store/ui-translations/:locale` (300 s cache) | `S/lib/data/ui-translations.ts` | ok |

Domain types are duplicated in `B/types/` and `S/types/` (no shared package yet).

## Verification (`ai/architecture/verification.md`)

What a test must prove and at which layer. Commands are in `ai/AGENTS.md` (Commands).

| Layer | Tool and location | Use for |
|---|---|---|
| Unit | Jest: backend `src/**/__tests__/*.unit.spec.ts`, admin `src/admin/**/__tests__/*.test.tsx`, storefront `src/__tests__/**` (mirrors `app/`, `lib/`, `modules/`). Vitest: CMS `src/**/*.test.ts` | pure decision functions on plain data |
| Contract | Jest: `apps/backend/integration-tests/http/<area>/*.spec.ts`, real Postgres | endpoint contracts |
| Integration | Jest: `apps/backend/src/modules/<m>/__tests__/*.spec.ts`; Playwright: `apps/storefront/e2e/visual/` | what a contract test can't see: lock order, partial failure, races |

- Test behaviour: business rules, error and edge handling, security boundaries, mechanisms that fail
  silently (event vs direct call, lock order, diff vs delete-and-recreate). Skip pass-through mapping,
  framework guarantees and trivial rendering.
- Assert at the depth the caller consumes: the type of each field it uses, not that its container
  exists.
- Security work carries negative cases per property (company membership, role, cross-company access;
  `integration-tests/http/security/security-boundaries.spec.ts` is the home for them). Every
  security-critical path is tested somewhere in the branch.
- Where a security property depends on vendor behaviour, at least one test exercises the real
  library, not a stub.
- Never mock framework-resolved services to assert their call order; test the extracted pure decision
  or move the case to integration. Keep dependency resolution and I/O where the framework puts them
  and extract only pure logic, never a `*Logic(input, deps)` mocking seam.
- Never read source files as text in a test; prefer a behaviour assertion, then importing the module
  and asserting on its exports, then a lint rule for absence claims. Reading a fixture is fine.
- Per task: only the tests created or changed, lint and whole-app typecheck (at or below the
  recorded baseline). The full suite, integration tests and build run once, at finalization.
- Test volume is a signal, not a target.
- "Also update" (a task file's or quick-fix `task.md`'s list): every existing test that asserts the
  behaviour being changed, contract and end-to-end spec, `docs/` section, `ai/` file (business-rule
  registry, Tier 0 rows, a skill's `project.md`) and user-facing doc that describes it, or "none
  found". Find them by searching the behaviour's names, routes, fields, messages and rule wording;
  change what a stale test asserts, never delete it to make it pass.

### Baseline (not green today)

Per `docs/security-remediation.md` (2026-09-20; re-measure first): `tsc --noEmit` fails in backend
and storefront (`next build` hides it); quote HTTP specs, one BC module test, 3 storefront and 1 CMS
test fail. No CI runs backend or storefront tests. Backend tests abort unless
`BUSINESS_CENTRAL_DISCOVERY_URL` is an allowed test environment (`integration-tests/global-setup.ts`).

### Whole-branch checks

- New modules are registered in `apps/backend/medusa-config.ts`.
- Company-scoped store routes use `api/middlewares/ensure-role.ts`.
- New UI text is a translation key (`react/jsx-no-literals`).
- Only `NEXT_PUBLIC_*` variables reach client code; other secrets stay server-side.

## Rules (`ai/architecture/rules.md`)

Every rule ID, its severity and what enforces it. Baselines hold only findings that predate a rule;
anything new fails, and a baseline is never regenerated to clear a finding. A violation is a design
error: never suppress it or weaken the rule to pass a task.

| Rule IDs | Severity | Enforced by |
|---|---|---|
| `bound-*` (`boundaries.md`) | high, blocker | review; `medusa lint` for module relationships |
| `lock-*`, `NO_LOCKING_IN_ROUTES` (`boundaries.md`) | high, blocker | review |
| `NO_UNKNOWN_CAST`, `data-schema-vs-model`, `data-core-read-workflows`, `data-no-core-internals`, `data-service-*` (`medusa-boundary.md`) | high | review |
| `limit-route-body`, `limit-service-one-module` (`layers.md`) | medium | review |
| `arch-*`, `data-*`, `type-*`, `file-*`, `logic-*`, `sdk-*` (Medusa skills) | as the skill states | review; `medusa lint` for workflow composition |
| `type-no-any` | high | review; baseline: 16 storefront files, `workflows/order/steps/update-order.ts` |
| `no-plan-id-comments` (comments citing task, test-case or scope ids) | high | review |
| One home per business rule | high | `decisions.md`; review |
| `trust-no-client-company`: never authorize from client `metadata.company_id` | high, blocker | review; baseline: `workflows/hooks/{cart,order}-created.ts` |
| `ui-text-translated`: storefront UI text is a translation key | medium | `react/jsx-no-literals` (warn) |

Open security findings 7 (spending limit per order only), 8 (client company id) and 10 (claims live
preview bypasses login) are tracked in
`docs/security-remediation.md`; work touching carts, checkout or company access reads it first.

<!-- tier0:end -->
