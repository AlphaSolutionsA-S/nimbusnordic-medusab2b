# 03: Admin action, outcome toasts, last-synced row and banner text
**App:** backend (Admin UI) · **Layer:** Admin UI (`admin/**`, HTTP via `admin/lib/client.ts`) · **Depends on:** 02

**Goal:** add a "Sync from Business Central" action to the company "..." menu. Without a BC customer
number it is disabled, with a tooltip. Show one toast per outcome, refetch the company afterwards,
add a "Last synced from Business Central" row, and update the banner text.
**Files / areas:** `apps/backend/src/admin/hooks/api/companies.tsx`,
`apps/backend/src/admin/components/common/action-menu.tsx` (optional per-action tooltip),
`apps/backend/src/admin/routes/companies/components/company-actions-menu.tsx`,
`apps/backend/src/admin/routes/companies/[companyId]/page.tsx`,
`apps/backend/src/admin/routes/companies/bc-managed-fields.ts`, tests in
`apps/backend/src/admin/routes/companies/__tests__/`.
**Seam contracts:** the hook posts `{}` to the task 02 route and types the response with the task 02
response type. After any response it invalidates `companyQueryKey.detail(id)` and `.lists()`. The
last-synced value arrives as an ISO string or `null`. `QueryCompany` declares `Date`, so convert
with `new Date(...)`.
**Test intent:** (Admin RTL, mocking only `sdk.client.fetch`):
- With a BC number, clicking the action posts to `/admin/companies/comp_1/sync-business-central`.
  An `updated` response shows a success toast, and the page shows the refetched values and
  last-synced time.
- `skipped` shows "Nothing to sync". `failed` shows an error saying nothing was changed. A rejected
  fetch shows a generic error.
- Without a BC number the item is disabled, the tooltip text is reachable, and clicking makes no
  POST.
- The last-synced row shows "Never" for `null` and a formatted date for an ISO string.
- The banner test in `bc-managed-fields.unit.spec.ts` asserts the new wording: login or company
  page, plus the Admin action.
**Done when:** `test:admin` and the unit spec pass, lint passes and typecheck adds no new errors. The
action menu's existing actions behave as before.
**Verify after deploy:** on the Admin page of one company with a BC customer number, the "Last
synced from Business Central" row shows the time of a sync run there. Check the storefront company
card after about 120 s.
**Also update:** `apps/backend/src/admin/routes/companies/__tests__/bc-managed-fields.unit.spec.ts`
(asserts "customer from this company logs in"), `company-details-layout.test.tsx` (asserts the
banner text by constant; it stays valid). `docs/architecture/admin-page-layout.md` lists the entry
ids, and those are unchanged, so no edit. The comment on `BC_MANAGED_COMPANY_FIELDS` needs the new
wording.

## Deviations
- `ActionMenu` now ignores a click on a disabled `onClick` action. Why: Radix `DropdownMenu.Item`
  calls `props.onClick` even when disabled (verified: `@radix-ui/react-menu` `dist/index.mjs`,
  `composeEventHandlers(props.onClick, handleSelect)`); only `pointer-events: none` blocked it in a
  browser. No existing action sets `disabled`, so existing actions are unchanged.
- The tooltip wrapper brings its own `TooltipProvider` (Radix tooltips need one; the Admin tests
  render without the dashboard's).
- Added a case: the four existing menu actions are still present and enabled.
- The hook spreads caller options first and chains `onSettled`, rather than the file's existing
  `onSuccess` + trailing `...options` pattern (which lets a caller's handler drop the invalidation).
- Skipped toast reason names only "BC has no customer for this number"; the no-number case is
  unreachable from the UI (action disabled).

## Done-when evidence
- `test:admin` passes: `company-bc-sync.test.tsx` (8 tests) and the whole Admin suite (11 suites,
  79 tests).
  - POST to `/admin/companies/comp_1/sync-business-central` with `{}`, success toast, refetched
    values and last-synced: "posts an empty body for the company and shows the refetched values and
    last-synced time".
  - `skipped` / `failed` toasts and refetch: "shows the %s outcome and refetches the company";
    rejected fetch: "shows a generic error when the sync request fails".
  - Disabled, tooltip, no POST: "disables the action without a BC customer number, explains why and
    makes no request".
  - Last-synced row: "Company page: last synced from Business Central › shows %s as %s".
- Unit spec passes: `bc-managed-fields.unit.spec.ts` "warns that Business Central is authoritative
  and names every sync trigger".
- Existing actions behave as before: "keeps the existing menu actions"; `company-details-layout`
  and `company-order-api-setting` suites still pass.
- Lint: 0 errors (13 pre-existing warnings, none in touched files). Typecheck: 22 errors, baseline 22
  (identical list).
- Also update: `bc-managed-fields.unit.spec.ts` asserts the new wording (login or company page,
  plus the Admin action); `company-details-layout.test.tsx` asserts by constant, unchanged and
  passing; `docs/architecture/admin-page-layout.md` entry ids unchanged, no edit; the
  `BC_MANAGED_COMPANY_FIELDS` comment now names all three triggers.
- Verify after deploy: not provable in this task (needs a deployed Admin and BC).
