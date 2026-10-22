# 04: Lint on the ESLint CLI with a flat config
**App:** storefront · **Layer:** tooling · **Depends on:** 01

**Goal:** `<f> lint` runs the ESLint CLI over `src` with `eslint.config.mjs`, because Next.js 16
removed `next lint`. The `ui-text-translated` guard keeps working. The React Compiler findings
that predate the rules go into an `eslint-suppressions.json` baseline, and the rules stay at error
(plan decision 2, Klaus, 2026-10-22).
**Files / areas:** `apps/storefront/eslint.config.mjs` (new), `.eslintrc.js` (removed),
`package.json` (`lint` script `eslint src`, `eslint` devDependency `^9.24.0`),
`eslint-suppressions.json` (new).
**Seam contracts:** none.
**Test intent:**
- Config check, not a Jest test (ESLint loads ESM config, which Jest cannot): `eslint --print-config`
  on a file under `src/modules` and one under `src/app` shows `react/jsx-no-literals` at warn with
  today's options. On a file under `src/__tests__` the rule is off.
- The first `<f> lint` run exits 0, the suppression file lists only the
  `react-hooks` compiler-rule findings, and a new violation of one of those rules (tried in a
  scratch file, not committed) fails the run.
**Done when:** `<f> lint` exits 0 with no environment variables set. The warnings are the two
`exhaustive-deps` from today plus any new warn-level ones, each listed in the task's deviations.
**Also update:** `ai/architecture/verification.md` Baseline (one line naming the storefront
`eslint-suppressions.json`), then `pnpm ai:check --fix`. Register a follow-up Jira issue (component
Customer Portal) to clear the suppressions, and record its key in the task's deviations.

## Deviations
- New warn-level finding: `@next/next/no-location-assign-relative-destination` in
  `src/modules/layout/components/region-switcher/index.tsx:34` (a rule new in
  `@next/eslint-plugin-next` 16; pre-existing code). It and the two `exhaustive-deps`
  (`lib/context/cart-context.tsx:192`, `modules/cart/components/cart-drawer/index.tsx:108`) are the
  3 warnings. Warnings are not suppressible and do not fail the run.
- Suppressions were written with `--suppress-rule` for the four compiler rules
  (`set-state-in-effect` 18, `refs` 2, `immutability` 2, `error-boundaries` 1: 23 findings in 15
  files), not `--suppress-all`, so the file can only ever hold those rules. No finding is in code
  this branch wrote.
- `react/jsx-no-literals` reports 0 warnings today (as `next lint` did), so the guard is shown by
  `--print-config`, not by a live finding.
- The `ai/architecture/verification.md` line is shorter than a full sentence ("Storefront lint:
  `apps/storefront/eslint-suppressions.json`."): the longer wording pushed generated `AGENTS.md`
  past the 32768-byte Codex limit that `ai:check` enforces.
- `pnpm-lock.yaml`: besides the `eslint` specifier, `pnpm install --lockfile-only` added the
  registry's `deprecated` note to `eslint@9.39.4` (metadata only; the resolved version is unchanged).
- Follow-up issue to clear the suppressions: NIMBUS-215 (component Customer Portal).

## Done-when evidence
- `<f> lint` exits 0 with no environment variables set: `corepack pnpm --filter @b2b-starter/storefront lint`
  with `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` unset, exit 0, "3 problems (0 errors, 3 warnings)".
- Warnings are the two `exhaustive-deps` plus new warn-level ones, listed: see Deviations (one new
  rule, one finding).
- `jsx-no-literals` at warn with today's options on `src/modules` and `src/app`, off in tests:
  `eslint --print-config` on `src/modules/cart/components/add-note-button/index.tsx` and
  `src/app/not-found.tsx` shows `[1, {noStrings:false, ignoreProps:true, allowedStrings:[...23 entries]}]`;
  on `src/__tests__/app/account-dashboard-layout.test.tsx` the rule is absent (off).
- Suppression file lists only `react-hooks` compiler-rule findings: `apps/storefront/eslint-suppressions.json`
  holds only `react-hooks/{set-state-in-effect,refs,immutability,error-boundaries}`.
- A new violation fails the run: scratch `src/modules/zz-scratch-lint.tsx` with `setState` in an
  effect made `<f> lint` exit 1 with `react-hooks/set-state-in-effect` error; file deleted.
- Also update `ai/architecture/verification.md` Baseline: one line added; `pnpm ai:check --fix`
  regenerated `AGENTS.md` and `.github/copilot-instructions.md`, `pnpm ai:check` passes.
- Also update Jira follow-up: NIMBUS-215 created.
