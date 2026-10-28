# Fix brief 01: HTTP integration failures at finalization

**Key:** NIMBUS-261 · **Branch:** `feature/NIMBUS-261` · **Merge-base:** `811de63` (develop)

## What happened

The full backend HTTP integration suite ran at finalization against a throwaway Postgres
(container `nimbus261-scratch-pg`, `localhost:55433`; see "How to run"). Result: 22 suites,
9 failed; 467 tests, 123 failed, 344 passed. Full output:
`<run folder>/final-http.txt`.

Failing suites:

- `integration-tests/http/admin/shipment-tracking.spec.ts` (not in the baseline)
- `integration-tests/http/companies/employee-invitation.spec.ts` (not in the baseline)
- Baseline suites (NIMBUS-236, Admin login answers 401; `ai/architecture/verification.md`):
  `admin/bc-integration`, `quotes/quotes`, `admin/quotes/quotes`, `security/password-recovery`,
  `translations/translations`, `security/security-boundaries`, `companies/companies`.

Known cause for one: task 01 made the environment the first argument of every BC module method, and
`admin/shipment-tracking.spec.ts` still expects the BC shipment read without it (it receives
`"DK", [...]`). Task 01's "Also update" missed it.

## What to do

1. Fix `admin/shipment-tracking.spec.ts` so it expects the `"DK"` first argument (the shipment
   flow stays on DK permanently). Fix the assertion; never delete a test to pass.
2. For every other failing case, decide whether this branch caused it. Compare with develop at the
   merge-base: run the same failing suites in a separate git worktree checked out at `811de63`
   (e.g. `git worktree add <run folder>/wt-develop 811de63`; install nothing new, reuse
   `node_modules` by running jest from the main checkout's binaries only if that works, otherwise
   report that the comparison could not run). Remove the worktree afterwards.
   - A case failing only with 401 on an Admin login/request is NIMBUS-236: leave it, list it.
   - A case that fails the same way on develop is pre-existing: leave it, list it with its cause
     (e.g. `employee-invitation.spec.ts`: "Timeout waiting for event employee.invited",
     "Trying to query by not existing property Employee.customer_id").
   - A case that passes on develop and fails on this branch is caused by this branch: fix it.
3. Re-run each touched or branch-caused suite and report pass/fail per suite.

## How to run (never reach Business Central)

From `apps/backend`, with `.env` untouched and these shell overrides (shell values win over dotenv):

```
export DB_HOST=localhost DB_PORT=55433 DB_USERNAME=admin DB_PASSWORD=scratchpw
export DATABASE_URL=postgres://admin:scratchpw@localhost:55433/nimbus-medusa-dev
export BUSINESS_CENTRAL_DISCOVERY_URL=<TestDK URL from apps/backend/.env.template>
export BUSINESS_CENTRAL_CLIENT_ID= BUSINESS_CENTRAL_CLIENT_SECRET=
TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules npx jest --silent=false \
  --runInBand --forceExit --testPathIgnorePatterns '[\/]\.medusa[\/]' --testPathPattern <spec>
```

Use `localhost`, not `127.0.0.1` (other hosts switch on SSL and hang). The run folder has a
runner script, `run-http-06.sh`.

## Report

`### Files touched`, then per failing case: branch-caused (fixed) / pre-existing on develop / 401
only (NIMBUS-236), with the evidence. Lint and typecheck (baseline 22) after any change.

## Deviations

- The develop worktree had to be created with `git -c core.longpaths=true` (the run folder path
  is too long for the default). It reused the main checkout's `node_modules` through two directory
  junctions (repo root and `apps/backend`) and a temporary copy of `apps/backend/.env`; nothing was
  installed. Junctions, `.env` copy and worktree were removed afterwards.
- Both comparison runs and the guarded re-run preloaded `<run folder>/block-bc-fetch.js`
  (`run-http-develop.sh`, `run-http-fix01.sh`); `blocked-bc.log` stayed empty, so no run tried to
  reach Business Central.
- No branch-caused failure besides `admin/shipment-tracking.spec.ts` was found, so no other code or
  test changed.

## Done-when evidence

- Step 1: `apps/backend/integration-tests/http/admin/shipment-tracking.spec.ts` line 197 now expects
  `("DK", [row.shipment_number], expect.any(Number))`; suite PASS 9/9 (`<run folder>/fix01-shipment-tracking.txt`,
  and again with the BC guard in `fix01-shipment-tracking-guarded.txt`).
- Step 2: the 8 other failing suites ran on develop `811de63` (`<run folder>/develop-http.txt`: 8
  suites failed, 101 failed / 132 passed). Failing-case sets compared by suite, title and first error
  line (ids normalised) in `cmp-branch.txt` vs `cmp-develop.txt`: every branch failure also fails on
  develop with the same error, except 21 `companies.spec.ts` cases added on this branch, which all
  fail with 401 on the Admin request (NIMBUS-236).
- Step 3: the only touched suite (`admin/shipment-tracking`) passes; no branch-caused suite remains.
- Lint: `medusa lint` 0 errors, 13 warnings (same as finalization). Typecheck: 22 errors (baseline 22).
- Also update: none (a test-only change).
