# 02: Admin UI for the order API setting
**App:** backend (Admin UI) · **Layer:** Admin UI over `admin/lib/client.ts` · **Depends on:** 01

**Goal:** Staff see "Order API: Enabled / Disabled" on the company detail page and switch it in the edit drawer; the create drawer has no switch.
**Files / areas:** `src/admin/routes/companies/[companyId]/page.tsx`, `src/admin/routes/companies/components/{company-form,company-update-drawer}.tsx`, existing `src/admin/components/common/cool-switch.tsx`.
**Seam contracts:** Admin update body field `order_api_enabled: boolean` (task 01). The setting is Medusa-only: no Business Central-managed indicator, not in `BC_MANAGED_COMPANY_FIELDS`.
**Test intent:**
- Admin component test: the detail page renders Enabled for `true` and Disabled for `false`.
- Admin component test: in edit mode, toggling the switch and saving submits `order_api_enabled` with the new boolean; in create mode no switch is rendered and the submitted data has no `order_api_enabled`.
**Done when:** tests pass; `test:admin` for the touched folder green; lint and typecheck at or below baseline.
**Verify after deploy:** Admin company page of one API company shows the row, and switching it changes `company.order_api_enabled` for that row.
**Also update:** `src/admin/routes/companies/__tests__/` (new test file); `src/admin/routes/companies/__tests__/bc-managed-fields.unit.spec.ts` only if it enumerates all company fields; none found otherwise.
