# Task 08: Cross-app verification and rollout

**Status:** TODO
**App:** backend + storefront
**App Roots:** apps/backend, apps/storefront
**Task ID:** 08
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 05, 07

## Scope

Verify the implemented feature; record evidence and a repeatable rollout. This
task does not authorize production deployment, live DB migration, or release
approval. Load definition-of-done and the relevant Medusa/secure-coding skills.
Load using-medusa-cloud only when executing Cloud operations; no values revealed.

## Existing infrastructure and commands

- Backend build/lint: `corepack pnpm --filter @b2b-starter/backend build` and lint.
- Backend unit/module/HTTP scripts use TEST_TYPE and experimental VM modules.
  Select new source tests explicitly or exclude `.medusa/server` duplicates.
  Keep `integration-tests/global-setup.ts` and its BC environment guard enabled.
- Admin UI tests: new `corepack pnpm --filter @b2b-starter/backend test:admin`.
- Storefront: `corepack pnpm --filter @b2b-starter/storefront test --runInBand`
  (use `pnpm exec jest` if the script argument parser rejects flags), lint, build,
  and `pnpm exec tsc --noEmit` from that app. A build is not a typecheck because
  `next.config.js` already sets ignoreBuildErrors.
- Existing storefront visual tooling is Playwright. Load the browser/Playwright
  skill when running UI checks. Do not rewrite unrelated snapshots to hide failures.

Capture a fresh baseline before implementation and compare by failing test/error,
not by failure count alone. Historical failures in docs/security-remediation.md
and NIMBUS-174 are pointers to investigate, not permanent waivers. Report failures
and affected coverage; do not silently expand this story into unrelated cleanup.

## New verification artifacts

Create `issues/NIMBUS-175/VALIDATION.md` during execution, with revision, date,
commands, results, failing cases, environment limitations, and manual evidence.
Create `issues/NIMBUS-175/ROLLOUT.md` during execution with the procedure below.
These documents are evidence/runbooks, so they need no application code skeleton.

Add automated production-mode HTTP/browser checks in the repository's existing
test harness where practical. At minimum record executable steps and outcomes for
the following cases; do not claim Next cache behavior from a mocked unit test.

### TC-1: First environment and normal editing

- **Given:** Fresh migrated backend without locale rows and an Admin login.
- **When:** Import all eight current source JSON files, inspect previews, activate,
  and visit dk/gb/se storefront paths; edit one value in Admin and refresh storefront.
- **Then:** Correct languages and updated values render without rebuilding;
  source JSON files remain unchanged, and new copied language starts inactive.

### TC-2: Optimistic conflicts and imports

- **Given:** Two Admin browser contexts loaded at the same locale version.
- **When:** First saves; second saves/imports/activates; then test confirmed replace
  with removals and an ICU warning.
- **Then:** Second gets409 with work retained; no silent merge or data loss;
  destructive import needs confirmation and ICU warnings allow an explicit save.

### TC-3: Warm/cold caches, invalidation, and multiple workers

- **Given:** Production storefront instances A/B and seeded backend.
- **When:** Warm A, perform a save callback then make backend reads fail; visit
  warmed A and cold B. Recover backend, lose one callback, exercise timed refresh,
  deactivate/reactivate, and deliver an old callback out of order.
- **Then:** Warm available snapshot is served; cold unavailable instance renders
  keys; no file/English fallback. Recovery and timed refresh work; confirmed
  inactive state is cached as a tombstone rather than serving an old active row
  forever. Record actual cross-worker latency and cold-start limitation.

### TC-4: Missing-key inbox and abuse controls

- **Given:** Missing server/client keys and a whole-locale outage.
- **When:** Render pages repeatedly, send bounded and abusive public batches,
  fill/dismiss entries, and race a late report with a fill.
- **Then:** Reports are deduplicated, path-safe and capacity-limited; no secrets
  in browser code or logs; filled entries stay cleared, dismissal stays effective,
  and outage creates one notice instead of a key flood. Rendering stays usable.

### TC-5: Metadata, 404, schema, and regression gates

- **Given:** All tests/builds and populated catalogs.
- **When:** Exercise root404, localized metadata, schema up/down/up on disposable
  PostgreSQL, Admin keyboard flows, and normal storefront checkout/navigation.
- **Then:** Locale and accessibility behavior remain intact; migration contains
  schema only; new tests/builds/lint pass; any broader failures are documented with
  evidence and explicitly unresolved coverage.

## Rollout procedure to document

1. Deploy backend code/schema/Admin; do not replace the storefront runtime yet.
2. Configure callback URL/REVALIDATE_SECRET and a separate TRANSLATION_REPORT_SECRET
   per environment. Verify HTTPS, proxy trust, replica/cache behavior, and secret
   rotation. Never use the template's example secret in a hosted environment.
3. Manually import and activate `da,de,en,fr,it,no,pl,sv` through Admin. English can
   be first for comparison; first-import functionality must work without it.
4. Verify all active store reads with the environment's publishable key and compare
   exported documents against import sources. Confirm a usable cache before testing
   failures. This is a manual import process, not an automatic seed/migration.
5. Deploy the storefront, smoke-test locale pages, metadata, root404, edit refresh,
   missing-key inbox, and callbacks. Check populated catalog build/static generation.
6. For future new keys, developers update import files and coordinate the Admin
   merge before releasing code that uses those keys. For new languages, create and
   activate in every environment, then update country-language-map/formatting-locale
   in code and deploy. Country mapping remains outside this Admin feature.
7. Rollback: restore the previous storefront release first if runtime loading is
   faulty; it may use its previously bundled files as a whole-release rollback,
   never as a new runtime fallback. Keep additive backend tables/data. Export
   translations before any destructive migration; do not drop them during routine
   rollback or erase unrelated language work.

Append actual outcomes and the next owner to PROGRESS.md. Mark tasks complete only
with evidence; get review/CI and release approval separately. Do not transition the
Jira Story to Done merely because this planning or validation document exists.
