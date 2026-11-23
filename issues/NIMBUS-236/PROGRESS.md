# Progress

## 2026-10-24 — registered

- Outcome: Klaus approved registering it at the NIMBUS-180 gate. Bug NIMBUS-236 created (component
  `Customer Portal`, parent NIMBUS-206 "bugs"); `bug.md` written from the NIMBUS-180 dispatch
  evidence. Not reproduced separately; cause not investigated.
- Proposed flow: `quick-fix` (a test-environment bug with a concrete symptom, one app), unless the
  cause turns out to be in authentication code, which would need the full pipeline.
- Next owner: Klaus (go-ahead to start).
- Handover prompt: "Start quick-fix on NIMBUS-236 from issues/NIMBUS-236/bug.md: reproduce the 401
  login failures in the local HTTP integration tests on develop and find the cause."

## 2026-10-26 — quick-fix: reproduced, cause found, awaiting confirmation

- Outcome: reproduced on develop f109b3a (full HTTP run: 8 suites, 89 failed, 272 passed). Cause is
  test setup, not auth code: `@medusajs/test-utils` evaluates `medusa-config.ts` before applying a
  suite's `env`, so `http.jwtSecret` takes the local `.env` value while the tests sign with
  `supersecret`. With `JWT_SECRET=supersecret` preset: 0 x 401, 10 failed, 351 passed (the 10 are
  other causes). Analysis and plan are in the quick-fix report (subagent could not write
  `analysis.md` or `task.md`). No code changed.
- Next owner: Klaus (confirm the plan and its decisions).
- Handover prompt: "Continue quick-fix on NIMBUS-236 with the confirmed plan: set the test JWT
  secret before the Medusa config loads (apps/backend/jest.config.js) and update the
  verification.md baseline."

## 2026-11-23 — quick-fix: implemented, committed locally

- Outcome: `apps/backend/jest.config.js` sets `JWT_SECRET=supersecret` before the env files load
  (test runs only; no auth or production config change). Full local `test:integration:http`
  (throwaway Docker Postgres, `--max-old-space-size=8192`): before 122 failed / 362 passed of 484,
  after 15 failed / 469 passed, none with 401. The 15 remaining failures, with their causes, are in
  `change-report.md`. Updated the `verification.md` baseline (mirrors regenerated) and
  `business-central-company-sync.md`. Review approved; unit tests and lint pass. Committed locally
  on `feature/NIMBUS-236`, not pushed. The analysis is in `change-report.md` (Summary, Tests),
  because the subagent harness refused `analysis.md`.
- Jira: commented "quick-fix started". The workflow has no in-progress transition from Scoping
  (only Closed, Park issue, Scope approved), so the status is unchanged and the issue unassigned.
- Next owner: Klaus. Decide on push or PR, the Jira status, the NIMBUS-261 stand-in unit specs, and
  whether to register the remaining failure causes as bugs.
- Handover prompt: "Review feature/NIMBUS-236 (issues/NIMBUS-236/change-report.md); decide push/PR,
  the Jira status, the NIMBUS-261 unit specs, and which remaining HTTP failures to register."

## 2026-11-23 — follow-up: email channel in tests, committed locally

- Outcome: at Klaus's request, `medusa-config.ts` gives `notification-local` the `email` channel for
  `NODE_ENV` `test` as well as `development`; production is unchanged (`feed`). Nothing relied on
  `feed`. Full local HTTP run: 10 failed, 474 passed of 484 (was 15 failed). The email-provider
  errors are gone. Three tests now fail on the email link origin: the suite's `STORE_CORS` is
  ignored by the same config-before-env mechanism. Test runs now log recipient addresses and reset
  URLs with tokens (synthetic data; development already did this). Baseline in `verification.md`
  updated and mirrors regenerated. Review approved. Committed as a second commit on
  `feature/NIMBUS-236`; not pushed.
- Next owner: Klaus. Decide whether to pin `STORE_CORS` in `jest.config.js`, check that Medusa Cloud
  has an email provider, and give the go-ahead for push or PR, plus the earlier open items.
- Handover prompt: "Review the email-channel follow-up in issues/NIMBUS-236/change-report.md;
  decide on pinning STORE_CORS for tests and check the deployed email provider."

## 2026-11-23 — follow-up 2: STORE_CORS pinned for tests, committed locally

- Outcome: Klaus approved it ("3 fix"). The branch was fast-forwarded to develop `8ed38da`.
  `jest.config.js` now pins `STORE_CORS=https://shop.example.test` next to `JWT_SECRET`. Both suites
  that set `STORE_CORS` use that value, and nothing else depends on it. Full local HTTP run:
  7 failed, 477 passed of 484 (was 10 failed). The three email link-address tests pass and nothing
  new fails. Baseline updated, mirrors regenerated, review approved. Committed on
  `feature/NIMBUS-236`; not pushed or merged.
- Next owner: Klaus. Give the go-ahead to push or merge. Decide which of the 7 remaining failure
  causes to register as bugs, and check that Medusa Cloud has an email provider.
- Handover prompt: "Review follow-up 2 in issues/NIMBUS-236/change-report.md; push or merge
  feature/NIMBUS-236 and decide on the 7 remaining HTTP failures."
