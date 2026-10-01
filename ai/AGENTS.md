# AI base — Nimbus Nordic

This directory (`ai/`) is the single source of truth for this repository's AI assets: the
architecture contract, skills, agents and instructions. Every tool the team uses reads the same
content through thin pointer stubs in its own folder (`.claude/`, `.github/`, `.agents/`, `.codex/`,
root `CLAUDE.md` / `AGENTS.md`). Edit content here only; see [CONTRIBUTING.md](./CONTRIBUTING.md).
Run `pnpm ai:check` after any change to `ai/`.

This base was bootstrapped from the Alpha Solutions harness; `ai/harness.json` records the version.

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

## Architecture contract (Tier 0)

The files in `ai/architecture/` are the contract every agent works to, loaded in every session.
Edit them only there, then run `pnpm ai:check --fix`.

@architecture/layers.md
@architecture/boundaries.md
@architecture/medusa-boundary.md
@architecture/data-ownership.md
@architecture/decisions.md
@architecture/verification.md
@architecture/rules.md

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

## Agents

Delegated agents for the pipeline. Every handoff between scope, plan and implementation needs an
explicit, separate go-ahead from a human; approving one stage's output does not start the next.

| Agent | Purpose |
|-------|---------|
| `triage` | The entry point: reads an issue or a pasted request, registers new work, and routes it to quick-fix, the full pipeline or analyse. |
| `quick-fix` | Bugs and small changes: reproduce and find the cause (bugs), a short plan, test-first fix, review, local commit; escalates to the full pipeline when the work needs it. |
| `scoper` | Turn an idea or bug into a scope document with business rules and draft data-model and security tables; records it in the tracker. |
| `analyse` | Offered by triage for unclear requests: options with trade-offs for a hard problem, or a review document of current vs requested behaviour (incl. porting from another repo) for the scoper. No code. |
| `implementation-planner` | Explore the codebase, design the solution, and write a plan a person reads first, a manifest and short task files; creates the tracker tasks. |
| `task-dispatcher` | Run tasks one at a time (worker → review → local commit), then the whole-branch pass and a human gate before push. |
| `tdd-worker` | Implement one task test-first from its test intent; record deviations. Also runs the consolidation pass. |
| `code-reviewer` | Read-only review of one task's diff: correctness, security, test-intent coverage, Tier 0 blockers. |
| `integration-reviewer` | Cross-task review of the whole branch against the plan's tables, plus wiring; writes the deviation report. |
| `committer` | After the final gate: fix commits and the PR description. |
| `documentation-writer` | Update `docs/architecture/` after a feature ships. |
| `cleanup` | Delete the pipeline's working files from the case folder, leaving its records frozen. |

## Instructions

Path-scoped conventions, applied automatically in each tool when working in the matching files.

| Instruction | Applies to |
|-------------|------------|
| `agent-discipline` | everything |
| `commit-messages` | everything |
| `typescript-style` | `**/*.{ts,tsx,mts,cts}` |
| `medusa-backend` | `apps/backend/**` |
