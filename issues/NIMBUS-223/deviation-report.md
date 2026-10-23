# Deviation report: Customize page on all custom Medusa Admin pages

Branch `feature/NIMBUS-223`, merge-base `c43aabf`, HEAD `4c46b82` (5 commits after the plan commit:
NIMBUS-224 to NIMBUS-227 and the consolidation). Tree clean. No architecture check is configured.

## Deviations from scope and plan

- **Translations page key is `storefront_translation.list`, not `translation.list`** (plan 4.01 and
  section 5). Why: Medusa's own Translations settings page uses `widgetsZonePrefix:
  "translation.list"` (`@medusajs/dashboard/dist/translation-list-3U36KNVX.mjs:503`), so both pages
  would share saved arrangements and widget places. **Accepted** (confirmed by Klaus Petersen). The
  rule against clashing with core prefixes is now stated in `apps/backend/src/admin/lib/page-keys.ts`
  and `ai/skills/medusa-admin/project.md`. Plan sections 4.01 and 5 still name the old value; the plan
  is a frozen record and is not edited.
- Task 01: page-key test also pins the exact set of seven keys (its checks run over every string
  export). Acceptable: makes an accidental extra export fail loudly.
- Task 01: stand-in renders only `main` and `side` sections and marks each `LayoutComposer.Entry`
  with `data-layout-entry="<raw id>"` (no `core:` prefix). Acceptable: test-only shape.
- Task 01: export names `APPROVAL_LIST_PAGE_KEY` … `SHIPMENT_TRACKING_LIST_PAGE_KEY` chosen by the
  worker (plan fixed values only). Acceptable.
- Task 02: given-up block extracted into `GivenUpShipments`; the old `flex flex-col gap-y-3`
  wrapper dropped (Medusa's single-column layout spaces entries). Entry ids `given-up-shipments`,
  `all-shipments`. Acceptable.
- Task 03: new test file `company-details-layout.test.tsx` (existing `company-order-api-setting`
  test unchanged); added cases for the loading path ("Company not found", no layout) and the
  employees empty state. Entry ids `business-central-warning`, `company-information`, `employees`.
  Acceptable.
- Task 03: one observed, not reproduced, failure of the create-drawer Save click in
  `company-order-api-setting.test.tsx` during a combined run (passed alone and 3 later combined runs;
  finalization run green). Recorded as a possible timing flake, unrelated to the layout.
- Task 04: added guard case "renders no layout while the order preview is loading"; preview mock is
  a plain `jest.fn()` forwarded from the `lib/client` mock to avoid a cast (`NO_UNKNOWN_CAST`). Entry
  ids main `quote-accepted`, `quote`, `messages`, `json`; side `customer`, `company`. Acceptable.

No blocking deviations: no migration, no backend code outside `src/admin/**`, no new dependency
(`@medusajs/dashboard` and `@medusajs/admin-shared` 2.21.2 were already in `apps/backend/package.json`).

## Consolidation changes

Test-only. The duplicated layout helpers (`entry`, `entryIds`, `section`) in the company details,
quote details and shipment-tracking tests moved to `apps/backend/src/admin/__tests__/layout-queries.ts`
(`layoutEntry`, `layoutEntryIds`, `layoutSection`), next to the Jest stand-in. The shipment case now
selects entries by id instead of index. No assertion changed. `ai/skills/medusa-admin/project.md`
names the helper. No dead exports, no redundant tests, no cross-task test gaps found.

## Findings

Design against the plan:

- Page keys (plan 4.01, 9 row 5): all seven pages use a key from `lib/page-keys.ts`; every export is
  imported by exactly one page. Checked against every `widgetsZonePrefix` in the installed
  `@medusajs/dashboard/dist`: none of our keys equals, starts or is started by a core prefix
  (`company.`, `quote.`, `approval.`, `shipment_tracking.`, `storefront_translation.` have no core
  counterpart). OK.
- Sections and entries (plan 4, 9 row 2): section split matches the scope on every page; every
  section child is a `LayoutComposer.Entry` with a fixed literal id; the conditional quote-accepted
  entry yields `false` when not accepted, which Medusa skips (row 2). OK.
- `<Toaster />` outside `sections` on Approvals, Companies, Quotes, Company details, Quote details;
  Translations and Shipment tracking had none before and still have none. OK.
- Detail pages pass `data={company}` / `data={quote}` (plan 8). Not testable through the stand-in;
  verified by code read.
- Early returns stay before the layout: Company details `if (!company) return <div>Company not
  found</div>`; Quote details loading, preview-loading and `throw "preview not found"` unchanged and
  tested. OK.
- Data model and state tables (plan 5, 6): no data of ours; nothing writes to Medusa's settings
  module from our code. Nothing to check beyond the browser run.
- Security matrix (plan 7): no control added, none required; hidden sections still load their data,
  as planned. No security-relevant path changed.
- Business rules: the only new rule (page keys unique, no prefix clash) has one home,
  `lib/page-keys.ts` with its test. It is an Admin-code convention, not a business rule for
  `decisions.md`.

Mechanical wiring: imports resolve from public entry points (`@medusajs/dashboard/components`,
`@medusajs/admin-shared`), build exit 0; stand-in mapped by exact regex in `jest.admin.config.js`;
`layout-queries.ts` and `dashboard-components.tsx` do not match `testMatch` (`*.test.tsx`) so they
are not run as suites; no casts added outside test fixtures (`as QueryEmployee` / `as QueryCompany`
on test data only); no dead exports; no duplicate pages or routes; `git status` clean; comments
cite only the issue key; Tier 0 whole-branch checks (module registration, `ensure-role`,
`jsx-no-literals`, `NEXT_PUBLIC_*`) do not apply (Admin UI only, no store route, no storefront change).
"Also update" search: `docs/architecture/order-api/shipment-notices.md` and `order-api/overview.md`
rows for these pages remain accurate; no doc names the page layout.

Low, informational (no change required):

1. `apps/backend/src/admin/routes/shipment-tracking/__tests__/page.test.tsx:789-790` asserts the
   literals `"shipment_tracking.list"` and `"core:single-column"`, while the company and quote tests
   use `COMPANY_DETAILS_PAGE_KEY` / `CORE_LAYOUT_IDS`. Both are valid (the literal pins the stored
   value); only a style inconsistency.
2. `ai/skills/medusa-admin/project.md:14` is one over-long line after the edit (wrapping only).

## Tests

- Finalization: `pnpm --filter @b2b-starter/backend test:admin` 10 suites, 70 tests passed;
  typecheck 22 errors = baseline 22 (same set); `build` exit 0; lint 0 errors (13 pre-existing
  warnings).
- Security-path coverage: no security-critical path on this branch (presentation only; plan 7).
- New tests: page-key uniqueness/prefix/set (`lib/__tests__/page-keys.test.tsx`); company details
  layout (4 cases); quote details layout (3 cases); shipment tracking layout (1 case added, existing
  cases unchanged). List pages have no render test, by plan decision (section 8).
- What tests cannot prove: the stand-in asserts default order and attributes only; edit mode,
  saving, reload, Default and widget `data` are Medusa's runtime behaviour and are covered only by
  the browser run below.
- Volume: tests about +412 lines; source +567/-443 (net about +124, mostly re-indentation into
  `LayoutComposer.Entry`). No duplicated or redundant tests after consolidation.

## Open questions

1. **Browser click-through of "Customize page" on every page (plan decision 1; framework
   assumption row 8, UNVERIFIED).** Klaus runs it at this gate on the branch with the dev server:
   on Approvals, Companies, Company details, Quotes, Quote details, Translations and Shipment
   tracking, choose "Customize page", reorder and hide a section, save Personal, reload, then choose
   Default and save. Also confirm the Translations page and Medusa's Settings → Translations page
   keep separate arrangements. Options: pass → push; fail on any page → stop the push and return the
   branch to the pipeline.

## Verify after deploy

- 01 Page keys, Jest stand-in, list pages on the layout: Admin → Approvals: "Customize page" enters
  edit mode; hide the section, save, reload → hidden; Default, save → shown.
- 02 Shipment tracking in two sections: Admin → Shipment tracking: move "All shipments" above the
  given-up list, save Personal, reload in another browser → order kept.
- 03 Company details in three sections: Admin → Companies → any company: hide the Business Central
  warning, save, reload → hidden; Default, save → shown first.
- 04 Quote details in two columns: Admin → Quotes → an accepted quote: move Company above Customer in
  the side column, save, reload → kept; side column 440 px at extra-large width.
