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
