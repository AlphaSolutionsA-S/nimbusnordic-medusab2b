# Fix M1: propagate the polling deadline across BC requests

Implement the mechanical finding M1 in `deviation-report.md`. Own only shipment adapter deadline
handling, its workflow callers and meaningful tests/evidence. Preserve unrelated work.

## Required behavior

- Carry the absolute run deadline through shipment count, header and by-number reads to every
  token, data and nextLink dispatch. No new BC HTTP request starts once it expires.
- A request started before expiry may finish; a complete final page/window may commit afterward.
- If paging is incomplete, leave the window cursor unchanged. A later run must retry it and advance
  only after complete data is available.
- Deadline expiry is a normal incomplete outcome, not a BC failure or throttling event. Leave
  unread check rows due without changing attempts/error state or setting BC backoff.
- Keep whole-window/tied timestamp pagination, existing timeout limits, token caching and throttle
  behavior. Do not alter the separately recorded D1 discovery-failure design decision.

## Verification

Write behavior tests first for expiry between nextLink pages, expiry during token acquisition
before data dispatch, incomplete discovery cursor preservation and later successful retry, unread
checks, and a final pre-deadline request finishing successfully afterward. Run affected adapter and
shipment workflow tests, lint and typecheck against the precisely documented 22-error baseline.
Do not change unrelated baseline fixtures or timeout settings. Production build will run after fix.

## Evidence and handover

Record deviations and done-when evidence here, append branch notes and PROGRESS, and return the exact
files touched. Scratchpad: `.tmp/NIMBUS-130-20261019-resume/`. No commits or tracker changes.

## Deviations

- Added adapter coverage for expiry before the first token request and between by-number chunks;
  both are additional dispatch boundaries required by the same absolute deadline.
- The final complete-page adapter test already passed before implementation because completion
  after expiry was permitted; it remains a regression guard alongside the seven initially failing
  deadline cases (`deadline-red-unit-finite.log`: 7 failed, 20 passed).
- The original affected HTTP run stalled overnight in runner hooks and has no final summary.
  Its cause remains unproven. A fresh scoped run passed with the original timeouts and unchanged
  fixtures; no code or clock-spy workaround was needed. Installed runner-drain evidence and
  process/database observations are in scratch `deadline-resume-audit.md`.

## Done-when evidence

- Absolute deadline reaches token/data/nextLink dispatches: `shipment-reads.unit.spec.ts`,
  `starts no token request for an expired %s read`, `does not dispatch data when token renewal
  crosses the deadline`, `discards incomplete %s paging at the deadline`, and `does not start
  another by-number chunk after the deadline`. The optional `deadlineMs` parameter is passed by
  both workflow callers through all three service read methods to the dispatch checks.
- Complete work may finish after expiry: adapter `returns a complete final page whose request
  finishes after the deadline`; discovery `commits a complete final window returned after the
  deadline`; checks `records a complete check returned after the request deadline`.
- Incomplete discovery does not advance either cursor and later retries successfully: discovery
  `preserves an incomplete expired window and retries it successfully`, against the real local DB.
- Unread checks remain due with no failure/throttle: checks `leaves unread expired checks due
  with their previous error and attempts`, asserting unchanged schedule/attempts/error, zero
  recorded notices, zero errors and null BC backoff.
- Existing whole-window/tie, token-cache, timeout, throttle and scheduling behavior: adapter unit
  27/27 and affected module 48/48 passed (`deadline-green-unit.log`, `deadline-green-modules.log`).
  Fresh workflow HTTP 31/31 across three suites passed, exit 0, with existing timeouts
  (`deadline-green-http-resume.log`). Synthetic JWT was set before Jest configuration loading;
  BC reads were mocked, with no live BC verification.
- Lint: zero errors, 13 existing warnings (`deadline-lint.log`). `ai:check` passed
  (`deadline-ai-check.log`); the existing root AGENTS.md LF normalization belongs to dispatcher.
- Fresh whole-backend typecheck exits 2 with the same 22 baseline diagnostics, zero differences
  in path/position/TS-code/primary-message after normalizing only the `apps/backend/` path prefix
  (`deadline-typecheck-resume.log` versus `typecheck-baseline.log`). No suppression or unrelated
  fixture changes. Full suites were already run at finalization and were not repeated for M1.
- Production backend/Admin build after M1 passed, exit 0 (`deadline-build.log`), including the
  existing lint gate with zero errors and 13 warnings. `git diff --check` passed.
- Also update: no additional runtime documentation, registry rule, API contract or UI text changed.
  `branch-notes.md` records the deadline parameter and normal incomplete outcome for subsequent
  reviewers. D1 remains a separate human design decision. Deployment behavior is not verified.
