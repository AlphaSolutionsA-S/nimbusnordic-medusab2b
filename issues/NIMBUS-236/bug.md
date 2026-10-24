# Local backend HTTP tests fail to log in (401) in seven test suites

- Tracker: [NIMBUS-236](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-236)
- Severity: Major
- Area: Backend HTTP integration tests (`apps/backend/integration-tests/http/`)
- Reported by: Klaus Petersen (found by the NIMBUS-180 dispatch)
- Reported at: 2026-10-23T00:00:00Z

## Summary
When the backend's HTTP integration tests run locally, seven test suites fail because their test
users can no longer log in (the backend answers 401). 77 tests are affected: Business Central
integration in the Admin, both quote suites, password recovery, translations, the security
boundary tests and companies. It happens on develop as well (commit eea3a01, 2026-10-23), so it is
not caused by recent feature work, but it means these areas currently have no working automated
check, and new tests in them cannot be proven. The repository's recorded test baseline lists only
the quote tests as failing.

## Steps to reproduce
1. Check out `develop` at `eea3a01`.
2. With a local Postgres and the test environment the suites require
   (`BUSINESS_CENTRAL_DISCOVERY_URL` set to an allowed test value, see
   `integration-tests/global-setup.ts`), run `pnpm test:integration:http` from the repo root.
3. See the suites below fail; the failing requests answer 401 on login.

## Expected
The suites log in their test users and run; only the failures recorded in
`ai/architecture/verification.md` remain.

## Actual
77 tests fail with 401 on login, in these suites: `admin/bc-integration.spec.ts`, both quote
suites, password recovery, translations, `security/security-boundaries.spec.ts`, companies.

## Environment
- OS: Windows 11 (developer machine)
- Browser / runtime: Node 22, Jest HTTP integration tests, local PostgreSQL
- Build / commit: `develop` at `eea3a01` (same failures on `feature/NIMBUS-180`)
- Tenant / data context: local test database

## Evidence
- Failed test lists from the NIMBUS-180 dispatch (session scratchpad, not committed):
  `base-failed-tests.txt` (develop eea3a01) and `branch-failed-tests.txt` (feature/NIMBUS-180),
  identical sets of 77 tests.
- NIMBUS-180 `deviation-report.md`: the new Admin test for the size and unit refusal reasons in
  `admin/bc-integration.spec.ts` could not be proven because of this.

## Analysis
*(Not started. Likely candidates to check first: a recent change to auth or login in the backend,
or to the shared test login helper under `integration-tests/`.)*
