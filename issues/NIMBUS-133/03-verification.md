# 03: Verification and documentation
**App:** backend/storefront · **Layer:** Integration, browser, docs · **Depends on:** 01, 02
**Goal:** Prove cross-app recovery and document current behaviour and remaining delivery checks.
**Files / areas:** backend integration-tests/http/security/security-boundaries.spec.ts; storefront account tests/e2e; docs/architecture/store-access.md; ai/architecture/decisions.md; deviation report.
**Seam contracts:** Exercise 01/02 public contracts; no new endpoint/storage design.
**Test intent:**
- Real HTTP/PostgreSQL valid/expired/used/superseded proof, wrong actor/account/provider, old password refused/new password authenticates.
- No automatic login or company/role mutation; no forced-logout promise.
- Cross-app neutral acknowledgement and invalid-link recovery; preserve login/password-change regressions.
- Exclude concurrent winner guarantees and token-log hardening explicitly accepted by Klaus.
**Done when:** Required suite/build/lint/typechecks complete against baseline; missing environment/failures recorded.
**Verify after deploy:** Controlled mailbox/account delivery, reset, sequential replay refusal, old/new login and published UI keys.
**Also update:** Current architecture/rule registry, existing affected security/account tests, final deviation report; no shipped case retrofit.

## Deviations
- Added two real PostgreSQL security regressions for unchanged company membership/role and the separate signed-in password-change flow, plus a wrong-account proof case. These supplement the lifecycle and component/action coverage from tasks 01/02; no production code change was needed, so this regression-only task has no missing-implementation red phase.
- Browser smoke remains unverified: the existing Playwright configuration needs a running seeded backend, database-published translations and a current storefront production build. Only the disposable HTTP-test database is available; the local storefront build predates recovery. No mock browser stack, seed infrastructure or repeated build was introduced.
- Full suites and builds are deferred to dispatcher finalization, which owns the once-per-branch run. Storefront lint remains blocked by the previously recorded CLI/ESLint configuration baseline; no storefront source changed here.
- The integration-reviewer owns the final deviation report. This worker records its evidence here and does not write that report.

## Done-when evidence
- Valid/expired/used/superseded/wrong actor/account/provider proof, password replacement and neutral acknowledgement: real PostgreSQL `password-recovery.spec.ts` lifecycle cases from task 01, supplemented by `rejects account proof without consuming the original` (1 passed, 12 unrelated skipped).
- Company/role and login regression: `security-boundaries.spec.ts`, `preserves company membership and administrator role after password recovery` and `keeps signed-in password changes dependent on the current password` pass (2 passed, 87 unrelated skipped). Recovery returns only success and no session cookie; ordinary login verifies the same customer ID, unchanged employee data, retained admin access and foreign-company refusal.
- Cross-app response/form contract: task 02's 27 scoped action/form/login tests pass; no duplicate component tests added. Actual browser navigation and mailbox delivery are not provable in this task for the environment reasons above.
- Backend lint: 0 errors, 13 existing warnings after allowing access to Medusa's user configuration. Whole-backend tsc: 22 diagnostics, baseline 22, none in changed tests. Logs: ignored `.tmp/NIMBUS-133-20261023-implementation/backend-230-*`.
- Full-suite/build completion: not provable in this task; dispatcher finalization runs those checks and records outcomes.
- Also update current architecture/rule registry: `docs/architecture/store-access.md` describes public recovery, core ownership, accepted concurrency/token logging risks, default sessions, translation publication and the after-deploy check; `ai/architecture/decisions.md` registers its owners.
- Also update affected security/account tests: shared security matrix gains company/role and signed-in password regressions; recovery HTTP spec gains wrong-account proof refusal. Existing storefront recovery/account tests already describe current behaviour and need no change.
- Also update final deviation report: handed to integration-reviewer; no shipped case records changed.
- Generated context: shortened only the new recovery registry row to stay within the existing 32768-byte cap; `corepack pnpm ai:check --fix` and `corepack pnpm ai:check` pass. Generated `AGENTS.md` and `.github/copilot-instructions.md` include the new row.
