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

- jira-workflow (instance: dev): .github/skills/jira-workflow/SKILL.md
- commit-messages: .github/skills/commit-messages/SKILL.md
- bug-reporting: .github/skills/bug-reporting/SKILL.md
- feature-requests: .github/skills/feature-requests/SKILL.md
- secure-coding-owasp: .github/skills/secure-coding-owasp/SKILL.md
- code-review: .github/skills/code-review/SKILL.md
- definition-of-done: .github/skills/definition-of-done/SKILL.md
- memory-discipline: .github/skills/memory-discipline/SKILL.md

When working on Medusa-related code, load the appropriate skill:

| Skill | When to use |
|-------|-------------|
| `building-with-medusa` | Backend work in `apps/backend/` — custom modules, data models, workflows, API routes, subscribers, scheduled jobs |
| `building-admin-dashboard-customizations` | Admin UI in `apps/backend/src/admin/` — widgets, custom pages, forms, data tables |
| `building-storefronts` | Storefront Medusa integration in `apps/storefront/`  — JS SDK usage, React Query patterns |
| `creating-internal-agents` | Internal admin-facing AI agents — merchant/operator tools, not customer-facing |
| `using-medusa-cloud` | Deployments, environment management, debugging via `mcloud` CLI |

## Installed Instructions (Copilot paths)

- .github/instructions/agent-discipline.instructions.md
- .github/instructions/csharp-style.instructions.md
- .github/instructions/typescript-style.instructions.md

## Harnesses

- github-copilot-vscode
- codex