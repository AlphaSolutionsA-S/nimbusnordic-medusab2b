# Alpha Solutions Agent Setup - Nimbus Nordic

## Overview

 e-commerce platform based on **Medusa v2** (headless commerce), and a **Next.js 16** storefront. 

## Monorepo Structure

| Path | App | Purpose |
|------|-----|---------|
| `apps/storefront/` | Next.js Storefront | Customer-facing storefront with  Medusa commerce (Next.js 15) |
| `apps/backend/` | Medusa Commerce Engine | Headless commerce API, admin dashboard, product/order management |

## Tooling

- **Package manager:** pnpm (with workspaces)
- **Build orchestration:** Turborepo
- **Language:** TypeScript (strict mode) across storefront and backend

## Commands (run from root)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps (storefront + backend) |
| `pnpm build` | Build all apps |
| `pnpm storefront:dev` | Start storefront only |
| `pnpm backend:dev` | Start backend only |
| `pnpm backend:seed` | Seed backend database |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all apps |

## Hosting

- **Medusa backend + admin dashboard:** Medusa Cloud (`mcloud` CLI for deployments, env vars, logs)
- **Storefront:** Medusa Cloud (`mcloud` CLI for deployments, env vars, logs)

## App-Level Instructions

Each app has its own instruction files with specific conventions. Refer to those when working in a specific app — do not apply storefront patterns to the backend or vice versa.


This repository includes installed team skills and instructions for GitHub Copilot and Codex.

## Installed Skills (Copilot paths)

### General & Workflow

| Skill | Path | When to use |
|-------|------|-------------|
| `jira-workflow` (instance: dev) | `.github/skills/jira-workflow/SKILL.md` | Starting/switching to a JIRA issue, or closing one — issue lookup, assignee/status hygiene, commit-message formatting |
| `commit-messages` | `.github/skills/commit-messages/SKILL.md` | Committing code, staging changes, running `git commit` |
| `bug-reporting` | `.github/skills/bug-reporting/SKILL.md` | Registering/filing/documenting a bug |
| `feature-requests` | `.github/skills/feature-requests/SKILL.md` | Registering/documenting a feature request or enhancement |
| `secure-coding-owasp` | `.github/skills/secure-coding-owasp/SKILL.md` | Generating, reviewing, or modifying any code |
| `code-review` | `.github/skills/code-review/SKILL.md` | Reviewing a PR, diff, patch, or staged changes |
| `definition-of-done` | `.github/skills/definition-of-done/SKILL.md` | Closing an issue, opening a PR, asking "is this done?" |
| `memory-discipline` | `.github/skills/memory-discipline/SKILL.md` | Before writing to agent memory (Copilot, Claude, Cursor) |

### Medusa Development

| Skill | Path | When to use |
|-------|------|-------------|
| `building-with-medusa` | `.github/skills/building-with-medusa/SKILL.md` | Backend work in `apps/backend/` — custom modules, data models, workflows, API routes, subscribers, scheduled jobs |
| `building-admin-dashboard-customizations` | `.github/skills/building-admin-dashboard-customizations/SKILL.md` | Admin UI in `apps/backend/src/admin/` — widgets, custom pages, forms, data tables |
| `building-storefronts` | `.github/skills/building-storefronts/SKILL.md` | Storefront Medusa integration in `apps/storefront/` — JS SDK usage, React Query patterns |
| `storefront-best-practices` | `.github/skills/storefront-best-practices/SKILL.md` | Any storefront component/page — cart, checkout, PDP/PLP, nav, homepage |
| `creating-internal-agents` | `.github/skills/creating-internal-agents/SKILL.md` | Internal admin-facing AI agents — merchant/operator tools, not customer-facing |
| `db-generate` | `.github/skills/db-generate/SKILL.md` | Generating database migrations for a Medusa module |
| `db-migrate` | `.github/skills/db-migrate/SKILL.md` | Running database migrations in Medusa |
| `new-user` | `.github/skills/new-user/SKILL.md` | Creating an admin user in Medusa |

### Medusa Cloud (`mcloud`)

| Skill | Path | When to use |
|-------|------|-------------|
| `using-medusa-cloud` | `.github/skills/using-medusa-cloud/SKILL.md` | Umbrella skill for deployments, environment management, debugging via `mcloud` CLI |
| `mcloud-auth` | `.github/skills/mcloud-auth/SKILL.md` | `login`, `logout`, `whoami`, `use`, `version`, `signup` |
| `mcloud-organizations` | `.github/skills/mcloud-organizations/SKILL.md` | Listing/getting Cloud organizations |
| `mcloud-projects` | `.github/skills/mcloud-projects/SKILL.md` | Listing/getting/deleting Cloud projects |
| `mcloud-environments` | `.github/skills/mcloud-environments/SKILL.md` | Managing environment lifecycle, redeploying, triggering builds |
| `mcloud-deployments` | `.github/skills/mcloud-deployments/SKILL.md` | Listing deployments, deployment details, build logs |
| `mcloud-variables` | `.github/skills/mcloud-variables/SKILL.md` | Listing/getting environment variables |
| `mcloud-logs` | `.github/skills/mcloud-logs/SKILL.md` | Fetching/streaming runtime logs |

## Installed Instructions (Copilot paths)

- .github/instructions/agent-discipline.instructions.md
- .github/instructions/csharp-style.instructions.md
- .github/instructions/typescript-style.instructions.md

## Harnesses

- github-copilot-vscode
- codex

## Issue Progress Records

For work associated with `issues/<caseid>/`, check `PROGRESS.md` before acting when it
exists. Treat its latest entry as the current workflow state and handover target. Before
finishing a workflow stage, append a dated entry that records the outcome, the next owner,
and any handover prompt. If the issue folder has no `PROGRESS.md`, create it when your
workflow first records a handover; never replace earlier entries.