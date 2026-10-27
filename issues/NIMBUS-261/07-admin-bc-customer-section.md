# 07: Admin "Business Central customer" section
**App:** backend (Admin UI) · **Layer:** Admin UI over HTTP (`admin/lib/client.ts`) · **Depends on:** 06

**Goal:** The Admin company page shows a "Business Central customer" section with the routed environment, the not-found record, the two-environment check and "Use this customer".
**Files / areas:** `admin/routes/companies/[companyId]/page.tsx`, a new component under `admin/routes/companies/components/`, `admin/hooks/api/companies.tsx` (or a sibling hook file), `admin/routes/companies/__tests__/`.
**Seam contracts:** the three task 06 routes and their response types from `types/company/http.ts`. New `LayoutComposer.Entry` with a fixed, hand-written id (for example `business-central-customer`), placed after `company-information`; `<Toaster />` stays outside `sections` (`medusa-admin` `project.md`).
**Test intent:**
- Admin UI (`test:admin`, client mocked): shows the routed environment and the not-found time, environment and number; no record → none shown.
- Check button disabled without a customer number; the lookup runs only on click.
- Results: found in one → one "Use this customer"; found in both (the normal case for a Norwegian customer: same number, same customer) → both actions and no warning; found in neither → message, no action; `could_not_check` shown per environment beside the other's result.
- `routes_elsewhere` → a warning and a confirmation before the POST; cancel → no POST; confirm → POST with only `{ environment }`.
- After the POST: outcome toast per status, and the company and section queries are invalidated.
**Done when:** layout tests still find every existing entry plus the new one, and typecheck shows no new errors.
**Verify after deploy:** the section on one Norwegian test company's page shows "NO" as routed environment after "Use this customer".
**Also update:** `admin/routes/companies/__tests__/company-details-layout.test.tsx` (entry list); `company-bc-sync.test.tsx` if it asserts the page's entries; `docs/architecture/admin-page-layout.md` line 32 (company details entry ids gain the new id).

## Deviations

- The lookup is a `useQuery` with `enabled: false`, run by `refetch()` on click, not a mutation; its key carries the company's current customer number, so results for an old number disappear after the number is edited. Why: a read that changes nothing, and it never runs on mount or on invalidation (disabled queries are not refetched).
- The section's status query key sits under the company detail key (`[...companyQueryKey.detail(id), "business-central-customer"]`), so the existing menu sync and the edit drawer also reload it, not only "Use this customer". Added test "reloads the section after Sync from Business Central". Why: the sync writes or clears the not-found record and the edit can move the routed environment; without this the section would show stale values.
- The check button and the per-environment "Use this customer" actions live in the section itself (header and result rows), not in the company actions menu; the plan's "next to the existing sync action in the menu" is read as placement below company information. Why: the results and their actions belong together; the menu only holds one-click actions.
- Added test cases beyond the intent: a failed lookup request shows an error; a 404 from "Use this customer" explains that the card is gone and still reloads; a card that routes to its own environment posts without a confirmation.
- Tests build the SDK's `FetchError` shape (`Error` with `status`) instead of importing the class: `@medusajs/js-sdk` cannot load under jsdom (needs `TransformStream`). The hook imports `FetchError` as a type only.
- `company-bc-sync.test.tsx` and `company-details-layout.test.tsx` answered every company GET with `{ company }`; their fetch mocks now also answer the new status read (`/business-central-customer`). No assertion changed except the layout entry list.

## Done-when evidence

- Layout tests find every existing entry plus the new one: `admin/routes/companies/__tests__/company-details-layout.test.tsx` › "renders the warning, company information, Business Central customer and employees as entries, in that order, under company.details" (passes).
- Typecheck shows no new errors: `tsc --noEmit -p apps/backend` 22 errors, all in `apps/backend/integration-tests` (baseline 22); `tsc --noEmit -p apps/backend/src/admin` exit 0.
- Test intent, all in `admin/routes/companies/__tests__/company-bc-customer.test.tsx`:
  - routed environment and not-found time, environment, number: "shows the routed environment and the not-found time, environment and number"; no record: "shows no not-found record when there is none".
  - check disabled without a number: "disables the check without a customer number and makes no lookup"; lookup only on click: "runs the lookup only on click".
  - found in one: "offers one Use this customer when the card is found in one environment"; found in both: "offers both actions and no warning when the card is found in both"; neither: "shows a message and no action when the card is found in neither"; `could_not_check`: "shows could not check per environment beside the other environment's result".
  - routes elsewhere: "warns when the card routes elsewhere and posts nothing when the confirmation is cancelled", "posts only the environment after the routes-elsewhere confirmation" (body exactly `{ environment: "DK" }`).
  - outcome toast per status and reload of company and section: "shows the updated/skipped/failed outcome and reloads the company and the section".
- Verify after deploy (NO shown as routed environment after "Use this customer" on a Norwegian test company): not provable in this task: needs a deployed backend with the NO configuration and a TestNO card.
- Also update: `company-details-layout.test.tsx`: entry list gains `business-central-customer`, fetch mock serves the status read. `company-bc-sync.test.tsx`: it does not assert the page's entries; only its fetch mock now serves the status read (the old mock answered it with `{ company }`). `docs/architecture/admin-page-layout.md` line 32: company details entries now list `business-central-customer` after `company-information`.
