# Branch notes

## 01 / NIMBUS-228 — Backend recovery
- Keep the supported core endpoints: request `POST /auth/customer/emailpass/reset-password` with `{ identifier: email, metadata: { country_code } }`; completion `POST /auth/customer/emailpass/update` with `{ password, password_confirmation }` and reset Bearer proof.
- Completion accepts no `email`, `entity_id`, customer or company field; real framework validation refuses unknown fields before proof consumption. Short/mismatched/missing confirmation permits a later valid retry with the same proof.
- Country metadata must be two lowercase letters. Notification URL is `/<country>/reset-password?token=...` on the first deployment-owned `STORE_CORS` origin; absent country uses `dk`. It contains no email query parameter.
- The new subscriber invokes `sendCustomerPasswordResetWorkflow`; only customer events run its preparation step and OOTB `sendNotificationsStep`. Existing Notification configuration handles channel `email`, English HTML content and `customer-password-reset` template metadata.
- No token table, lock, provider guard, retention cleanup, new provider, session revocation or automatic login was introduced; accepted persistence/logging/concurrency risks stand.
- Recovery tests: `integration-tests/http/security/password-recovery.spec.ts`; shared auth negatives additionally live in `security-boundaries.spec.ts`. Unit tests cover schemas and trusted URL/content.
- Local PG checks use dispatcher's disposable container on port 55433 and `DB_HOST=localhost`; test-utils forces SSL with `127.0.0.1`. Set test-only `JWT_SECRET=supersecret`, `STORE_CORS=https://shop.example.test` and allowlisted BC test URL before launching because config loads before runner env overrides.
- To filter Jest names, pass `--testNamePattern=...` directly after the script name; putting flags after a literal `--` makes them path patterns and can run an entire suite.
- No signed-in password regression test exists. Its separate `/store/customers/me/password` route and source were unchanged. Task 03 should verify its behaviour alongside deployment evidence.

## 02 / NIMBUS-229 — Public storefront recovery
- New S2 exports `requestPasswordReset(countryCode, state, FormData)` and `resetPassword(token, state, FormData)` live in `src/lib/data/password-recovery.ts`; they return typed status/error keys, never backend messages.
- Installed SDK 2.21.2 `auth.resetPassword` accepts identifier plus metadata; `auth.updateProvider` forwards password/confirmation unchanged with explicit reset Bearer proof. Verified using Medusa MCP and installed dist/auth/index.js/.d.ts.
- Public `/[countryCode]/forgot-password` and `/[countryCode]/reset-password` are siblings outside account guards. They force dynamic rendering and noindex metadata; GET never calls a mutation. Duplicate/missing query proof renders fresh-request guidance.
- `modules/account/components/password-recovery/index.tsx` uses labelled native password fields and existing button/design tokens, keeps validation in backend and returns to normal login after success. Feature components import only S2 actions.
- Eight language JSON files are import material only. Merge `Account.recovery` and `Account.login.forgotPasswordLabel` into each environment's DB before release; additional active languages need the same keys. Checklist is in `src/lib/i18n/README.md`.
- Scoped tests: 27 passed across actions, form interactions, login and existing customer/login regressions. Whole tsc58 matches baseline58. Configured lint blocked by installed Next CLI/legacy-vs-flat ESLint mismatch; logs in ignored run folder.
- Browser smoke needs normal layout backend data and runtime DB translations. Existing Playwright config starts production build/start on port8000 with 16 locale/device projects; target one project for recovery smoke. No browser/mailbox/deployed runtime verified by task02.

## 03 / NIMBUS-230 — Verification and documentation
- Shared HTTP security cases verify recovery preserves customer ID and employee/company/admin role, retains admin access and denies foreign-company access; separate signed-in password change still requires the current password and changes old/new login behaviour.
- `password-recovery.spec.ts` additionally rejects a signed proof with the wrong account claim without consuming the original proof.
- Real PG uses localhost:55433 and a synthetic allowlisted TestDK discovery URL; these cases perform no Business Central calls. Logs are under ignored `.tmp/NIMBUS-133-20261023-implementation/backend-230-*`.
- Whole-backend tsc remains22 baseline22. Backend lint has0 errors/13 existing warnings; initial sandbox run needed existing Medusa config access. Storefront baseline checks remain task02's58 diagnostics and lint configuration blocker; no storefront code changed here.
- Runtime recovery documentation and the business-rule registry now describe core ownership, email channel/trusted URL, translation publication and accepted token persistence/logging/concurrent-use risks.
- Browser smoke was not run: no seeded running backend/published translations/current storefront build. Existing `.next/BUILD_ID` is from2026-10-22 and cannot verify these routes.
- Dispatcher must run final full suites/build once, synchronize generated AI context after the registry change, and pass all task deviations to the integration-reviewer. Controlled mailbox and deployed browser/login checks remain release work.
- Review rework: condensed only the new registry row to fit generated-context byte limits; regenerated `AGENTS.md` and `.github/copilot-instructions.md`. `ai:check --fix` and `ai:check` pass.
