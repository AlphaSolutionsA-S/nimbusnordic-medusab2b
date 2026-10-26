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
|---|---|---|
| Backend + Admin (`@b2b-starter/backend`) | `apps/backend` | Medusa 2.21.0, TypeScript (only `strictNullChecks`), PostgreSQL |
| Storefront (`@b2b-starter/storefront`) | `apps/storefront` | Next.js 15.5, React 19, Medusa JS SDK, next-intl 4, TypeScript strict |
| CMS (`@dtc/cms`) | `apps/cms` | Payload 3.90 on Next.js 16, own PostgreSQL |

Integrations: Business Central, an Azure Logic App calling `/orderapi/orders`, Stripe and PayPal.
Hosting: Medusa Cloud (backend, storefront); Azure App Service (CMS).

### Commands

Run from the repo root, one command at a time. `<path>` is a test file path or pattern; `<f>` is
`pnpm --filter <package>` with the package from the table.

| App | Scoped tests | Full tests |
|---|---|---|
| Backend | `<f> test:unit -- <path>`; admin: `<f> test:admin -- <path>` | `pnpm test:unit`, `pnpm test:integration:modules`, `pnpm test:integration:http` (local Postgres), `<f> test:admin` |
| Storefront | `<f> test -- <path>` | `<f> test`; visual: `<f> test:visual` |
| CMS | `<f> test -- <path>` | `<f> test` |

Every app: lint `<f> lint`; typecheck `<f> exec tsc --noEmit`; build `<f> build`. Root `pnpm test` skips the backend (no `test` script). Typecheck and some tests fail today
(baseline: `ai/architecture/verification.md`). Dev servers: `<f> dev` (root `backend:dev` and
`storefront:dev` filter nonexistent package names).

Architecture check: none (`medusa lint` covers Medusa's own rules).

### Tools and vendor documentation

- `atlassian` MCP: Jira. `medusa` MCP: Medusa docs and API signatures (token:
  `MEDUSA_MCP_TOKEN` user env variable, never a file). `mcloud` CLI: Medusa Cloud.

Check a skill's signature against the vendor docs server before relying on it.

Read, search and write files with the file tools, not shell `grep`/`cat`/heredocs (25x slower;
heredocs mangle backslashes on Windows). The shell may be PowerShell 5.1 (no `grep`, no `&&`): use
the Commands table's forms.

### Starting work

Start all work with the `triage` agent ("let's start working on <key>", or paste a new request).
Triage registers new work and routes it: `quick-fix`, the full pipeline (`scoper` →
`implementation-planner` → `task-dispatcher`), or `analyse` when too unclear to route.

Choosing a flow (triage proposes, the first flow step confirms; `quick-fix` escalates up, `scoper` hands down):

| Full pipeline when the work involves any of | Otherwise `quick-fix` |
|---|---|
| a data-model change or migration | a bug with a concrete symptom, or a small change with clear rules |
| auth, personal data, payment or other regulated data | in one app |
| a contract between apps or with a vendor | no contract change |
| an unstated business rule, or a decision only the business can make | rules already clear |
| more than about three tasks' worth, or several apps | about three tasks' worth or less |

Always the full pipeline here: Business Central sync, the order API (`/orderapi`), company
authorization, spending limits and approvals, and checkout payments.

A simple fix (for the start-simple-fixes setting): one app, a handful of files, no new dependency,
cause certain, no full-pipeline signal.

Quick-fix confirmation: always

### Pipeline runs

During a pipeline or quick-fix run, agents act without asking. What needs a human goes into the
task's `## Deviations`, a review finding, or the deviation report's open questions (quick-fix: its
report). Nothing is pushed without the human's go-ahead. Run each subagent in the foreground and
wait for it; a dispatcher that backgrounded one handed back with tasks half-run.

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

| File | Written by | Kept |
|---|---|---|
| `feature.md` / `bug.md` | `feature-requests` / `bug-reporting` | yes |
| `scope.md`, `plan.md` | `scoper`, `implementation-planner` | yes |
| `deviation-report.md` | `integration-reviewer`, with the human's answers | yes |
| `change-report.md`, `analysis.md` | `quick-fix` (`analysis.md` also anyone investigating) | yes |
| `PROGRESS.md` | every agent or skill finishing a workflow stage | yes |
| `notes.md`, `samples/`, `logs/`, `mockups/` | anyone | yes |
| `manifest.md`, `NN-<slug>.md`, fix briefs, `branch-notes.md` | the pipeline | no: `cleanup` deletes them |
| `task.md` | `quick-fix` | no: the change report replaces it |

`PROGRESS.md`: read it first if present; its latest entry is the current state and handover.
Before finishing a stage, append a dated entry (outcome, next owner, handover prompt), creating the
file if needed; never replace earlier entries. Folders up to NIMBUS-176 keep v1 upper-case names.

One folder per unit of work run through a flow, not per tracker issue: an epic run as one
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

Load the matching skill before planning or implementing in its domain (a layer skill with its
technology skill). A skill's `project.md` is read with it and wins on conflict.

| Skill | When to use |
|---|---|
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

Path-scoped conventions, applied automatically in each tool to matching files.

| Instruction | Applies to |
|---|---|
| `agent-discipline` | everything |
| `commit-messages` | everything |
| `typescript-style` | `**/*.{ts,tsx,mts,cts}` |
| `medusa-backend` | `apps/backend/**` |
