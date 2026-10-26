# Manifest: Order detail shows the size of every item line

**Key:** NIMBUS-255
**Issue:** NIMBUS-255
**Branch:** feature/NIMBUS-255 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

- Backend (`@b2b-starter/backend`): scoped test `pnpm --filter @b2b-starter/backend test:unit -- <path>`;
  lint `pnpm --filter @b2b-starter/backend lint`; typecheck `apps/backend/node_modules/.bin/tsc --noEmit`
  (from `apps/backend`; at or below the baseline in `ai/architecture/verification.md`).
- Storefront (`@b2b-starter/storefront`): scoped test `pnpm --filter @b2b-starter/storefront test -- <path>`;
  lint `pnpm --filter @b2b-starter/storefront lint`; typecheck `pnpm --filter @b2b-starter/storefront exec tsc --noEmit`.
- Tests: backend `src/modules/business-central/__tests__/`; storefront `src/__tests__/` mirroring `lib/` and `modules/`.
- Locale files: `apps/storefront/messages/{da,de,en,fr,it,no,pl,sv}.json` (import material for the DB translations).
- No migrations, no new modules.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Backend: variant code on BC order detail lines | `01-backend-variant-code.md` | backend | F1 (data), F6, NF no extra call | None | NIMBUS-256 | DONE |
| 02 | Storefront: size field and description rule on order detail and return table | `02-storefront-size-display.md` | storefront | F1 (display), F2, F3, F4, F5, NF translation key | 01 | NIMBUS-257 | DONE |

## Scope items with no task

| Scope item | Reason (already done / external / not needed) |
|---|---|
| NF: return request unchanged | not needed: no change; protected by task 02's test intent |
| NF: import the key into the DB translations before release | external: release step via the Admin Translations page (Verify after deploy, task 02) |
| Dependency: production BC returns the variant on invoice lines | external: after-deploy check (task 01) |
