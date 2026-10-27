# Manifest: Norwegian companies use the Norwegian Business Central for returns, order history and company sync

**Key:** NIMBUS-261
**Issue:** NIMBUS-261
**Branch:** feature/NIMBUS-261 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

All tasks are in `apps/backend` (`@b2b-starter/backend`). `<f>` = `pnpm --filter @b2b-starter/backend`.
Plan approved by Klaus Petersen, 2026-10-27. The TestNO probe ran (`samples/probe-results-2026-10-27.md`); the customer-portal extension is not yet in NO and gates only the verification of the parts that need it and the production go-live (plan sections 2 and 10).

- Unit: `<f> test:unit -- <path>` (`src/**/__tests__/*.unit.spec.ts`), for pure functions.
- BC module specs: `src/modules/business-central/__tests__/*.spec.ts` run with
  `<f> test:integration:modules -- <path>`. They mock `fetch`; the Jest global setup still needs
  `BUSINESS_CENTRAL_DISCOVERY_URL` set to the TestDK URL from `apps/backend/.env.template` in the
  shell (no BC request is made).
- Admin UI: `<f> test:admin -- <path>` (`src/admin/**/__tests__/*.test.tsx`; mock only
  `admin/lib/client.ts`, as `routes/companies/__tests__/company-bc-sync.test.tsx` does).
- Contract and integration: `<f> test:integration:http -- <path>` (`integration-tests/http/**`). They
  can't run in this checkout (plan section 2, item 3): write the cases; per task run lint and
  typecheck only. The finalization rule is in plan section 2, item 3.
- Lint `<f> lint`. Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend`. It
  fails today (baseline in `ai/architecture/verification.md`); no new errors in touched files.
- Migration (task 05 only): `<f> exec medusa db:generate company`; read the generated file.
- After editing `ai/architecture/*.md`: `pnpm ai:check --fix`, then `pnpm ai:check`.
- Shared wire values: environment `"DK" | "NO"` (`BusinessCentralEnvironment`, exported from
  `modules/business-central/types.ts`). Commits: `NIMBUS-261: <imperative>`.

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | BC connection per environment; every caller names its environment | `01-bc-connection-per-environment.md` | backend | R4, R6, R7, NF tokens per environment, NF config errors, NF NO-only failure | None | NIMBUS-262 | DONE |
| 02 | Country → environment rule and the BC account workflow | `02-environment-rule-and-account-workflow.md` | backend | R1, rule "NO → Norway", rule "environment from the stored company" | 01 | NIMBUS-263 | DONE |
| 03 | Store BC order and return reads routed per company | `03-store-bc-reads-routed.md` | backend | R2 (order history, returns, receipts, return reasons), NF store shapes unchanged | 02 | NIMBUS-264 | TODO |
| 04 | Return creation routed per company | `04-return-creation-routed.md` | backend | R2 (creating a return) | 02 | NIMBUS-265 | TODO |
| 05 | Company sync routed, NOK, and the not-found record | `05-company-sync-routed-not-found.md` | backend | R2 (company sync, every trigger), R3, R8, R9, R10, D2 | 02 | NIMBUS-266 | TODO |
| 06 | Admin routes: status, two-environment check, "Use this customer" | `06-admin-bc-customer-routes.md` | backend | R11 (data), R12, R13, R14 (server), R15 (verdict), D1, NF check errors, security rows | 05 | NIMBUS-267 | TODO |
| 07 | Admin "Business Central customer" section | `07-admin-bc-customer-section.md` | backend (Admin UI) | R11, R12, R13, R14, R15 (display and confirmation) | 06 | NIMBUS-268 | TODO |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| R5: `/store/business-central/operations` stays disabled | already done (always 404); untouched |
| R16: Admin may still edit `country` in the company form | already done; no change |
| Proposed structure 1: TestNO probe | done 2026-10-27 (`samples/probe-results-2026-10-27.md`); re-run after the extension reaches TestNO and before production go-live (plan section 10) |
| Proposed structure 9: pin order API, submission and shipment notices to DK | in task 01 (every caller passes `DK`), not a task of its own |
| Proposed structure 10: Medusa Cloud variables per stage | external: operations (plan section 10) |
| Proposed structure 10: `docs/architecture/` | `documentation-writer` after ship |
| Rollout check of companies moving to NO | external: Klaus Petersen before go-live |
