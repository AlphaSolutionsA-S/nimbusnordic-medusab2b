# Implementation Manifest: NIMBUS-145 — Accept JSON and XML Orders Through APIM

**Project ID:** NIMBUS-145
**Date:** 2026-09-02
**Ready for Dispatch:** true (conditional — see Dependency Status below)

## Dependency Status

NIMBUS-147 (canonical contract) is scoped but not yet implemented. The schemas in Task 01 are
derived from NIMBUS-147's approved SCOPE and the NIMBUS-129 Task 02 plan. If NIMBUS-147's
implementation produces a different XML representation or field set, the schemas must be
reconciled. NIMBUS-146 (Logic App) is planned but not yet deployed — the policy's backend URL
is a placeholder until the Logic App trigger URL is available.

## Branch

`feature/NIMBUS-145` (from `develop`)

## Note on scope of this dispatch

This is an Azure APIM configuration deliverable — **no code changes to `apps/backend` or
`apps/storefront`**. The "implementation" the implementor performs is writing the reference
artifacts (schemas, policy XML, deployment/test documentation) into
`issues/NIMBUS-145/artifacts/`, exactly as specified in each task file. There is nothing to
`pnpm build`/`pnpm lint`/`pnpm test` for this dispatch. Actual deployment to Azure is a manual
step performed by the environment owner afterward, per Task 02's `deployment-instructions.md`.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Canonical order schemas (JSON Schema + XSD) | `01-canonical-order-schemas-implementation.md` | azure-integration | NIMBUS-147 | TODO |
| 02 | APIM inbound policy XML | `02-apim-inbound-policy-implementation.md` | azure-integration | 01, NIMBUS-146 | TODO |
| 03 | Test payloads and manual verification plan | `03-test-payloads-implementation.md` | azure-integration | 01, 02 | TODO |

## Deliverables (written under `issues/NIMBUS-145/artifacts/`)

- `canonical-order-schema.json` (Task 01) — JSON Schema for `application/json` validation
- `canonical-order-schema.xsd` (Task 01) — XSD for `application/xml` validation
- `apim-policy.xml` (Task 02) — complete APIM inbound policy
- `deployment-instructions.md` (Task 02) — step-by-step Portal application instructions
- `test-payloads.md` (Task 03) — documented manual test cases

## Cross-Task Wiring Summary

- Task 01 produces two schema files that Task 02's policy references by `schema-id`
  (`canonical-order-json` and `canonical-order-xml`). Both must be uploaded to the APIM
  instance's Schemas section before the policy can function.
- Task 02 produces the policy XML and deployment instructions. The policy references the schemas
  from Task 01 and the Logic App trigger URL from NIMBUS-146 (placeholder until deployed).
- Task 03 produces test payloads that exercise both the JSON and XML paths through the policy,
  including validation failures, edge cases, and the single-line array issue.

## Environment / Config Changes

- **No code changes** to `apps/backend` or `apps/storefront`.
- **No `medusa-config.ts` changes**, no DB migrations, no env vars, no `pnpm` installs.
- **Manual Azure Portal steps** (documented in `deployment-instructions.md`):
  1. Upload `canonical-order-schema.json` as a JSON schema in APIM Schemas.
  2. Upload `canonical-order-schema.xsd` as an XML schema in APIM Schemas.
  3. Create or select the order-ingestion API operation in APIM.
  4. Apply the policy XML to the operation's inbound policy.
  5. Configure the backend service URL (Logic App HTTP trigger from NIMBUS-146).

## Test Infrastructure

No automated test infrastructure covers Azure APIM in this repo. Tests are documented manual
payloads (Task 03) to be executed against a live APIM deployment via the Portal's Test tab or
an HTTP client. This is the same approach as NIMBUS-146.

## Reconciliation Checklist

Before implementation, the implementor MUST verify and reconcile the following:

- [ ] **XML tag naming convention** — whether NIMBUS-147's XML uses camelCase or PascalCase tags.
      Determines `kind="javascript-friendly"` vs `kind="direct"` for `xml-to-json` and the XSD
      element names.
- [ ] **XML root element name** — the XSD uses `<canonicalOrder>` as the root. Verify this
      matches NIMBUS-147's finalized XML representation.
- [ ] **Decimal comma normalization** — whether the XML wire format uses comma decimals
      (e.g. `209,25`). If so, an additional normalization step is needed in the policy after
      `xml-to-json`.
- [ ] **APIM tier** — `validate-content` is available on all tiers but has performance
      implications on Consumption/Developer tiers. Confirm the APIM tier.
- [ ] **Logic App HTTP trigger URL** — replace the placeholder in `apim-policy.xml` with the
      actual URL from NIMBUS-146's deployment.
- [ ] **APIM API/operation structure** — whether this policy attaches to a new API or an
      existing API revision, and the naming/versioning conventions.
- [ ] **JSON Schema draft version** — verify APIM's supported draft version and adjust the
      `$schema` URI if needed.
- [ ] **`schema-ref` for JSON validation** — verify whether `schema-ref="#"` or omitting
      `schema-ref` works for a top-level JSON schema in the APIM version in use.
