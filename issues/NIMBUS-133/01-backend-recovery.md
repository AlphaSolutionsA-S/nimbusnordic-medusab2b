# 01: Backend recovery and email
**App:** backend · **Layer:** L6, L7, L4/L3 · **Depends on:** None
**Goal:** Reuse core customer/emailpass recovery and send English instructions through existing Notification channel `email`.
**Files / areas:** src/api/auth/, api/middlewares.ts, subscribers/, workflows/customer/; existing HTTP security specs.
**Seam contracts:** Core POST /auth/customer/emailpass/reset-password accepts email; POST /auth/customer/emailpass/update accepts reset Bearer proof and password, with project confirmation validation. Use the exact static update matcher before core parameterized middleware (verified sample). Notification links to a trusted country-prefixed storefront reset page.
**Test intent:**
- HTTP neutral known/unknown acknowledgement; no account creation; tamper/wrong actor/provider/identity substitution refused.
- Server minimum eight and matching confirmation before consumption; HTTP regression proves valid-retry semantics.
- Core expiry, sequential reuse and supersession; concurrent reuse is accepted, no one-winner assertion.
- Notification uses email and existing configuration; no new password logs or provider details in UI-facing errors.
**Done when:** Valid recovery and negative cases pass scoped checks against baseline.
**Verify after deploy:** Controlled mailbox/account reset; provider acceptance proves dispatch only.
**Also update:** Existing security-boundaries.spec.ts and customer password regression tests where affected; current docs consolidation is 03.

## Deviations
- Reused the verified core `sendNotificationsStep` rather than implementing a second Notification mutation step; the custom preparation step only resolves deployment configuration and builds English content.
- Trusted destination is the first origin in existing `STORE_CORS`; country metadata is two lowercase letters, with `dk` when absent. Request redirect URLs are never used. No new configuration variable or provider was added.
- Installed framework request validation rejects unknown update fields: identity substitution is refused with 400 before consumption, instead of relying solely on core's identity override. HTTP verifies unchanged credentials and valid retry.
- PostgreSQL was restored for checks through a separate temporary local container provided by the dispatcher. Installed test-utils requires `DB_HOST=localhost` to avoid its forced-SSL path for non-localhost strings. No repository infrastructure changed.
- Existing signed-in password-change code has no regression tests to update; it uses `/store/customers/me/password`, outside the added exact Auth matcher. Further regression/documentation consolidation remains task 03.

## Done-when evidence
- Valid recovery and negatives: `integration-tests/http/security/password-recovery.spec.ts` covers neutral known/unknown and provider-failure acknowledgement, no identity creation, minimum/mismatch/missing confirmation before consumption and valid retry, 900-second JWT lifetime, expiry, wrong actor/provider, tampering, sequential supersession/reuse, refused identity substitution, unchanged victim credentials, old-password refusal, new-password login and absence of automatic session creation.
- Notification: the same HTTP suite's `dispatches English email through the existing Notification module and skips non-customers` verifies persisted email dispatch and trusted country-prefixed reset URL using real Notification; `password-reset-notification.unit.spec.ts` verifies English content and destination injection/configuration rejection. Existing local provider output proves dispatch only.
- Validation checks: 17 scoped unit tests pass; real PostgreSQL recovery suite passes 11 cases and the added provider-failure case passes separately. Changed missing/login-token/GET security-boundary case passes separately with a name filter (1 passed, 86 unrelated cases skipped).
- Lint passes (0 errors; 13 pre-existing warnings). Whole-backend typecheck has the unchanged 22 baseline diagnostics and no new diagnostics. Logs are under ignored `.tmp/NIMBUS-133-20261023-implementation/backend-228-*`.
- Also update: added the missing/ordinary-token/GET recovery negative to `security-boundaries.spec.ts`; no existing signed-in password tests found or affected. Current architecture documentation is assigned to 03.
- After deployment: controlled mailbox delivery and deployed reset remain unverified and must be checked by task 03/deployment owner.
