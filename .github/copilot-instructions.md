# Project: Nimbus Nordic

Skill, agent and instruction content lives once in [`ai/`](../ai/); the files under `.github/` are
pointer stubs (see [ai/CONTRIBUTING.md](../ai/CONTRIBUTING.md)). The blocks below are generated from
[ai/AGENTS.md](../ai/AGENTS.md) and `ai/architecture/`; edit those and run `pnpm ai:check --fix`.

<!-- context:begin (generated from ai/AGENTS.md by ai:check --fix; do not edit) -->

## Project context

Nimbus Nordic's B2B customer portal: a Medusa backend (companies, spending limits, approvals,
quotes, Business Central sync, an order API, DB-backed UI translations), a Next.js storefront and a
Payload CMS. pnpm 9.15 workspace (`apps/*`), Turborepo, Node 22+.

|App|Path|Stack|
|---|---|---|
|Backend + Admin (`@b2b-starter/backend`)|`apps/backend`|Medusa 2.21.0, TypeScript (only `strictNullChecks`), PostgreSQL|
|Storefront (`@b2b-starter/storefront`)|`apps/storefront`|Next.js 15.5, React 19, Medusa JS SDK, next-intl 4, TypeScript strict|
|CMS (`@dtc/cms`)|`apps/cms`|Payload 3.90 on Next.js 16, own PostgreSQL|

Integrations: Business Central, an Azure Logic App calling `/orderapi/orders`, Stripe and PayPal.
Hosting: Medusa Cloud (backend, storefront); Azure App Service (CMS).

### Commands

Run from the repo root, one command at a time. `<path>` is a test file or pattern; `<f>` is
`pnpm --filter <package>` (package from the table above).

|App|Scoped tests|Full tests|
|---|---|---|
|Backend|`<f> test:unit -- <path>`; admin: `<f> test:admin -- <path>`|`pnpm test:unit`, `pnpm test:integration:modules`, `pnpm test:integration:http` (local Postgres), `<f> test:admin`|
|Storefront|`<f> test -- <path>`|`<f> test`; visual: `<f> test:visual`|
|CMS|`<f> test -- <path>`|`<f> test`|

Every app: lint `<f> lint`; typecheck `<f> exec tsc --noEmit`; build `<f> build`; dev `<f> dev`.
Root `pnpm test` skips the backend (no `test` script); root `backend:dev` and `storefront:dev`
filter nonexistent package names. Typecheck and some tests fail today
(baseline: `ai/architecture/verification.md`).

Architecture check: none (`medusa lint` covers Medusa's own rules).

### Tools and vendor documentation

- `atlassian` MCP: Jira. `medusa` MCP: Medusa docs and API signatures (token:
  `MEDUSA_MCP_TOKEN` user env variable, never a file). `mcloud` CLI: Medusa Cloud. Check a
  skill's signature against the vendor docs server before relying on it.

Use the file tools, not shell `grep`/`cat`/heredocs (25x slower; heredocs mangle backslashes on
Windows). The shell may be PowerShell 5.1 (no `grep`, no `&&`): use
the Commands table's forms.

### Starting work

Start all work with the `triage` agent ("let's start working on <key>", or paste a request); it
registers new work and routes it to `quick-fix`, the full pipeline (`scoper` →
`implementation-planner` → `task-dispatcher`), or `analyse` when too unclear to route.

Choosing a flow (triage proposes, the first flow step confirms; `quick-fix` escalates up, `scoper` hands down):

|Full pipeline when the work involves any of|Otherwise `quick-fix`|
|---|---|
|a data-model change or migration|a bug with a concrete symptom, or a small change with clear rules|
|auth, personal data, payment or other regulated data|in one app|
|a contract between apps or with a vendor|no contract change|
|an unstated business rule, or a decision only the business can make|rules already clear|
|more than about three tasks' worth, or several apps|about three tasks' worth or less|

Always the full pipeline here: Business Central sync, the order API (`/orderapi`), company
authorization, spending limits and approvals, and checkout payments.

A simple fix (for the start-simple-fixes setting): one app, a handful of files, no new dependency,
cause certain, no full-pipeline signal.

Quick-fix confirmation: always

### Pipeline runs

During a pipeline or quick-fix run, agents act without asking. What needs a human goes into the
task's `## Deviations`, a review finding, or the deviation report's open questions (quick-fix: its
report). Nothing is pushed without the human's go-ahead. Run each subagent in the foreground and
wait (a backgrounded one once left tasks half-run).

### Results

A result is a value read from the real system after the change ran; tests prove logic, not delivery.
Report what tests verified and what is not yet verified after deploy separately.

### Tracker

Work items live in Jira (NIMBUS), the source of truth for what is agreed and how it changed.
`tracker-workflow` holds the procedure, `jira-workflow-dev` how each step is done in Jira, and its
`project.md` this project's rules (component `Customer Portal` on every issue and search).
Integration branch: `develop`; work branches `feature/NIMBUS-<number>`.

### Case folders

Each tracked piece of work has one folder, `issues/<key>/` (`NIMBUS-150`; a kebab-case slug until
the issue exists, then renamed), committed with the work:

|File|Written by|Kept|
|---|---|---|
|`feature.md` / `bug.md`|`feature-requests` / `bug-reporting`|yes|
|`scope.md`, `plan.md`|`scoper`, `implementation-planner`|yes|
|`deviation-report.md`|`integration-reviewer`, with the human's answers|yes|
|`change-report.md`, `analysis.md`|`quick-fix` (`analysis.md` also anyone investigating)|yes|
|`PROGRESS.md`|every agent or skill finishing a workflow stage|yes|
|`notes.md`, `samples/`, `logs/`, `mockups/`|anyone|yes|
|`manifest.md`, `NN-<slug>.md`, fix briefs, `branch-notes.md`|the pipeline|no: `cleanup` deletes them|
|`task.md`|`quick-fix`|no: the change report replaces it|

`PROGRESS.md`: read it first if present; its latest entry is the current state and handover.
Before finishing a stage, append a dated entry (outcome, next owner, handover prompt), creating
the file if needed; never replace earlier ones. Folders up to NIMBUS-176 keep v1 upper-case names.

One folder per unit of work through a flow, not per tracker issue: an epic run as one
scope has one folder; its plan tasks become sub-tasks without folders.

A shipped case folder is a frozen record of why: never update it or treat it as current behaviour.
The code and `docs/architecture/` describe the system (read the doc for the area you change); what
must stay current goes there, in the tracker, commits or the PR, never a case folder or code comment.

### Shared skill catalog

Before writing a new skill, suggest checking the Alpha Solutions catalog; after creating or largely
changing one, ask whether to contribute it (`ai/CONTRIBUTING.md`).

### Code comments

Comment only the why: invariants, vendor quirks, deviations from the obvious. Never cite plan task,
test-case or scope ids (reused every epic); cite the issue key or a `docs/architecture/` section.
Back any security claim in a comment with a test.

### Do not read

- `README.md` (root): upstream boilerplate with wrong versions.
- `docs/security-review-handover.md`: context only; status is in `docs/security-remediation.md`.
- `apps/storefront/messages/*.json` as runtime UI text (import material only).

Known gaps (no skill yet): Payload CMS, Business Central API, Stripe and PayPal clients.

## Skills

Load the matching skill before planning or implementing in its domain (a layer skill with its
technology skill). A skill's `project.md` is read with it and wins on conflict.

|Skill|When to use|
|---|---|
|`tracker-workflow`|Any tracker step; pipeline change history|
|`jira-workflow-dev`|How tracker steps are done in Jira (NIMBUS)|
|`commit-messages`|Committing|
|`bug-reporting`|Registering a bug|
|`feature-requests`|Registering a feature request|
|`secure-coding-owasp`|Any code change or review|
|`memory-discipline`|Before writing agent memory|
|`design-interview`|Interviewing about a plan or design|
|`code-review`|Reviewing a PR or diff outside the pipeline|
|`medusa-backend`|Any backend work in `apps/backend`|
|`medusa-module-and-data`|Models, services, links, migrations (L0–L1)|
|`medusa-infra-adapter`|Vendor API clients, e.g. Business Central (L2)|
|`medusa-workflow-and-steps`|Workflows, steps, hooks, rule helpers (L3–L5)|
|`medusa-api-route`|API routes (L6)|
|`medusa-triggers`|Subscribers and jobs (L7)|
|`medusa-admin`|Admin UI|
|`medusa-cloud`|`mcloud` and Medusa Cloud deployments|
|`medusa-storefront`|Storefront code calling the backend|
|`nextjs-data-layer`|Storefront data fetching and actions (S0–S2)|
|`storefront-best-practices`|Storefront UI/UX, cart, checkout, SEO|

## Instructions

Path-scoped conventions, applied automatically in each tool to matching files.

|Instruction|Applies to|
|---|---|
|`agent-discipline`|everything|
|`commit-messages`|everything|
|`typescript-style`|`**/*.{ts,tsx,mts,cts}`|
|`medusa-backend`|`apps/backend/**`|

<!-- context:end -->

<!-- tier0:begin (generated from ai/architecture by ai:check --fix; do not edit) -->

## Layers (`ai/architecture/layers.md`)

Every file belongs to one layer and calls only what its row allows (`boundaries.md`). Paths are
relative to `apps/backend/src/`, `apps/storefront/src/` and `apps/cms/src/`.

### Backend

|#|Layer|Location|Owns|May call|Must never|
|---|---|---|---|---|---|
|L0|Data model|`modules/<m>/models/*.ts`|its tables (`data-ownership.md`)|—|be imported outside its module|
|L1|Module service|`modules/<m>/service.ts`|CRUD + invariants on its own tables|its own L0, its module's L2 client|resolve another module, do HTTP itself or while holding a transaction, know a workflow exists|
|L2|Infra adapter|`modules/business-central/service.ts`; notification provider `notification-local` (`medusa-config.ts`)|exactly one external system|that vendor's HTTP API|hold a domain rule|
|L3|Step|`workflows/<domain>/steps/*.ts`|one compensatable unit|L1, L2, L5, Query|orchestrate other steps|
|L4|Workflow|`workflows/<domain>/workflows/*.ts`; core-flow hooks in `workflows/hooks/*.ts`|logic spanning modules; compensation|L3, L5 inside `transform()`, other workflows via `runAsStep`|`await`, branch outside `when()`, `new Date()`|
|L5|Decision fn|`workflows/<domain>/utils/*.ts`, `utils/*.ts` (pure only)|one pure business rule|nothing|any I/O|
|L6|API route|`api/{store,admin,orderapi,internal}/**/route.ts`, `api/**/middlewares.ts`, `api/middlewares/*.ts`|validate → L4 or Query → shape the response|L4, Query, event bus|branch on a business condition; mutate via L1|
|L7|Trigger|`subscribers/*.ts`; `jobs/*.ts`|call one workflow|L4|hold logic|

L5 names a business rule, never a mocking seam. Admin UI (`admin/**`) calls the backend only over
HTTP via `admin/lib/client.ts`. `limit-route-body`: an L6 route body is at most 40 lines, with no
`if` on a domain value; `limit-service-one-module`: no L1 method touches more than one module's data.

### Storefront (Next.js App Router, Medusa JS SDK)

|#|Layer|Location|Must never|
|---|---|---|---|
|S0|Transport client|`lib/config.ts` (the single `sdk`); `middleware.ts` uses raw `fetch` (Edge cannot load the SDK)|map, validate, decide|
|S1|Mapper|`lib/util/*.ts` (pure helpers; no mapper files yet, UNVERIFIED as a layer)|fetch|
|S2|Data fn / action|`lib/data/*.ts`: `"use server"` actions and `server-only` loaders (`bound-sf-server-only`)|hold a domain rule|
|S3|Route / server component|`app/[countryCode]/**`, `app/api/**`, `i18n/request.ts`|fetch vendor APIs directly|
|S4|Feature component|`modules/<feature>/{components,templates}/**`|fetch, or import `lib/` beyond S1 helpers and S2 actions|

### CMS (Payload, `apps/cms`)

`collections/*.ts` and `blocks/*.ts` define the schema, registered in `payload.config.ts`;
migrations in `migrations/`. The storefront reads the CMS only through `lib/data/cms.ts`.

Legacy files breaking these rows (not retrofitted): "Do not copy" in each layer skill's
`project.md`; new code never copies them.

## Boundaries (`ai/architecture/boundaries.md`)

Import edges of `layers.md`. `B` = `apps/backend/src`, `S` = `apps/storefront/src`, `<m>` one
module, `<other>` any other. Tests (`**/__tests__/**`, `*.spec.ts`, `*.test.ts`) are exempt; "value"
excludes `import type`. Review enforces every row (no import-boundary lint); `medusa lint`
(`@medusajs/eslint-plugin`) backs `bound-module-isolation` and `bound-route-no-service` with
`link-no-cross-module-relationship` (error) and `no-service-mutations-in-api-route` (warning).

|ID|From|To (forbidden unless noted)|
|---|---|---|
|`bound-model-private`|`B/**` outside `B/modules/<m>/**`|`B/modules/<m>/models/**`|
|`bound-module-isolation`|`B/modules/<m>/**`|`B/modules/<other>/**`|
|`bound-module-no-upward`|`B/modules/**`|`B/{workflows,api,subscribers,jobs,links}/**`|
|`bound-links-index-only`|`B/links/**`|only `B/modules/*/index.ts`, `@medusajs/medusa/*` allowed|
|`bound-workflow-no-upward`|`B/workflows/**`|`B/{api,subscribers,jobs}/**`|
|`bound-helper-pure`|`B/workflows/<domain>/utils/**`|`B/modules/*/service.ts`, `B/**/steps/**`, `@medusajs/framework/workflows-sdk` (all value)|
|`bound-route-no-service`|`B/api/**`|`B/modules/*/service.ts` (value)|
|`bound-api-private`|`B/**` outside `B/api/**`|`B/api/**`|
|`bound-trigger-thin`|`B/{subscribers,jobs}/**`|`B/modules/*/service.ts` (value), `B/**/steps/**`|
|`bound-app-isolation`|any app (`apps/backend`, `apps/storefront`, `apps/cms`)|another app's source|
|`bound-sf-transport-private`|`S/**` outside `S/lib/config.ts`, `S/lib/data/**`, `S/middleware.ts`|`@medusajs/js-sdk`, `S/lib/config.ts`|
|`bound-sf-server-only`|`S/lib/data/cms.ts`, `S/lib/data/ui-translations.ts`, `S/lib/data/country-languages.ts`|`server-only` required|

Baseline: `bound-route-no-service` in `B/api/store/bc-orders/[id]/returns/route.ts`,
`B/api/store/ui-translations/[locale]/route.ts`, `B/api/admin/ui-translations/*`;
`bound-sf-transport-private` in `S/app/[countryCode]/(main)/products/[handle]/page.tsx`.

### Locks

No Redis: locks are in memory, not shared across instances (unverified in production,
`docs/security-remediation.md`).

- `lock-single-run`: a lock keeping a sync or batch to one run is taken in the L7 trigger: try
  once, skip if held, release in `finally`.
- `lock-critical-section`: a lock around changing specific data is taken by a step whose
  compensation releases it, and released by a later step (or try/finally in one step).
  `acquireLockStep` skips itself under `runAsStep` unless `executeOnSubWorkflow: true`.
- `lock-ttl`: every lock has a TTL above the worst-case run, and an `ownerId` where a release could
  free another run's lock.
- `NO_LOCKING_IN_ROUTES`: no `.acquire()` in `B/api/**`.

## Medusa boundary (`ai/architecture/medusa-boundary.md`)

Where our code meets Medusa (2.21.0, every `@medusajs/*` package in `apps/backend`) and vendor
packages; examples in the `medusa-backend` skill (`reference/medusa-boundary.md`,
`reference/querying-data.md`).

### Verify, don't assume

- Verify each framework or vendor behaviour a design relies on before use (installed source or
  the `medusa` MCP, else the Medusa docs); record the primitive, evidence and behaviours checked
  (repeated calls, invalid or missing input, concurrent races); an unverified claim is marked
  UNVERIFIED in the plan and blocks dispatch.
- Security-relevant vendor claims: from dist code or a runnable probe, never docs.
- Installed source: `apps/backend/node_modules/@medusajs/<pkg>/dist/...` (`node-linker=hoisted`,
  `apps/backend/.npmrc`), else `node_modules/.pnpm/@medusajs+<pkg>@*/node_modules/@medusajs/<pkg>`;
  a no-match grep counts only once it provably searched a real path.

### OOTB first

Use Medusa's workflow or step before your own (core workflows emit events raw service calls skip);
add no pre-check, dedup, retry or compensation around it without evidence it lacks that guarantee.
Extend core flows through `apps/backend/src/workflows/hooks/`, never by copying them.

### Reading core data

- `data-schema-vs-model`: generated types don't prove `query.graph()` resolves a field; where it is
  computed does (module service: yes; core-flows workflow: never, e.g. `order.payment_status`). A
  wrong `query.graph` path is a silent `undefined` (e.g. `items.detail.quantity` on an order):
  verify the shape once on real data and mock only that.
- `data-core-read-workflows`: a substantive read of a core entity uses its core read workflow
  (`getOrderDetailWorkflow`, `getOrdersListWorkflow`); `query.graph()` suits our own models and
  narrow existence or scope checks, each commented as a deliberate exemption.
- `data-no-core-internals`: call the workflow, not the core internal it wraps.
- Pitfall: `fields` expansions deeper than Medusa's relation-depth limit fail at runtime
  (`api/store/quotes/query-config.ts`).

### Types

- Never `as unknown as` (`NO_UNKNOWN_CAST`); an unavoidable escape is exactly one, in a named
  helper, commented with the verified runtime shape.
- A declared type matches the runtime value: `model.dateTime()` is a `Date`.
- `apps/backend/tsconfig.json` sets only `strictNullChecks` (not `strict`), so implicit `any`
  compiles: review enforces `type-no-any`.

### Module-service constraints

- `data-service-async`: every public module-service method is `async` or returns a Promise.
- `data-service-transaction`: a custom method touching the database is a public `@InjectManager()`
  method calling a protected `name_` method with `@InjectTransactionManager()`, both taking a last
  optional `@MedusaContext() sharedContext?: Context`.

### Workflow failures

A failed workflow rejects with a serialised object, not an `Error`: in a test assert
`rejects.toMatchObject({ message })`; when logging, read `.message` defensively.

## Data ownership (`ai/architecture/data-ownership.md`)

Every table has one owning module (core tables: their Medusa module). The CMS (`apps/cms`) has its
own Postgres database (`DATABASE_URI`), owned by Payload; no other app touches it.

- Only the owner's L1 service reads or writes its tables, raw SQL included; other modules read
  them through `query.graph()` (or `query.index()` to filter by linked-module fields).
- Cross-module relationships are module links in `apps/backend/src/links/`, never foreign keys.
- Migrations are generated (`medusa db:generate <module>`, then `medusa db:migrate`; CMS:
  `payload migrate:create`), never hand-written; a hand-written one is a blocking deviation.
- Personal data: company and employee contact, address, VAT and credit data (company module, from
  Business Central) and Medusa customers. Never log it: errors log the message only
  (`apps/storefront/src/lib/util/customer-error.ts`); page paths stored with missing translation
  keys are sanitized first (`apps/storefront/src/i18n/request.ts`).
- BC-managed company fields (`apps/backend/src/admin/routes/companies/bc-managed-fields.ts`):
  Business Central is their source of truth; never edited.

### Registry (`apps/backend/src/modules`)

|Module (container key)|Tables|Migrations|
|---|---|---|
|`company`|`company`, `employee`|`modules/company/migrations/`|
|`quote`|`quote`, `message`|`modules/quote/migrations/`|
|`approval`|`approval`, `approval_settings`, `approval_status`|`modules/approval/migrations/`|
|`orderIngestion`|`order_external_reference`, `shipment_notice`, `shipment_tracking`, `shipment_notice_state`|`modules/order-ingestion/migrations/`|
|`storefrontTranslation`|`storefront_translation`, `translation_missing_key`, `country_language_configuration`|`modules/storefront-translation/migrations/`|
|`businessCentral`|none (HTTP client for Dynamics 365 Business Central)|—|

Legacy exceptions: `medusa-module-and-data` `project.md`.

## Business-rule registry (`ai/architecture/decisions.md`)

One home per rule; consumers render its verdict. Check here before adding one.
`B`, `S` as in `boundaries.md`.

|Rule|Owning file|Verdict via|Consumers|Status|
|---|---|---|---|---|
|Password recovery: 15-min customer proof, latest link, sequential single use (NIMBUS-133)|Medusa Auth; `B/api/auth/middlewares.ts` (validation); `B/workflows/customer/workflows/send-password-reset.ts` (email)|Core Auth reset/update; Notification `email`|`S/lib/data/password-recovery.ts`|ok; concurrent reuse/token persistence/logging accepted; default sessions|
|Spending limit (per order only, finding 7)|`B/utils/check-spending-limit.ts`|checkout error (`B/workflows/hooks/validate-cart-completion.ts`)|storefront cart, checkout|duplicate: `S/lib/util/check-spending-limit.ts`|
|Cart approval status|`B/utils/get-cart-approval-status.ts`, `validate-cart-approvals.ts`|cart approvals|storefront cart, checkout, approvals|divergent duplicate: `S/lib/util/get-cart-approval-status.ts` (approved = all vs any)|
|Cart access, verified cart–company association|`B/workflows/cart/utils/cart-access.ts`|404 (`authorizeCartAccessWorkflow`)|cart guard; approvals list and decision|ok|
|Store order read and return: owner, or company admin of the approved source cart (NIMBUS-177)|`B/workflows/order/utils/order-access.ts`|404 (`B/api/middlewares/ensure-order-access.ts`)|`GET /store/orders/:id`, `POST /store/returns`|ok|
|Order API enabled per company (NIMBUS-217)|`B/utils/order-api-access.ts`|403|order API; shipment jobs; Admin retry|ok|
|Business Central environment of a company: stored `country` `NO` (trimmed, any case) → NO, else DK (NIMBUS-261)|`B/utils/business-central-environment.ts`|environment (`B/workflows/company/workflows/resolve-business-central-account.ts`)|store BC routes, return creation, company sync, Admin BC customer routes|ok|
|Order transfer only without an account owner (NIMBUS-177)|`B/workflows/order/utils/order-transfer.ts`|400|`POST /store/orders/:id/transfer/request`|ok|
|BC company sync: fields written; updated/skipped/failed|`B/workflows/company/steps/prepare-company-bc-sync.ts`|workflow status|login sync, store company read, Admin sync route|ok|
|BC-managed company fields are read-only|`B/admin/routes/companies/bc-managed-fields.ts`|admin form; BC sync|storefront company card|ok|
|Company credit/blocked/reset fields and colleague spending limits: admin-only|`B/api/store/companies/company-projection.ts`|store profiles|storefront|ok; quotes: name only (`B/api/store/quotes/query-config.ts`)|
|Sent or recorded BC orders: duplicate protection and a force warning|`B/modules/order-ingestion/bc-integration-state.ts` (`hasBusinessCentralOrder`)|pure verdict|Admin widget; submission guard|ok|
|BC submission skips existing orders unless forced|`B/workflows/business-central-order/utils/admin-bc-integration.ts` (`shouldSkipBcSubmission`)|preparation outcome|automatic and Admin workflows|ok|
|Order line barcode resolution to BC item and size|`B/workflows/business-central-order/utils/resolve-order-line-item.ts`|line failures|BC order prepare step|ok|
|Shipment notice match, netting, revision, check schedule, line size (`TRCShipmentLine`), undo pairing|`B/workflows/shipment-notice/utils/`|pure verdicts|shipment discovery and check workflows|ok|
|BC order line name, extra description, size (NIMBUS-255)|`S/lib/util/bc-order-line-display.ts`|pure helper|BC order detail, return table|ok|
|Free-shipping threshold|`B/api/store/free-shipping/utils.ts`|`/store/free-shipping/prices`|`S/lib/data/fulfillment.ts`|ok|
|Supported and reference (`en`) locales|`B/modules/storefront-translation/service.ts`|`/store/ui-translations/:locale`; `default_locale` of `/store/country-languages`|`B/admin/lib/translations.ts`, `S/lib/data/country-languages.ts`|duplicates: `REFERENCE_LOCALE` (admin); `DEFAULT_LOCALE` in `S/lib/i18n/country-language-map.ts` (cold-outage fallback only)|
|Country-language deploy bootstrap skips countries with an unavailable legacy language (English default)|`B/workflows/storefront-translation/utils/country-language-scope.ts` (`skipUnavailableAssignments`)|`skipped` in the workflow result|`B/migration-scripts/seed-country-languages.ts`|ok|
|Runtime UI text from the DB, not `S/messages/*.json`|`B/modules/storefront-translation`|`/store/ui-translations/:locale` (300 s cache)|`S/lib/data/ui-translations.ts`|ok|
|Country language assignment and deactivation guard|`B/modules/storefront-translation/country-languages.ts`, `service.ts`|`/admin/country-languages`, `/store/country-languages`|Admin Translations page; `S/lib/data/country-languages.ts`|ok; `COUNTRY_LANGUAGE_MAP` (beside `DEFAULT_LOCALE`): approved cold-outage fallback|
|Email language, link country, text fallback|`B/workflows/transactional-email/utils/email-language.ts`, `email-texts.ts`|pure verdicts|reset, invitation emails|ok; built-in English `Emails` copy: approved fallback|
|Formatting tag and hreflang key of a country's language|`S/lib/i18n/formatting-locale.ts`, `S/lib/seo/locale-alternates.ts`|pure helpers|prices, dates; product, collection, category metadata|ok|

Domain types are duplicated in `B/types/` and `S/types/` (no shared package).

## Verification (`ai/architecture/verification.md`)

What a test must prove and at which layer (commands: `ai/AGENTS.md`, Commands).

|Layer|Tool and location|Use for|
|---|---|---|
|Unit|Jest: backend `src/**/__tests__/*.unit.spec.ts`, admin `src/admin/**/__tests__/*.test.tsx`, storefront `src/__tests__/**` (mirrors `app/`, `lib/`, `modules/`). Vitest: CMS `src/**/*.test.ts`|pure decision functions on plain data|
|Contract|Jest: `apps/backend/integration-tests/http/<area>/*.spec.ts`, real Postgres|endpoint contracts|
|Integration|Jest: `apps/backend/src/modules/<m>/__tests__/*.spec.ts`; Playwright: `apps/storefront/e2e/visual/`|what a contract test can't see: lock order, partial failure, races|

- Test behaviour: business rules, error and edge handling, security boundaries, silently failing
  mechanisms (event vs direct call, lock order, diff vs delete-and-recreate). Skip pass-through
  mapping, framework guarantees, trivial rendering. Test volume is a signal, not a target.
- Assert at the depth the caller consumes: the type of each field it uses, not its container.
- Security work carries negative cases per property (membership, role, cross-company access) in
  `integration-tests/http/security/security-boundaries.spec.ts`; a vendor-dependent property is
  tested once against the real library.
- Never mock framework-resolved services to assert call order: test the extracted pure decision or
  move the case to integration; extract only pure logic (resolution and I/O stay put), never a
  `*Logic(input, deps)` mocking seam.
- Never read source files as text in a test (fixtures are fine); prefer a behaviour assertion, then
  the module's exports, then a lint rule for absence claims.
- Per task: only new or changed tests, lint, whole-app typecheck (at or below baseline). Full
  suite, integration tests and build run once, at finalization.
- "Also update" (task file or quick-fix `task.md`): every existing test (incl. contract and
  end-to-end), `docs/` section, `ai/` file (business-rule registry, Tier 0 rows, a skill's
  `project.md`) and user-facing doc describing the changed behaviour (search names, routes, fields,
  messages, rule wording), or "none found"; fix a stale test's assertion, never delete it to pass.

### Baseline (not green today)

Per `docs/security-remediation.md` (2026-09-20; re-measure first): `tsc --noEmit` fails in backend
and storefront (`next build` hides it); one BC module test, 3 storefront and 1 CMS test fail. No CI
runs backend or storefront tests. Backend tests abort unless `BUSINESS_CENTRAL_DISCOVERY_URL` is an
allowed test environment (`integration-tests/global-setup.ts`).

Local `test:integration:http` (develop `eea3a01`, 2026-10-23): 77 tests fail with 401 on login
(NIMBUS-236), in `integration-tests/http/*.spec.ts`: `admin/bc-integration`, `quotes/quotes`,
`admin/quotes/quotes`, `security/password-recovery`, `translations/translations`,
`security/security-boundaries`, `companies/companies`.

### Whole-branch checks

- New modules are registered in `apps/backend/medusa-config.ts`.
- Company-scoped store routes use `api/middlewares/ensure-role.ts`.
- New UI text is a translation key (`react/jsx-no-literals`).
- Only `NEXT_PUBLIC_*` variables reach client code; other secrets stay server-side.

## Rules (`ai/architecture/rules.md`)

Every rule ID, its severity and enforcement. Only findings that predate a rule are baselined (not
retrofitted); anything new fails, and a baseline is never regenerated to clear a finding. A
violation is a design error: never suppress it or weaken the rule to pass a task.

|Rule IDs|Severity|Enforced by|
|---|---|---|
|`bound-*` (`boundaries.md`)|high, blocker|review; `medusa lint` for module relationships|
|`lock-*`, `NO_LOCKING_IN_ROUTES` (`boundaries.md`)|high, blocker|review|
|`NO_UNKNOWN_CAST`, `data-schema-vs-model`, `data-core-read-workflows`, `data-no-core-internals`, `data-service-*` (`medusa-boundary.md`)|high|review|
|`limit-route-body`, `limit-service-one-module` (`layers.md`)|medium|review|
|`arch-*`, `data-*`, `type-*`, `file-*`, `logic-*`, `sdk-*` (Medusa skills)|as the skill states|review; `medusa lint` for workflow composition|
|`type-no-any`|high|review; baseline: 16 storefront files, `workflows/order/steps/update-order.ts`|
|`no-plan-id-comments` (task, test-case or scope ids in comments)|high|review|
|One home per business rule|high|`decisions.md`; review|
|`trust-no-client-company`: never authorize from client `metadata.company_id`|high, blocker|review; baseline: `workflows/hooks/order-created.ts`|
|`ui-text-translated`: storefront UI text is a translation key|medium|`react/jsx-no-literals` (warn)|

Open security findings 7 (spending limit per order only), 8 (client company id), 10 (claims live
preview bypasses login): read `docs/security-remediation.md` before touching carts, checkout or
company access.

<!-- tier0:end -->
