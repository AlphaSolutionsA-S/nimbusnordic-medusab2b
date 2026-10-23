# Manifest: Customize page on all custom Medusa Admin pages

**Key:** NIMBUS-223
**Issue:** NIMBUS-223
**Branch:** feature/NIMBUS-223 (from develop)
**Ready for Dispatch:** true (plan approved by Klaus Petersen, 2026-10-23)

## Conventions and commands

All tasks are Admin UI in `apps/backend/src/admin/` (package `@b2b-starter/backend`), run from the
repo root:

- Scoped tests: `pnpm --filter @b2b-starter/backend test:admin -- <path>`; Admin tests live in
  `src/admin/**/__tests__/*.test.tsx` (Jest, jsdom, `jest.admin.config.js`). Mock only the SDK
  boundary (`lib/client`); `@medusajs/dashboard/components` is mapped to the stand-in from task 01.
- Lint: `pnpm --filter @b2b-starter/backend lint`.
- Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend` (fails today; stay at or
  below the baseline count measured before task 01).
- Finalization only: `pnpm --filter @b2b-starter/backend test:admin` and
  `pnpm --filter @b2b-starter/backend build`.
- Layout import: `LayoutComposer` from `@medusajs/dashboard/components`; layout ids from
  `CORE_LAYOUT_IDS` in `@medusajs/admin-shared` (both already dependencies). No new dependency.

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Page keys, Jest stand-in, list pages on the layout | `01-list-pages-layout.md` | backend (Admin) | F1–F4, F6, F7, NF fixed names; structure 1 | None | NIMBUS-224 | TODO |
| 02 | Shipment tracking in two sections | `02-shipment-tracking-layout.md` | backend (Admin) | F1–F7; structure 4 | 01 | NIMBUS-225 | TODO |
| 03 | Company details in three sections | `03-company-details-layout.md` | backend (Admin) | F1–F7; structure 2; BC warning rule | 01 | NIMBUS-226 | TODO |
| 04 | Quote details in two columns | `04-quote-details-layout.md` | backend (Admin) | F1–F7; structure 3; NF widths | 01 | NIMBUS-227 | TODO |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| Storage of arrangements, Personal/Default, reset via Default (F2, F3) | external: Medusa settings module and `LayoutComposer`, no code of ours |
| NF: no backend code, endpoint, table or migration | not needed (constraint, honoured by every task) |
| Manage quote | out of scope (Klaus, 2026-10-23) |
| Runtime probe in a browser | Klaus at the final gate (plan, Needs your decision 1) |
