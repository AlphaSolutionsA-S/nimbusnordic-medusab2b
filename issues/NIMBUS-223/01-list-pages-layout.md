# 01: Page keys, Jest stand-in, list pages on the layout
**App:** backend (Admin UI) · **Layer:** Admin UI (`admin/**`) · **Depends on:** None

**Goal:** One shared list of page keys with its prefix rule tested; a Jest stand-in for Medusa's layout component; Approvals, Companies, Quotes and Translations each rendered as `core:single-column` with one named section.
**Files / areas:** a new module in `src/admin/lib/` (page keys); `jest.admin.config.js` and a stand-in under `src/admin/__tests__/`; `routes/{approvals,companies,quotes,translations}/page.tsx`; `ai/skills/medusa-admin/project.md`.
**Seam contracts:** page keys `approval.list`, `company.list`, `company.details`, `quote.list`, `quote.details`, `translation.list`, `shipment_tracking.list`, exported by name from the module; tasks 02–04 import theirs. Stand-in: renders every section's entries in source order (main, then side), exposes the page key, layout id and each entry id (e.g. as data attributes) for assertions, and ignores `data` and widgets.
**Test intent:**
- Unit: every page key is unique and no key is the start of another (asserted over the real exported set).
- The existing Admin suites (translations, company, shipment tracking, widget) still pass with the module mapping in place.
- No render tests for the list pages (one unchanged section is trivial rendering).
**Done when:** the four pages use the layout with keys from the module and fixed section names; `<Toaster />` stays outside `sections`; lint passes; typecheck at or below baseline.
**Verify after deploy:** Admin → Approvals: "Customize page" enters edit mode; hide the section, save, reload → hidden; Default, save → shown.
**Also update:** `ai/skills/medusa-admin/project.md` (custom pages use `LayoutComposer` with a key from the module, fixed `Entry` ids, toast outside sections; tests rely on the stand-in), then `pnpm ai:check`. Docs: none found.

## Deviations
- Added a test case: the module exports exactly the seven planned keys. Why: the uniqueness and prefix checks run over every string export, so this pins the set the seam contract names.
- Stand-in renders only the `main` and `side` sections (the only ones our layouts use) and puts entry ids on the `LayoutComposer.Entry` wrapper as `data-layout-entry` with the raw id (no `core:` prefix Medusa adds when storing). Why: shape choice inside the task; noted for tasks 02–04.
- Key export names chosen: `APPROVAL_LIST_PAGE_KEY`, `COMPANY_LIST_PAGE_KEY`, `COMPANY_DETAILS_PAGE_KEY`, `QUOTE_LIST_PAGE_KEY`, `QUOTE_DETAILS_PAGE_KEY`, `TRANSLATION_LIST_PAGE_KEY`, `SHIPMENT_TRACKING_LIST_PAGE_KEY`. Why: the task fixed the values, not the names.
- Page key for Translations changed from the plan's `translation.list` to `storefront_translation.list` (review finding, dispatcher decision). Why: Medusa's own Translations settings page uses `widgetsZonePrefix: "translation.list"` (`apps/backend/node_modules/@medusajs/dashboard/dist/translation-list-3U36KNVX.mjs:503`), so the two pages would share saved arrangements and widgets. Plan sections 4.01 and 5 still name the old value; the deviation report should list it. The `page-keys.ts` comment and the Admin skill's `project.md` now state the rule against clashing with core prefixes.

## Done-when evidence
- Four pages use the layout with keys from the module and fixed section names: `routes/{approvals,companies,quotes,translations}/page.tsx` render `LayoutComposer` with `CORE_LAYOUT_IDS.SINGLE_COLUMN`, the key from `lib/page-keys.ts` and one `LayoutComposer.Entry` with ids `approvals`, `companies`, `quotes`, `translations`; whole-app `tsc` accepts the props against the real `@medusajs/dashboard/components` types. Edit mode in a browser: browser run (final gate, plan decision 1).
- `<Toaster />` stays outside `sections`: Approvals, Companies and Quotes render it as a sibling of `LayoutComposer` (Translations has none, unchanged).
- Page keys unique, none a prefix of another: `src/admin/lib/__tests__/page-keys.test.tsx` ("are unique", "never start with another key", "exports one key for each customizable page").
- Existing Admin suites pass with the module mapping: `pnpm --filter @b2b-starter/backend test:admin` 8 suites, 62 tests passed (translations, company order-api setting, shipment tracking, BC widget, page keys).
- Lint passes: `pnpm --filter @b2b-starter/backend lint` 0 errors (13 pre-existing warnings, none in touched files).
- Typecheck at or below baseline: 22 errors, the same set as `tsc-baseline.txt`.
- Also update `ai/skills/medusa-admin/project.md`: added the custom-page layout pattern (LayoutComposer, key from `lib/page-keys.ts`, fixed `Entry` ids, toast outside sections, Jest stand-in and its attributes); `pnpm ai:check` passed. Docs: none found.
