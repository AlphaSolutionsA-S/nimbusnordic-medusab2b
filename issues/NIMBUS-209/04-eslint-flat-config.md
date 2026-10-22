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
