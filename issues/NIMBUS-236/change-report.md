# NIMBUS-236: change report

## Summary

Locally, the backend HTTP integration suites failed with 401 on every login whose token the suite
signs itself. The suites sign with `supersecret` and pass `env: { JWT_SECRET: "supersecret" }` to
`medusaIntegrationTestRunner`. `@medusajs/test-utils` 2.21.2, however, evaluates
`apps/backend/medusa-config.ts` (`configLoaderOverride`, `dist/medusa-test-runner-utils/config.js`)
before it applies a suite's `env` (`applyEnvVarsToProcess`, `dist/medusa-test-runner.js`
`beforeAll`). So `http.jwtSecret` took the `JWT_SECRET` that `jest.config.js` had loaded from the
local `apps/backend/.env`, and any other value there rejected the suites' tokens. Auth code and
production config were never at fault. `apps/backend/jest.config.js` now sets
`JWT_SECRET=supersecret` before it loads the env files, for test runs only.

## What was built

- `apps/backend/jest.config.js` (test configuration, no layer): assigns
  `process.env.JWT_SECRET = "supersecret"` before `loadEnv("test", __dirname)`, with a why-comment
  citing NIMBUS-236. dotenv and dotenv-expand never replace a variable already in `process.env`
  (dotenv 16.6.1 `populate` only with `override: true`; `@medusajs/utils` 2.21.2 `loadEnv` passes no
  `override`), so neither this file's nor `medusa-config.ts`'s `loadEnv` replaces it. All backend
  test scripts run `--runInBand`, so the test environments inherit the value.

## Decisions

- Fixed in `jest.config.js`, not `integration-tests/setup.js`: it is the file that already loads the
  test env, and the 2026-10-26 reproduction (value preset in the shell) proved this timing works.
- Unconditional assignment, not `??=`: the suites hard-code `supersecret`, so a value from the shell
  or `.env` would break them the same way.
- Applies to every Jest run of this config (unit, modules, http). Unit and module tests don't read
  `JWT_SECRET`, so a `TEST_TYPE` branch would add nothing.
- `COOKIE_SECRET` is not set. It is captured the same way, but the app signs and verifies its own
  session cookies, and no test signs a cookie with the configured value. So `bc-integration`'s
  `COOKIE_SECRET` env is still ignored, harmlessly.
- The comment runs to three lines, not the one line `task.md` planned: one line could not give both
  the cause and why the assignment must come before `loadEnv`.
- The before and after runs used a throwaway Docker Postgres (`postgres:18-alpine`, trust auth,
  port 55499, set through `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD` in the shell). The local
  `nimbus_postgres_container` started but Docker did not publish its port 5432 to the host.
- Both runs ran Jest directly with `NODE_OPTIONS=--experimental-vm-modules --max-old-space-size=8192`,
  otherwise the same as the package script. With the default heap, `--runInBand` ran out of memory
  after 21 of 22 suites (Node 24.14).

## Tests

- Reproducing test: the existing HTTP suites. Full local `test:integration:http` on develop
  `fef50ee` with the fix removed: 8 suites and 122 tests failed, 362 passed (484). About 100 of the
  failures were a 401 or a status assertion receiving 401: `companies/companies` (32),
  `translations/translations` (42), `security/password-recovery` (16),
  `companies/employee-invitation` (14), `admin/bc-integration` (12),
  `security/security-boundaries` (4), `quotes/quotes` (2), `admin/quotes/quotes` (1).
- With the fix: 5 suites and 15 tests failed, 469 passed (484). No failure is a 401. The
  `wrong-secret` and `not-the-secret` negative cases in `password-recovery` and
  `security-boundaries` pass, so forged tokens are still rejected.
- Remaining 15 failures, none caused by this change (all fail the same way before it):
  - Email notifications, 8 (`security/password-recovery` 6, `companies/employee-invitation` 2):
    "Could not find a notification provider for channel: email". `medusa-config.ts` gives
    `notification-local` the `email` channel only when `NODE_ENV === "development"`, and tests run
    with `test`.
  - `Employee.customer_id`, 2 (`security-boundaries` "refuses an own-company admin attaching an
    existing companyless customer as admin", `employee-invitation` "refuses with 400 when the store
    tries to link an existing customer"): the tests query a property the employee model does not
    have.
  - Store quote company projection, 2 (`security-boundaries` "store quote response privacy", both
    `is_admin` values): `quote.customer.employee.company` returns `id` as well as `name`, while the
    test and `decisions.md` say name only.
  - Quote response shape, 2 (`quotes/quotes` "retains contact, spending, message references…" and
    "POST /store/quotes successfully initiates a quote with a draft order"): the deep
    `objectContaining` assertions do not match the response. Cause not investigated.
  - Admin quote message, 1 (`admin/quotes/quotes` "POST /admin/quotes/:id/messages successfully
    creates an admin quote message"): the request answers 400. Cause not investigated.
- Unit tests: `test:unit` 95 suites, 1236 tests passed. Backend `lint`: 0 errors, 13 warnings, all
  existed before. Typecheck: not applicable (`jest.config.js` is outside the tsconfig).
- Review: code-reviewer approved.

## Also updated

- `ai/architecture/verification.md`: the local `test:integration:http` baseline now holds the
  re-measured result in place of the 77 401 failures. `pnpm ai:check --fix` regenerated the copies
  in `AGENTS.md` and `.github/copilot-instructions.md`.
- `docs/architecture/business-central-company-sync.md`: removed the note that the Admin cases fail
  with 401 until NIMBUS-236 is fixed. The NIMBUS-261 unit specs are still listed as test locations,
  and their files are unchanged.

## Open questions and follow-ups

- The NIMBUS-261 unit specs (`business-central-customer-routes.unit.spec.ts`,
  `{lookup,use}-business-central-customer.unit.spec.ts`) were added as a stand-in while the Admin
  HTTP cases could not log in. Keeping or removing them is Klaus's decision.
- Possible new bugs to register, one per remaining cause: the email channel in tests, the
  `Employee.customer_id` test drift, the store quote company `id` exposure (a privacy check against
  `decisions.md`, so it needs the full pipeline if it is a real leak), the quote response shape and
  the Admin quote message 400.
- The default Node heap can't finish the full `--runInBand` HTTP run on Node 24. Consider adding
  `--max-old-space-size` to the `test:integration:http` script.
- Docker did not publish port 5432 for `nimbus_postgres_container` on this machine. A local setup
  issue, not a repo change.

## Follow-up: email channel in tests (second commit)

Klaus asked for this on 2026-11-23 ("do give the local provider the email channel when NODE_ENV is
test as well").

- `apps/backend/medusa-config.ts`: `notification-local` now serves the `email` channel when
  `NODE_ENV` is `development` or `test`, and `feed` otherwise. Jest sets `NODE_ENV=test`. Only the
  `test` value changes behaviour: production, staging and an unset `NODE_ENV` still get `feed`
  (`loadEnv` never assigns `NODE_ENV`). Review approved.
- Nothing relies on `feed`: no spec or source in `apps/backend` uses it. Every notification is built
  with channel `email`, and the HTTP suites assert `email`.
- Results, run the same way as before (throwaway Postgres, `--max-old-space-size=8192`):
  - `password-recovery` and `employee-invitation` together: 4 failed, 31 passed, down from 9 failed.
  - Full `test:integration:http`: 10 failed, 474 passed of 484 (before this change: 15 failed). The
    email-provider error is gone and nothing new fails. The eight email-dependent tests break down
    as follows:
    - Five now pass.
    - Three now fail one step later: the email link's origin is `http://localhost:8000` (the local
      `.env` `STORE_CORS`) instead of the suite's `STORE_CORS: https://shop.example.test`. It is
      the same mechanism as the JWT secret: the config is read before the suite's `env` is
      applied. Not fixed here.
  - The other seven remaining failures are unchanged (see Tests above).
- Logging: in test runs the local provider now logs every email through the Medusa logger:
  recipient address, template and `data`. For password resets, `data` includes the full reset URL
  with its token. In tests these are synthetic addresses and short-lived tokens in a throwaway
  database. Development already logged the same. Production is unaffected (`feed`).

### Open questions from the follow-up

- `STORE_CORS` in tests: pinning `STORE_CORS=https://shop.example.test` in `jest.config.js` the way
  `JWT_SECRET` is pinned would fix the three origin failures. It would also change `STORE_CORS` for
  every suite. No other suite sets it, and the tests send no `Origin` header. This needs Klaus's go.
- Deployed email: outside development and test, the only notification provider serves `feed`, while
  password reset and invitations send on `email`. Unless Medusa Cloud configures another email
  provider, those emails would fail there with the same error. Not verified against Medusa Cloud.
