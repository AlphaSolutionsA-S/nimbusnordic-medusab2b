# Manifest: Translated password-reset and employee-invitation emails

**Key:** NIMBUS-162 (with NIMBUS-242)
**Issue:** NIMBUS-162; NIMBUS-242 (tasks 04–06)
**Branch:** feature/NIMBUS-162 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

From `ai/AGENTS.md`; run from the repo root, one at a time.

- Backend (`@b2b-starter/backend`): scoped `pnpm --filter @b2b-starter/backend test:unit -- <path>`;
  HTTP specs `pnpm test:integration:http` (local Postgres, finalization); lint
  `pnpm --filter @b2b-starter/backend lint`; typecheck `apps/backend/node_modules/.bin/tsc --noEmit`
  (at or below baseline). Unit tests in `src/**/__tests__/*.unit.spec.ts`; HTTP specs in
  `apps/backend/integration-tests/http/<area>/`.
- Storefront (`@b2b-starter/storefront`): `pnpm --filter @b2b-starter/storefront test -- <path>`,
  `lint`, `exec tsc --noEmit`. Tests in `src/__tests__/**`.
- Shared: new workflow domain `apps/backend/src/workflows/transactional-email/{utils,steps}`; Tier 0
  edits in `ai/architecture/decisions.md` are followed by `pnpm ai:check --fix`.
- Import files `apps/storefront/messages/*.json` (8 languages) gain the `Emails` namespace; they are
  import material, never a runtime source. No migrations, no `medusa-config.ts` change.

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Email-language rule | `01-email-language-rule.md` | backend | 162 F1, F2 (rule), R2–R4, R6 | None | NIMBUS-244 | DONE |
| 02 | Email text rule and escaping | `02-email-text-rule.md` | backend | 162 F4, F5, NF escaping, R8–R10 | None | NIMBUS-245 | TODO |
| 03 | Reset email on the translated mechanism | `03-translated-reset-email.md` | backend, import files | 162 F1, F3, F6–F9, R3, R4, R14, R15 | 01, 02 | NIMBUS-246 | TODO |
| 04 | Invitation trigger and store request country | `04-invitation-trigger.md` | backend | 242 R5, R7; AC "failed email does not undo" | None | NIMBUS-247 | TODO |
| 05 | Invitation email | `05-invitation-email.md` | backend, import files | 162 F2; 242 R6, R13, R15, all AC | 03, 04 | NIMBUS-248 | TODO |
| 06 | Storefront invite card sends the page country | `06-storefront-invite-country.md` | storefront | 242 R5; AC "invite form unchanged" | 04 | NIMBUS-249 | TODO |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| Scope task 4 "Verification and documentation" | Spread over the tasks: each task's tests and its "Also update" docs lines |
| F8 / R14 delivery through Medusa Emails on Cloud | Already in place (Klaus Petersen); confirmed after deploy only |
| Release import of the `Emails` keys per environment | Release step, not code (plan section 10) |
| NIMBUS-243 (store route links any companyless `customer_id`) | Separate bug; not fixed or built on here |
