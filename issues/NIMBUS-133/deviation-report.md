# Deviation report: Customer password recovery

> Record of NIMBUS-133, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

Date: 2026-10-23. Reviewed through `52c4b0e` against merge-base `a76afc7b33d63d5a298410e29fc9879079223877`.

## Deviations from scope and plan

- **Human decision required — abuse protection:** SCOPE.md requires enforceable limits on request/submission, including direct backend calls and multiple instances. PLAN.md instead says reuse existing supported controls without identifying them. No recovery limiter, configured threshold or abuse test was found in tracked backend configuration/code or the inspected installed core Auth middleware/framework HTTP paths. Coverage by deployment infrastructure remains unverified; the scope requirement is not demonstrated. See finding 1 and question 1.
- Backend reuses core `sendNotificationsStep`; the project preparation step only builds notification input from deployment configuration. Acceptable OOTB reuse, with real event-chain coverage.
- The trusted email destination uses the first `STORE_CORS` origin and validated country metadata, defaulting to `dk`; request-supplied destinations are ignored. Acceptable implementation choice, conditional on deployment configuration.
- Unknown update fields are refused before core consumption, rather than relying solely on core identity override. Acceptable tightening; HTTP tests cover unchanged accounts and valid retry.
- Storefront recovery actions live in a dedicated `lib/data/password-recovery.ts`, keeping public recovery separate from login/cart cookies. Acceptable; backend remains the password-policy owner.
- Browser/other-device navigation, actual origin/CSRF behaviour, runtime translation publication and inbox delivery were not exercised. These remain release checks, not completed delivery evidence.
- Whole-branch verification has baseline/environment limitations: incomplete full HTTP run, existing storefront test/typecheck failures and unavailable configured lint/build. See Tests and question 2.
- Existing token persistence/logging, simultaneous reuse/issuance races and default session behaviour remain explicitly accepted. No new approval or remediation is requested for them.

## Consolidation changes

- Added a real HTTP request → core event → registered subscriber → successful persisted Notification → usable reset proof → normal login regression. The existing direct-workflow test alone could not detect missing subscriber registration.
- Temporarily disabling subscriber registration made that regression fail on missing Notification (expected 1, actual 0). Original source was restored; all 14 recovery HTTP cases then passed. No application source change remains from the mutation.
- No dead production export, duplicate file body, unnecessary mocking seam or justified helper/test removal was identified. Exported schema types follow the project's schema-export convention.
- `notes.md` records security-path accounting, finalization evidence and explicit limits. Generated architecture context was synchronized by task 03.

## Findings

1. **HIGH — automated-abuse requirement has no identified control or verification.** `apps/backend/src/api/auth/middlewares.ts:18` installs body validation only for the two public recovery endpoints. `issues/NIMBUS-133/SCOPE.md:36` requires enforceable automated-abuse limits; `issues/NIMBUS-133/PLAN.md:35` assumes existing controls without naming a primitive or threshold. Tracked backend source/configuration contains no applicable rate limiter; the inspected installed Auth middleware and framework HTTP source yielded none. No test verifies throttling or cross-instance enforcement. Repeated public requests can replace the latest proof and dispatch further notifications unless an external control intervenes. This is a design/scope decision for the human gate, distinct from accepted concurrent reuse/logging risks; external protection must not be claimed without evidence.
2. **MEDIUM — public browser/release behaviour is not yet demonstrated.** `apps/storefront/src/app/[countryCode]/(main)/reset-password/page.tsx:14` is correctly outside account guards and performs no mutation; component/action/HTTP tests cover its seams. However, running Next country routing, browser origin handling, another-browser completion and published translations remain unverified. The existing storefront installation cannot produce a current successful build. Do not describe this branch as deployed or browser-verified.

No mechanical wiring correction is requested. Backend middleware registration, customer-only subscriber/workflow, Notification channel, trusted country-prefixed URL, public pages and SDK action fields agree across tasks. Public package entry-point re-exports were inspected; no internal import, new module needing registration, cross-app source import, circular dependency or blanket cast was introduced. New UI strings use translation keys; the database import checklist and current architecture/rule registry describe the combined behaviour. Searches of recovery names/routes/password fields found no additional stale affected behaviour outside the case's historical stage records. The working tree was clean before this report, and branch whitespace validation passes. The project lists no architecture check to run; boundary review was manual.

## Tests

Evidence below was supplied by finalization/consolidation and checked against the changed tests and recorded results; the integration review did not rerun tests, builds or lint.

- Backend scoped: 17 unit tests, 14 recovery HTTP cases and 3 shared security regressions passed. Real PostgreSQL coverage includes neutral known/unknown/provider-failure responses, no account creation, tampered/wrong actor/account/provider proofs, expiry/900-second lifetime, sequential supersession/reuse, refused identity substitution, validation before consumption with valid retry, old/new login, no automatic session, company/role preservation, foreign-company denial, existing signed-in password change and registered event/Notification dispatch.
- Storefront scoped: 27 action/component/login regression tests passed. They cover country metadata, reset-proof-only submission, safe errors, missing/rejected links, fresh request, backend validation retry, labels/autocomplete, pending state and success returning to normal login.
- Remaining security evidence limits: no abuse-control test, actual browser/origin test, multi-process failover/restart test or runtime logger capture. No concurrency guarantee or session revocation is promised. Notification success proves dispatch, not receipt.
- Source adds 349 lines across 11 TypeScript/TSX files; tests add 516 and remove 6 across 7 files (added test/source ratio 1.48). Translation import files add a separate 184 lines. The 49 new parameter-expanded cases cover distinct boundaries; unit schemas/content, HTTP core behaviour/event wiring and UI interactions are not redundant copies. There is no ratio target.
- Full backend unit run: 65 suites / 759 tests passed; configured discovery includes generated `.medusa/server` copies, so these are not unique-source counts. Backend source and Admin build reported success; the PowerShell wrapper still returned nonzero from stderr. Lint: 0 errors / 13 existing warnings. Whole-backend typecheck: unchanged 22 baseline diagnostics.
- Full backend HTTP run: **incomplete**, terminated after stalled cleanup; logs show 5 passing and 3 failing suites (existing store/admin quotes; shared security Admin CORS preflight with empty `ADMIN_CORS`). No aggregate success is claimed. Focused recovery/security cases passed separately with test configuration. No new module was added; the module suite was not rerun.
- Full storefront run: 175 passing / 3 failing suites, 573 passing / 3 failing tests; failures are recorded money/profile/main-layout baseline cases. Typecheck: unchanged 58 baseline diagnostics. Configured lint is blocked by installed Next CLI / ESLint configuration drift. Build fails on existing account parallel routes with installed Next 16.4.2 versus manifest 15.5.28. The failing route tree is unchanged from merge-base; a separate baseline build was not reproduced, so this is evidence of pre-existing route/config incompatibility, not a proven baseline-build comparison.
- No seeded running storefront/backend, published runtime recovery translations, controlled inbox receipt or deployed credential/session result was verified. Importing message JSON is a release action; those files are not runtime text.

## Open questions

1. How should the unmet abuse-protection requirement be resolved before accepting this branch? Options: identify and verify existing edge/backend limits covering both direct Auth endpoints across instances; create a separately scoped abuse-protection task and keep release dependent on it; or explicitly accept/defer this requirement and record the residual automated-request/notification risk. No such acceptance is inferred from the earlier logging/concurrent-reuse decisions.
   **Answer (Klaus Petersen, 2026-10-23):** "alt ok - push og merge til develop". Accept/defer this requirement and its residual automated-request/notification risk. No rate limiter, counter module or additional task is added in this change.
2. Does the human accept the recorded verification limitations for this branch, with current build/install repair, runtime translation publication, browser checks and controlled-mailbox reset/login checks remaining explicit release obligations, or require those checks before proceeding? A push approval must not be described as proof of deployment or delivery.
   **Answer (Klaus Petersen, 2026-10-23):** Accepted for push and merge to develop. Existing verification limitations and after-deploy checks remain documented release obligations; this approval does not establish deployment, browser operation or inbox delivery. Push and merge are explicitly authorized without another approval gate.

## Verify after deploy

- **01: Backend recovery and email — Verify after deploy:** Controlled mailbox/account reset; provider acceptance proves dispatch only.
- **02: Public translated recovery — Verify after deploy:** Login entry, forgot/reset page and published UI translations in one configured country.
- **03: Verification and documentation — Verify after deploy:** Controlled mailbox/account delivery, reset, sequential replay refusal, old/new login and published UI keys.

Release checks also confirm that the first `STORE_CORS` origin is the intended HTTPS portal, the country's language has the imported keys, public links work signed out/in another browser, and GET never changes credentials. Existing Notification/provider configuration remains in scope as agreed; provider provisioning remains excluded.
