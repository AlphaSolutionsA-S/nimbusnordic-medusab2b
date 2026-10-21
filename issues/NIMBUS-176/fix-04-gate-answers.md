# Fix brief 04: gate answers 2 and 3

**Apps:** Backend (file move), Storefront · **From:** the human's gate answers in `deviation-report.md`, 2026-10-21

## Answer 2: move the planner's Region Query probe out of the backend build

`apps/backend/scripts/verify-region-query.ts` is untracked, has 3 strictNullChecks errors and breaks a
local `medusa build` while present. Move it unchanged to `issues/NIMBUS-176/samples/verify-region-query.ts`
(next to `region-query-verification.json`, which records its user-executed output), so it is kept as
evidence and no longer compiled. Remove the then-empty `apps/backend/scripts/` folder. Do not edit the
file's content. Do not edit `PLAN.md` (frozen design record; its path reference stays historical). If
the samples JSON names the old path as the command that was run, leave it: it records what was run.

## Answer 3: rethrow Next.js control-flow errors in the country-language loader

In `apps/storefront/src/lib/data/country-languages.ts`, the `catch` around the publication read swallows
Next's dynamic-usage error during `next build` static generation (`DynamicServerError`, thrown by a
`no-store` fetch; see `deviation-report.md` Findings 1), logs `status: null` and returns the legacy
snapshot. Call `unstable_rethrow(error)` (from `next/navigation`; verify the export and behaviour in the
installed `next` package) at the top of that `catch`, so Next's control-flow errors propagate and only
real read failures fall back. Test intent: a Next dynamic-usage / control-flow error from the read is
rethrown, not turned into the legacy fallback, and is not logged as a load failure; an ordinary read
failure still falls back as before (existing tests). Mock at the transport boundary as the existing
loader tests do; do not read source text.

Also update anything that describes the build-time `load failed { status: null }` behaviour as expected
(branch-notes, docs) if it exists.

## Constraints

- Never touch `.vscode/mcp.json` or the manifest. Do not commit.
- Typecheck baselines: backend 22 (the probe's 3 errors disappear after the move), storefront 8.
- Run the scoped storefront loader tests, storefront lint and typecheck, backend typecheck, and
  `pnpm --filter @b2b-starter/backend build` (should now pass without moving anything aside).
  For a storefront build a backend must be running on :9000; skip the storefront build and say so.
- Append `## Deviations` and `## Done-when evidence`; return `### Files touched` and results.

## Deviations

- Added a test assertion the intent did not name: after a rethrown control-flow error no 10 s
  back-off is set (the next request reads the backend again), because the rethrow sits before the
  `retryAt` assignment and a back-off would otherwise hide real data for 10 s.
- The rethrow test uses Next's real `DynamicServerError` class instead of a hand-made look-alike, so
  it fails if Next's detection changes.
- Storefront build skipped: it needs a backend on :9000 and none is running.
- No doc or branch note described the build-time `load failed { status: null }` as expected
  (searched `docs/`, `branch-notes.md`, task files); `deviation-report.md` Findings 1 records the
  defect itself and was left as the review record.

## Done-when evidence

- Probe moved unchanged and no longer compiled: `issues/NIMBUS-176/samples/verify-region-query.ts`
  (plain `mv`, content untouched); `apps/backend/scripts/` removed; backend `tsc --noEmit` 22 errors
  (baseline 22, the probe's 3 gone); `pnpm --filter @b2b-starter/backend build` exits 0 with nothing
  moved aside.
- `PLAN.md` and `samples/region-query-verification.json` untouched (its `command` keeps the old path).
- Control-flow error rethrown, not logged, not a fallback:
  `apps/storefront/src/__tests__/lib/data/country-languages.test.ts` "rethrows Next's dynamic-usage
  error instead of falling back, logging or backing off" (red before the change, green after).
- Ordinary read failures still fall back: the existing tests in the same file ("serves the last good
  publication as stale after a failed refresh", "uses the approved legacy map on a cold outage…",
  "times out a hung read and falls back", "rejects … without caching it") all pass, 22/22.
- Also update: no doc describes the build-time `status: null` log as expected; `branch-notes.md`
  gained a Fix 04 section.
