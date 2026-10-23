# 02: Admin UI for the order API setting
**App:** backend (Admin UI) · **Layer:** Admin UI over `admin/lib/client.ts` · **Issue:** NIMBUS-219 · **Depends on:** 01

**Goal:** Staff see "Order API: Enabled / Disabled" on the company detail page and switch it in the edit drawer; the create drawer has no switch.
**Files / areas:** `src/admin/routes/companies/[companyId]/page.tsx`, `src/admin/routes/companies/components/{company-form,company-update-drawer}.tsx`, existing `src/admin/components/common/cool-switch.tsx`.
**Seam contracts:** Admin update body field `order_api_enabled: boolean` (task 01). The setting is Medusa-only: no Business Central-managed indicator, not in `BC_MANAGED_COMPANY_FIELDS`.
**Test intent:**
- Admin component test: the detail page renders Enabled for `true` and Disabled for `false`.
- Admin component test: in edit mode, toggling the switch and saving submits `order_api_enabled` with the new boolean; in create mode no switch is rendered and the submitted data has no `order_api_enabled`.
**Done when:** tests pass; `test:admin` for the touched folder green; lint and typecheck at or below baseline.
**Verify after deploy:** Admin company page of one API company shows the row, and switching it changes `company.order_api_enabled` for that row.
**Also update:** `src/admin/routes/companies/__tests__/` (new test file); `src/admin/routes/companies/__tests__/bc-managed-fields.unit.spec.ts` only if it enumerates all company fields; none found otherwise.

## Deviations

- The create-mode test (no switch, no `order_api_enabled` in the POST body) passed before the implementation: the form starts from `{}` in create mode, so that behaviour already held; kept as a regression guard for the edit-only switch.
- Added a test case the intent did not name: switching from `true` to `false` submits `false` (both directions covered), and the detail row carries no Business Central-managed indicator (seam contract).

## Done-when evidence

- Detail page shows Enabled / Disabled: `src/admin/routes/companies/__tests__/company-order-api-setting.test.tsx` "shows order_api_enabled=true as Enabled", "shows order_api_enabled=false as Disabled".
- Edit drawer switch submits the new boolean: same file, "edit drawer: switching from false submits order_api_enabled=true" and "... from true submits order_api_enabled=false" (asserts the POST body to `/admin/companies/comp_1` through `useUpdateCompany`).
- Create drawer has no switch and submits no field: same file, "create drawer: renders no switch and submits no order_api_enabled".
- No BC-managed indicator, not in `BC_MANAGED_COMPANY_FIELDS`: detail test asserts no indicator on the row; `bc-managed-fields.ts` unchanged.
- `test:admin` for `src/admin/routes/companies`: 5 passed, 0 failed.
- Lint: 0 errors (13 pre-existing warnings, none in touched files). Typecheck: 22 errors, baseline 22.
- Also update `src/admin/routes/companies/__tests__/`: new test file added.
- Also update `bc-managed-fields.unit.spec.ts`: no change; it enumerates only the twelve BC-managed fields, not all company fields.
- Verify after deploy (Admin page of an API company shows the row; switching changes `company.order_api_enabled`): not provable in this task: needs a deployed backend with the task 01 migration applied.
