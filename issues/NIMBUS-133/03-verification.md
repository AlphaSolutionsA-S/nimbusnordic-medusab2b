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
