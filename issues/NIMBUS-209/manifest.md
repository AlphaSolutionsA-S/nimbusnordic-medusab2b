# Manifest: Upgrade the storefront to Next.js 16

**Key:** NIMBUS-209
**Issue:** NIMBUS-209
**Branch:** feature/NIMBUS-209 (from develop)
**Ready for Dispatch:** true

## Conventions and commands

Storefront only, `<f>` = `pnpm --filter @b2b-starter/storefront`, from the repo root.
- Scoped tests: `<f> test -- <path>` (Jest via `next/jest`, tests in `src/__tests__/**` mirroring `app/`, `lib/`, `modules/`).
- Lint: `<f> lint` (`next lint` until task 04, ESLint CLI afterwards).
- Typecheck: `<f> exec tsc --noEmit`, at or below the baseline task 01 records first. Build: `<f> build`.
- Visual: `<f> test:visual` (needs a running seeded backend), at finalization only.
- Lockfile: root `pnpm-lock.yaml`; the CMS keeps `next` 16.3.3.
- `next lint` and `next build` load `next.config.js`, which requires `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (any value works locally).

## Tasks
| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | Next.js 16 dependencies and a passing build | `01-nextjs-16-build.md` | storefront | F1, F2, F3 (account slots), N2, N3, N4, R4 (as changed by decision 1), R5 | None | NIMBUS-211 | DONE |
| 02 | Checkout reads cartId from awaited search params | `02-checkout-search-params.md` | storefront | F3 (checkout approval flow) | 01 | NIMBUS-212 | DONE |
| 03 | Immediate cache invalidation on the Next.js 16 APIs | `03-cache-invalidation.md` | storefront | F4, F6, R1, R2, R3 | 01 | NIMBUS-213 | DONE |
| 04 | Lint on the ESLint CLI with a flat config | `04-eslint-flat-config.md` | storefront | F7, R7, N1 (lint) | 01 | NIMBUS-214 | DONE |

## Scope items with no task
| Scope item | Reason (already done / external / not needed) |
|---|---|
| N1 unit, visual and typecheck at or below baseline | Dispatcher finalization (full suite); each task runs its own tests |
| F5 CMS live preview, R6 only `NEXT_PUBLIC_*` in client bundles | Whole-branch pass and after-deploy check; no code changes |
| Scope task 4: Medusa Cloud build and smoke test of F3–F6 | External: the pull request's preview environment after push (answered); the after-deploy lines in the task files |
| Wrangler version (open question 1) | Answered: risk accepted, covered by the preview smoke test |
| `proxy.ts` rename | Out of scope: NIMBUS-210 |
