# Manifest: Sync a company from Business Central now, from the Admin company page

**Key:** NIMBUS-254
**Issue:** NIMBUS-254
**Branch:** feature/NIMBUS-254 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

All tasks are in `apps/backend` (`@b2b-starter/backend`). `<f>` = `pnpm --filter @b2b-starter/backend`.

- Unit: `<f> test:unit -- <path>` (`src/**/__tests__/*.unit.spec.ts`).
- Admin UI: `<f> test:admin -- <path>` (`src/admin/**/__tests__/*.test.tsx`; mock only
  `admin/lib/client.ts`, as `routes/companies/__tests__/company-details-layout.test.tsx` does).
- Contract and integration: `<f> test:integration:http -- <path>` (`integration-tests/http/**`). This
  can't run in this checkout (plan section 2). Per task, write the cases and run lint and typecheck
  only. The finalization rule is in plan section 2.
- Lint `<f> lint`. Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend`. It fails
  today (baseline in `ai/architecture/verification.md`); no new errors in touched files.
- After editing `ai/architecture/*.md`: `pnpm ai:check --fix`, then `pnpm ai:check`.
- No migration and no new module. Commits: `NIMBUS-254: <imperative>`.

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | BC company sync starts from a company id as well as a customer | `01-sync-by-company-id.md` | backend | F2, F4 (outcomes), F7, NF no-employees, NF store triggers unchanged, NF one mapping, NF no PII in logs | None | NIMBUS-258 | TODO |
| 02 | Admin sync route and last-synced time in the Admin company read | `02-admin-sync-route.md` | backend | F3 (server side), F6 (read), F8, security draft rows | 01 | NIMBUS-259 | TODO |
| 03 | Admin action, outcome toasts, last-synced row and banner text | `03-admin-sync-ui.md` | backend (Admin UI) | F1, F3 (UI), F4 (messages), F5, F6 (display), F9 | 02 | NIMBUS-260 | TODO |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| NF: no new lock or repeat-click guard (R9) | not needed: decided by the human |
| R10 / Open question 3: audit of who ran a sync | not needed: answered no (2026-10-26) |
| Open question 1: storefront 120 s cache | not needed: accepted (2026-10-26), no storefront change |
| Open question 2: enforcing blocked or credit limit at checkout | out of scope (2026-10-26) |
| `docs/architecture/` company or BC sync section | none exists; `documentation-writer` decides after ship |
