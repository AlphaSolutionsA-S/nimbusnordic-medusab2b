# NIMBUS-133: Forgotten password implementation plan

Date: 2026-10-23. Base: develop. Branch: feature/NIMBUS-133.
State: approved by Klaus Petersen on 2026-10-23; ready for dispatch, awaiting separate dispatcher handoff instruction.

## Summary [High]
Add public customer recovery pages using Medusa's existing emailpass recovery and an English reset notification on channel `email`. Reuse existing notification configuration, including the local provider. No new token storage, locks, delivery provider or session revocation.

Klaus accepts existing token logging/persistence and concurrent reuse risk. Sequential single-use, latest-link invalidation and the 15-minute lifetime remain the intended core behaviour. Existing sessions follow Medusa defaults.

How to review this plan: approval is the human review gate. Read the High data/state tables and Critical security matrix closely. Task files add optional implementation boundaries and test intent. Remaining technical assumptions must be resolved before dispatch; questions are often faster to resolve in chat than by reading every task.

## Needs your decision [Critical]
No outstanding decisions. Klaus approved the three-task plan on 2026-10-23. The accepted logging/concurrency risks remain unchanged. Middleware ordering is verified below; integration checks still require PostgreSQL during implementation.

## Flows [High]
### A. Request recovery (01, 02)
1. A signed-out customer opens the country-prefixed forgot-password form from login and submits an email.
2. The backend validates input and delegates to core customer/emailpass recovery. Known and unknown accounts receive neutral acknowledgement; no account is created.
3. Core creates a 15-minute reset proof and emits its event. A customer-only subscriber starts one notification workflow.
4. The workflow dispatches English instructions through Notification channel `email` with a trusted configured reset destination. Existing persistence/logging is accepted; dispatch alone does not prove delivery.

### B. Complete recovery (01, 02)
1. The recipient opens the public country-prefixed reset page without login, including on another device. GET does not mutate credentials.
2. Server validation enforces matching confirmation and the existing eight-character minimum. Core verifies the recovery proof and determines the account.
3. Success updates that credential and leads to normal login without automatic sign-in. Invalid, expired, sequentially reused or superseded links offer another request.
4. Core session/token behaviour applies. Concurrent requests can race; no exactly-once or other-device logout guarantee is claimed.

### C. Verification (03)
1. Real HTTP/PostgreSQL tests exercise the Auth boundary and sequential invalid-link cases, without asserting an unimplemented concurrency guarantee.
2. After deploy, check one controlled mailbox/account for delivery, reset, old-password refusal and normal login with the new password. A local-provider log is not delivery evidence.

## What gets built [High]
### 01. Backend recovery and email notification
Extend the customer/emailpass HTTP boundary (L6) with request/password validation and neutral failures while reusing supported core Auth primitives. Add a thin reset subscriber (L7), notification workflow/step (L4/L3), and English template data using the existing Notification service on `email`. Core Auth remains the only credential/proof owner. An exact static middleware matcher validates before core's parameterized consumption middleware. Reuse existing supported HTTP abuse controls; no new counter module or migration is proposed.

### 02. Public translated recovery pages
Add country-prefixed public routes/server components (S3), typed server actions (S2) through the existing SDK, and feature forms (S4), outside authenticated dashboard guards. Add the login entry, validation, neutral acknowledgement, invalid-link and success states. Follow account styling, accessibility and password-manager conventions; keep pages uncached/unindexed and UI text database-backed. English mail is separate from portal translations.

### 03. Cross-app verification and documentation
Consolidate real HTTP/PostgreSQL security tests and storefront interaction checks, preserving normal login and signed-in password change. Update current architecture and the rule registry. Record deployment checks and test limits without prematurely claiming delivery or verified runtime behaviour.

## Data model [High]
No new tables or migrations. Core owns identity and proof state; concurrent cardinality limitations are accepted.

| Entity / meaning | Existing callers | Owner / writer | Storage / encryption | Mutable until | Retention / deletion | Indexes |
|---|---|---|---|---|---|---|
| Emailpass identity and credential | Login, signup, password change | Core Auth / core update | Existing credential hash | Next update | Existing account lifecycle | Existing core indexes |
| Password and confirmation | New form/action | Browser then backend | Transient request; never add password logs | Response | Discard input; hash only in Auth | None |
| Reset JTI/hash, identity, expiry | Core recovery/validator | Core Auth only | Signed JWT; SHA-256 fingerprint in core state | Consume/replace/expiry | Core consumption/replacement delete; existing expiry lifecycle, no custom cleanup | Existing hash/provider indexes |
| Notification recipient/template/data/status | Existing Notification API | Core Notification / reset workflow | Stored before send; local provider logs | Core lifecycle | Existing retention accepted; no special cleanup | Existing indexes |
| Country/trusted destination | Existing publication/config | Backend derives URL | Derived, not authorization | Request/notification lifetime | No new store | None |

## Business rules as state tables [High]
| State | Event / permission | Outcome | Other rows / sessions |
|---|---|---|---|
| Eligible or absent identity | Public valid request | Neutral acknowledgement; eligible customer receives instructions | No account/session creation |
| Active proof | New sequential request | Previous superseded; newest valid 15 minutes | Password unchanged; concurrent ordering risk accepted |
| Valid unused proof | Holder submits valid matching password | Core credential update and consumption | Roles/company unchanged; no auto-login |
| Short/mismatched password | Submission | Server refuses before core consumption | Credential/proof unchanged; prove via HTTP regression |
| Invalid/expired/used/superseded proof | Submission | Refusal, fresh-request option | No authorized credential change |
| Simultaneous valid submissions | Concurrent consume | Core behaviour; multiple successes possible | Explicitly accepted risk; no extra lock |
| Notification dispatched | Existing provider handles data | Persistence/logging accepted | No password change or delivery claim |
| Update fails after consumption | Core failure | Fresh request; no token restoration | Existing core failure semantics |

The actor is the holder of account-bound customer proof. Company-admin role, ambient login and submitted customer/company IDs do not grant reset permission.

## Security-property matrix [Critical]
| Property | Control / trust root | Failure / limitation | Negative test |
|---|---|---|---|
| Trust anchor, actor/account | Core signed reset-purpose proof and provider identity binding | Wrong/tampered proof cannot select another account | HTTP tamper, wrong actor/provider, identity substitution |
| Replay | Core durable consumption and supersession | Sequential reuse refused; concurrent race accepted | Sequential reuse, expiry, replaced link; no one-winner race assertion |
| Cross-instance | Core shared Auth database | No local token list; concurrent limitations accepted | Real database sequential lifecycle, no added distributed lock guarantee |
| Browser/CSRF | Proof plus explicit submission, existing origin controls | GET/cookie-only request cannot reset | Other-browser proof succeeds; missing proof/GET cannot mutate |
| Logout/session | Existing core authentication defaults | No auto-login or other-device logout promise | Response creates no login credential |
| Enumeration | Neutral backend acknowledgement and safe error mapping | No account/provider details to UI | Known/unknown and provider-failure parity |
| Password policy | Backend minimum eight and confirmation | Invalid password refused | Direct short/mismatch and retry semantics |
| Personal data/failures | Existing Notification behaviour accepted; no new password logs | Tokens may persist/log under existing configuration | No new password exposure or account/provider detail in UI errors |

## Decisions [High]
### New in this plan
- Core already issues/verifies proof and hashes credentials: reuse public APIs, never import internal validators or add parallel token storage.
- Installed emailpass lacks the product minimum; add validation at exact static customer/emailpass update matcher. Verified router sorting places it before core parameterized token-consumption middleware.
- Public sibling routes avoid dashboard guards. Feature components call server actions through the existing transport boundary.
- No new abuse-counter module/migration. Use existing supported controls; document a demonstrated missing requirement concretely rather than invent infrastructure during planning.

### From the scope [Medium]
- Existing Notification `email`, English mail, translated portal UI, no provider provisioning.
- Fifteen-minute sequential single-use/latest link; eight-character minimum; normal login afterward.
- Existing sessions retain core defaults, no custom revocation.
- Klaus accepts existing token logging/persistence and concurrent reuse on 2026-10-23; neither needs remediation or another approval.

## Framework assumptions [Critical where unresolved]
Installed Medusa 2.21.2 is verified from backend package configuration and installed code. Paths below refer to installed packages under backend node_modules or root node_modules/.pnpm.

| Primitive | Input/output and side effect | Evidence / status |
|---|---|---|
| Core recovery | Customer actor/provider/entity -> 900-second reset JWT/JTI and event | Verified core-flows/dist/auth/workflows/generate-reset-password-token.js and auth/steps/create-password-reset-token.js |
| Core consumption | Fingerprint/provider/entity -> expiry check/delete | Verified auth/dist/services/auth-module.js; concurrency guarantee unproven and accepted as risk |
| Core validator/update | Reset Bearer proof -> identity context; submitted identity overridden | Verified medusa/dist/api/auth/utils/validate-token.js and api/auth/[actor_type]/[auth_provider]/update/route.js; runtime negatives remain implementation tests |
| Validation order | Exact static customer/emailpass matcher before core parameterized update middleware | Verified framework/dist/http/router.js and routes-sorter.js; runnable samples/verify-reset-order.cjs returns project-validation then core-consume. This verifies registration order, not deployed validation behaviour |
| Password policy | Truthy string -> hash, no eight-character minimum | Verified auth-emailpass/dist/services/emailpass.js; project validation necessary |
| Notification | DTO stored before provider; local logs data | Verified notification/dist/services/notification-module-service.js and notification-local/dist/services/local.js; behaviour accepted |
| Tests | Jest HTTP with PostgreSQL, storefront Jest/Playwright | Configs/scripts/security tests verified; read-only DB probe returned ECONNREFUSED |

## Open risks and gates [High]
- **Plan gate passed:** Klaus approved the task decomposition on 2026-10-23. No unresolved framework-order assumption remains. Runtime negative/security tests are implementation deliverables; dispatcher handoff still requires a separate instruction.
- **Verification owner:** restore existing test PostgreSQL connectivity and allowlisted BC test environment for required integration checks. No credentials recorded here.
- **Accepted, non-blocking:** concurrent consume/issuance races; no custom lock or Auth replacement.
- **Accepted, non-blocking:** existing Notification persistence and local logging; no guard or special cleanup.
- **Deployment owner:** verify inbox delivery where an existing delivering provider is configured; local output proves dispatch only, provisioning remains excluded.
- **Recommended review:** authentication work warrants a different-model-family review before dispatch; running it is the user's choice.
