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
