# Manifest: Show the size on shipment notice lines

**Key:** NIMBUS-231
**Issue:** NIMBUS-231
**Branch:** feature/NIMBUS-231 (from develop)
**Ready for Dispatch:** true (plan approved by Klaus Petersen, 2026-10-24; next-link origin verified)

## Conventions and commands

All tasks are in `apps/backend` (`<f>` = `pnpm --filter @b2b-starter/backend`), run from the repo root:

- Scoped unit test: `<f> test:unit -- <path>` (tests in `src/**/__tests__/*.unit.spec.ts`; module tests
  with fetch mocks in `src/modules/business-central/__tests__/`).
- Integration (finalization only, local Postgres): `pnpm test:integration:http` for
  `integration-tests/http/**`; abort unless `BUSINESS_CENTRAL_DISCOVERY_URL` is TestDK.
- Lint: `<f> lint`. Typecheck: `apps/backend/node_modules/.bin/tsc --noEmit -p apps/backend`
  (at or below the baseline in `ai/architecture/verification.md`; re-measure on the branch first).
- No migration in this work. Customer artifacts go to `issues/NIMBUS-231/artifacts/`, never into
  `issues/NIMBUS-130/`.
- Live BC calls: none by workers. Any probe is read-only GET against TestDK, tenant removed from
  saved evidence.

## Tasks

| # | Title | File | App | Implements | Depends on | Issue | Status |
|---|-------|------|-----|------------|------------|-------|--------|
| 01 | BC adapter reads shipment line variant codes from `TRCShipmentLine` | `01-bc-variant-read.md` | backend | F2, NFR1, NFR2, NFR3 (adapter part), NFR4 | None | NIMBUS-238 | DONE |
| 02 | `variant_code` on notice lines: contract, decision rule (B1–B4), check wiring (B5) | `02-notice-line-size.md` | backend | F1, F2, F3, F4, F6 (contract), NFR3, B1–B5 | 01 | NIMBUS-239 | DONE |
| 03 | Notices stored before the release are served with `variant_code: null` | `03-serve-old-notices.md` | backend | F5 (serving), B6 | 02 | NIMBUS-240 | DONE |
| 04 | New JSON Schema, XSD, examples and release note; architecture doc | `04-artifacts-and-docs.md` | backend (docs) | F5 (cut-off doc), F6 (artifacts), F7, B7 | 02, 03 | NIMBUS-241 | DONE |

## Scope items with no task

| Scope item | Reason (already done / external / not needed) |
|---|---|
| NFR 5: APIM policy and Logic App unchanged | not needed: the policy renders any property; deployed-version check is Klaus's (plan, Needs your decision 2) |
| B8: access unchanged | not needed: no change to discovery, company filter or the endpoint's access; existing tests cover it |
| Publishing the schemas to customers and APIM | external: Klaus deploys the task 04 artifacts |
| Verification item: after-deploy TestDK check | carried as "Verify after deploy" in tasks 02 and 03 |
