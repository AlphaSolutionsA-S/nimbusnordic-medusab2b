# Implementation Manifest: Validate Customer Token and Route Order

**Project ID:** NIMBUS-146
**Date:** 2026-09-02
**Ready for Dispatch:** true

## Branch

`feature/NIMBUS-146-token-validation-routing` (from `develop`)

## Note on scope of this dispatch

This is an Azure Logic App / configuration deliverable — **no code changes to `apps/backend` or
`apps/storefront`**. The "implementation" the implementor agent performs is writing the reference
artifacts (Workflow Definition JSON, schema docs, deployment/test documentation) into
`issues/NIMBUS-146/artifacts/`, exactly as specified in each task file below. There is nothing to
`pnpm build`/`pnpm lint`/`pnpm test` for this dispatch. Actual deployment to Azure is a manual
step performed by the environment owner afterward, per Task 02's `deployment-instructions.md`.

## Tasks

| # | Title | File | App | Depends On | Status |
|---|-------|------|-----|------------|--------|
| 01 | Extend token-list store to carry a customer number | `01-token-list-store-extension-implementation.md` | azure-integration | None | TODO |
| 02 | Logic App workflow — token validation and order routing | `02-logic-app-workflow-implementation.md` | azure-integration | 01 | TODO |
| 03 | Documented test payloads and manual verification plan | `03-test-documentation-implementation.md` | azure-integration | 01, 02 | TODO |

## Deliverables (written under `issues/NIMBUS-146/artifacts/`)

- `token-list-schema.md` (Task 01)
- `logic-app-workflow-definition.json` (Task 02)
- `deployment-instructions.md` (Task 02)
- `test-payloads.md` (Task 03)

## Open items carried into deployment (not resolvable from this repository — see each task's doc)

- Real GlobalLists API/list identity for this project's token list.
- Whether the real GlobalLists list type supports a dedicated `CustomerNumber` property
  (primary vs. fallback token-list design, Task 01).
- Whether this environment's Logic Apps are Consumption or Standard plan, and whether Key Vault is
  provisioned (affects secret-storage mechanism, Task 02).
- NIMBUS-129's Task 05 (`POST /orderapi/orders`) is approved but not yet implemented/deployed —
  blocks full end-to-end execution of Task 03's TC-1/TC-3/TC-4.
