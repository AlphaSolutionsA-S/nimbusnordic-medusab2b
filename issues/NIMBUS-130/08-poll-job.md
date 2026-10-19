# 08: Polling job
**App:** backend · **Layer:** L4 (orchestration workflow), L7 (`jobs/`) · **Depends on:** 06, 07

**Goal:** Plan flow E. An every-minute job takes the single-run lock and runs one orchestration
workflow (discovery, then checks, via `runAsStep`) within a 4-minute deadline. It logs the run summary
and the stalled-progress warnings.
**Files / areas:** `apps/backend/src/jobs/`; `apps/backend/src/workflows/shipment-notice/workflows/`.
**Seam contracts:**
- Schedule `* * * * *`.
- Lock key `shipment-notice-poll`, TTL 600 s, per-run `ownerId`; try once and skip if held; release
  in `finally`.
- Runs are skipped while `bc_backoff_until` is in the future.
- Summary log fields: duration, headers, matched, checked, recorded, unchanged, conflicts, errors,
  lead and trail lag, backlog due, oldest due age.
- A warning when the lead lag or the oldest due age is over 60 minutes.
**Test intent:**
- Unit (job): lock held → workflow not run; lock released after a failing run.
- Integration: one run with a stubbed BC → summary values match the work done; a lead lag over 60
  minutes → a warning line.
- Integration: during a throttling back-off the run makes no BC call.
**Done when:** job registered; tests written; lint and typecheck at or below the baseline.
**Verify after deploy:** one summary log line per minute in Medusa Cloud runtime logs, with lag under
20 minutes.
**Also update:**
- `ai/architecture/layers.md` (L7 row: `jobs/` "none yet");
- `ai/skills/medusa-triggers/project.md` and `ai/skills/medusa-backend/project.md` ("no scheduled
  jobs");
- `apps/backend/src/jobs/README.md` if it says none exist.

## Deviations

- Added: the job file calls Medusa's `defineFileConfig({ isDisabled })` so it is not registered
  when `NODE_ENV=test`. Why: the in-memory scheduler otherwise fires it every minute inside every
  integration spec (verified: `workflow-engine-inmemory` 2.21.2 `schedule()`; job loader
  `@medusajs/framework` `jobs/job-loader.js` honours `isFileSkipped`), which would init poll state
  and hit the BC stubs mid-test in the discovery and check specs. Production is unaffected
  (`NODE_ENV=production`). Backed by the spec test "is not scheduled inside the test app", which
  fails with the guard removed (checked once).
- Shape: the back-off gate is a step (`prepare-shipment-poll`) inside the orchestration workflow,
  not a check in the job, so the job holds no domain branch. The run deadline is fixed in that step.
- Shape: checks run only when discovery completed. A throttled discovery must not be followed by
  BC calls, and an incomplete discovery means the deadline has passed (checks could start no BC
  request anyway). The backlog values are then `n/a` in the summary for that run.
- Open point (no change made): a discovery failure other than throttling rejects the run, so the
  checks do not run that minute; a persistent discovery error would starve the checks and suppress
  the summary and its warnings (only an error line is logged). Wrapping discovery to keep checks
  running needs a decision on how that failure should surface.
- The failure log line carries the error type only, not its message: a BC token failure's message
  can carry response text (as the check step already does).
- The summary omits `tracked` (not in the seam's field list); lags and ages are logged in minutes
  (`lead_lag_min`, `trail_lag_min`, `oldest_due_age_min`) to match the after-deploy check.
- "Also update": `ai/skills/medusa-backend/project.md` has no "no scheduled jobs" line and
  `apps/backend/src/jobs/README.md` does not say none exist: no change. `ai:check --fix`
  regenerated the Tier 0 block in `AGENTS.md` and `.github/copilot-instructions.md`; `ai:check`
  still reports the known AGENTS.md size problem (32,940 bytes, was 32,947).

## Done-when evidence

- Job registered: `apps/backend/src/jobs/poll-shipment-notices.ts` default export plus
  `config { name: "shipment-notice-poll", schedule: "* * * * *" }`; unit test "runs every minute"
  (`src/jobs/__tests__/poll-shipment-notices.unit.spec.ts`). Registration in a running app:
  not provable in this task (the test app disables it by design); verify after deploy.
- Lock held → workflow not run: unit "skips the run without running the workflow while another
  run holds the lock".
- Lock released after a failing run: unit "releases the lock after a failing run and logs no error
  message"; TTL 600 s: "holds the lock for 10 minutes during the run and releases it afterwards";
  per-run owner: "uses a new owner per run, so a run never releases another run's lock";
  integration "runs again once the previous run has released its lock".
- Summary values match the work done: integration "discovers and records a shipment in one run
  and logs what it did" (`integration-tests/http/shipment-notice/poll-shipment-notices.spec.ts`);
  format and fields: unit "summarises a run with every count, the lags and the backlog"
  (`src/workflows/shipment-notice/__tests__/shipment-poll.unit.spec.ts`).
- Lead lag over 60 minutes → warning: integration "warns when the lead scan ends the run more than
  60 minutes behind"; oldest due age and the 60-minute boundary: unit "warns when the oldest due
  check has waited more than 60 minutes", "does not warn at exactly 60 minutes".
- No BC call during a back-off: integration "makes no BC call while a throttling back-off is in
  force"; unit `isShipmentPollBackedOff` cases.
- Four-minute deadline: unit "ends the run's BC work four minutes after it starts".
- Lint: 0 errors (13 pre-existing warnings, none in these files). Typecheck: 22 errors, baseline
  22, none in these files.
- Also update `ai/architecture/layers.md`: L7 row now `jobs/*.ts` (AGENTS.md and
  copilot-instructions regenerated by `ai:check --fix`).
- Also update `ai/skills/medusa-triggers/project.md`: canonical job and the test-disable pattern
  replace "No scheduled jobs exist yet".
- Also update `ai/skills/medusa-backend/project.md`: no change needed (no such statement).
- Also update `apps/backend/src/jobs/README.md`: no change needed (Medusa's generic README).
