# NIMBUS-133 consolidation evidence

Date: 2026-10-23. Compared with merge-base `a76afc7b33d63d5a298410e29fc9879079223877`.

## Consolidation

- Added one integration case for the previously uncovered public request → core event → registered project subscriber → persisted successful Notification → usable reset proof → ordinary login chain. The existing direct-workflow test cannot detect a missing subscriber registration.
- Mutation check: temporarily disabled the subscriber's event registration. The new case failed with expected notification count 1, actual 0. Restored the original registration; the complete recovery HTTP suite then passed all 14 cases. No production change remains from the mutation.
- No duplicated helpers, dead exports or redundant tests warranted removal. Unit schema/notification checks cover trust-boundary inputs and content; real HTTP checks separately prove middleware ordering, core consumption and Notification wiring. Action/form tests cover UI behaviour rather than repeating those implementations.
- Application source additions: 349 lines across 11 TypeScript/TSX files, no source removals. Test additions: 516 lines across 7 files, 6 removed (net 510); added test/source ratio 1.48. Counts use `git diff --numstat` from the merge-base through the consolidation working tree, excluding documentation, case files and generated output. Eight translation import files add a separate 184 lines. The branch introduces 49 parameter-expanded test cases: 17 backend unit, 17 HTTP and 15 storefront; unrelated existing regression cases are excluded.

## Security-path accounting

Test paths below are relative to their app. `recovery HTTP` means backend `integration-tests/http/security/password-recovery.spec.ts`; `shared HTTP` means backend `integration-tests/http/security/security-boundaries.spec.ts`.

| Plan property | Named test and assertions | Remaining limit |
|---|---|---|
| Trust anchor / account binding | recovery HTTP `rejects %s proof without consuming the original` (expired, actor, account, provider, tampered); `refuses identity substitution without changing either account or consuming the proof` checks both accounts' unchanged credentials and valid retry | Signed wrong-account/actor claims are generated only with the synthetic test secret; production signing is unchanged |
| Replay / expiry / latest link | recovery HTTP `rejects sequential reuse and superseded links`; expiry case also checks `exp - iat = 900` | No concurrent single-winner promise; risk accepted |
| Cross-instance shared state | The same lifecycle cases use real PostgreSQL-backed core Auth state and validate sequential consumption/replacement | No multi-process restart/failover test; shared-store evidence is not a distributed race guarantee |
| Browser / CSRF / explicit proof | shared HTTP `refuses missing and ordinary login credentials on password recovery updates` checks absent proof, ordinary login token and GET refusal; recovery HTTP success requests use explicit reset Bearer proof without browser cookies; storefront action `completes using only the reset proof and password fields` | Actual browser navigation, other-browser execution and recovery-origin/CSRF behaviour are not exercised by these API/component tests |
| Logout / session creation | recovery HTTP `rejects invalid new credentials before consumption and permits valid retry` asserts success-only body and no session cookie; shared HTTP `preserves company membership and administrator role after password recovery` repeats those assertions and verifies original customer/company/role and foreign-company denial | Existing sessions follow core defaults; no forced-logout guarantee |
| Enumeration | recovery HTTP `acknowledges known and absent accounts equally without creating an identity` and `acknowledges provider failures without revealing account or provider details`; storefront action `does not expose provider failures or account details`; form `acknowledges a public request neutrally and links back to login` | Provider failure is injected into the real core Auth service; it does not simulate every provider/network outage |
| Password policy before consumption | recovery HTTP `rejects invalid new credentials before consumption and permits valid retry` covers short/mismatched/missing confirmation, unchanged old password, valid retry, old-password refusal and new-password login; backend `src/api/auth/__tests__/customer-recovery.unit.spec.ts` covers schema boundary values | No duplicated frontend policy added |
| Personal data / safe failures | recovery HTTP invalid-credential assertions refuse echoing submitted passwords; storefront action `maps backend status %s without returning credentials` maps 400/401/500 to safe keys; backend `src/workflows/customer/utils/__tests__/password-reset-notification.unit.spec.ts` checks trusted destination, rejected unsafe configuration and English content without recipient interpolation | No runtime logger-capture assertion; static diff inspection found no new password logger. Existing token persistence/logging remains accepted |
| Notification delivery wiring | recovery HTTP `dispatches a usable reset link through the registered subscriber after a public request` proves the real core event/subscriber/Notification chain, provider success, configured origin, country metadata propagation, usable link and new-password login; direct-workflow test separately rejects non-customer dispatch | Existing local provider success proves dispatch, not inbox delivery |
| Existing authenticated password change | shared HTTP `keeps signed-in password changes dependent on the current password` checks missing auth, incorrect old password, valid update and old/new login outcomes | Deployed UI/password manager interaction not exercised |

## Verification results and limits

Consolidation checks:

- RED: subscriber-registration mutation failed precisely on missing persisted notification (1 failed, 13 skipped). GREEN: all 14 recovery HTTP cases passed against disposable PostgreSQL. Logs: ignored `.tmp/NIMBUS-133-20261023-implementation/consolidation-event-{red,green}.log`.
- Backend lint: 0 errors, 13 existing warnings. Initial sandbox CLI startup failed; the existing approved escalation allowed Medusa configuration access and lint completed. Whole-backend typecheck remains 22 diagnostics, matching baseline; none in the modified recovery spec. Logs: `consolidation-lint-final.log`, `consolidation-tsc.log` in the same ignored folder.

Dispatcher finalization evidence, inspected rather than repeated:

- Backend unit: 65 suites / 759 tests pass. The configured glob also discovers generated `.medusa/server` copies, so this is not a count of unique source tests.
- Backend build: source and Admin report success (21.18s / 61.93s); PowerShell's wrapper reports a nonzero status from stderr despite the successful Medusa build messages.
- Backend full HTTP: incomplete run, terminated after stalled cleanup. The final log contains five passing suites and three failing suites: existing store/admin quotes plus shared security's existing Admin CORS preflight case because `ADMIN_CORS` was empty. No aggregate summary was produced. The focused recovery/security checks passed separately; do not report a successful full HTTP suite. Consolidation's focused run sets synthetic Admin CORS and does not change repository configuration.
- Storefront: full Jest run 175 passing / 3 failing suites and 573 passing / 3 failing tests. Failures are the recorded money/profile-page/main-layout baseline. Typecheck remains 58 diagnostics. Existing `next lint`/ESLint incompatibility blocks configured lint.
- Storefront build: failed on the existing account parallel-route tree under installed Next 16.4.2 (manifest 15.5.28). Read-only comparison confirms the failing `account/@dashboard`/`account/@login` paths already exist at merge-base and are unchanged by this branch; this supports existing route/config incompatibility but is not a baseline build reproduction. No dependency repair or second full build attempted.
- Browser check: not run; no seeded running backend, published DB translations or current successful storefront build. Import the supplied translation keys into each environment before release.
- Deployment evidence remains outstanding: a controlled mailbox receives the email; public country pages render published translations; reset changes the intended account; sequential replay fails; old password fails and new password logs in normally. No inbox delivery or deployed credential/session outcome is claimed.

Next owner: integration-reviewer for whole-branch review and the deviation report, then the dispatcher for the concrete human gate. No commit, push or tracker operation performed by consolidation.
