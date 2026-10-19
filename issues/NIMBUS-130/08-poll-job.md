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
