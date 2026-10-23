# Plan: Customize page on all custom Medusa Admin pages

> Record of NIMBUS-223, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Key:** NIMBUS-223 · **Scope:** `scope.md` (approved 2026-10-23) · **Branch:** `feature/NIMBUS-223` from `develop`

## 1. Summary [High]

Our seven custom Admin pages (Approvals, Companies, Company details, Quotes, Quote details,
Translations, Shipment tracking) are wrapped in Medusa's own page-layout component, so the
top bar's "Customize page" works on them exactly as on Medusa's pages: reorder, hide, Personal or
Default, saved on the server per admin user. The work is Admin UI only: no backend code, endpoint,
table or migration of ours; Medusa's built-in settings module stores the arrangements.

Three decisions shape it. Each page gets a fixed page key from one shared list, so the rule "no key
is the start of another" is checked in one test. Each section gets a fixed, hand-written name, so
saved arrangements survive renames and minification. Admin tests do not load Medusa's dashboard
(it cannot run under Jest); a small stand-in renders the sections in their default order.

The scope's open runtime question is mostly settled by a probe run while planning: with the
Approvals page wrapped, the production build passed and the built Admin bundle contains one shared
copy of Medusa's dashboard context. What is left is a five-minute click-through in a browser
(item 1 under Needs your decision).

**How to review this plan.** This plan is the human review gate: approving it is what allows
dispatch. Each heading carries a review level (Critical, High, Medium). Answer the item under
"Needs your decision" and stop at the `Critical` flag in section 9 (the browser run). The data
model and state tables are rated High because past misses were found there; here they are short,
since all data is Medusa's. The task files hold more depth but are not required reading. An
uncertainty is often quicker to settle by asking the planning agent in chat than by reading further.

## 2. Needs your decision [Critical]

1. **Browser run of "Customize page" on our pages** (enter edit mode, hide, save, reload, Default,
   save). Not run while planning: no browser or database in the planning session. Build and bundle
   evidence is in section 9. *Default:* dispatch now; you do the click-through on the branch at the
   final gate before push (dev server, every page), and a failure there stops the push. The
   alternative is to run it now on Approvals before dispatch.
   **Answer (Klaus, 2026-10-23):** default. Dispatch now; Klaus runs the click-through on every page
   at the final gate, and a failure stops the push.

## 3. Flows [High]

### A. Customize a page (tasks 01–04)
1. An admin user opens one of our pages. The page's layout component asks Medusa for the saved
   arrangement of that page key: the user's personal one, the shared default and which of the two
   is active. Until anything is saved, the sections show in today's order.
2. The user chooses "Customize page" in the top bar. The page enters edit mode; Personal or Default,
   Cancel and Save replace the menu in the top bar.
3. The user drags sections into a new order and hides or shows them. The draft lives in the browser
   only; Cancel discards it.
4. Save with Personal stores the arrangement in Medusa's settings store against page key and admin
   user. Save with Default ("Save for everyone") asks for confirmation, then stores it as the page
   key's shared default.
5. On the next visit, from any browser, the page reads the arrangement back (A1) and shows it.
   Hidden sections are not shown, but their data is still loaded.

### B. Return to the standard arrangement (tasks 01–04)
1. In edit mode (A2) the user chooses Default and saves. Their active view becomes the shared
   default; their personal arrangement is kept but no longer shown.

### C. A page whose sections changed in a later release (tasks 01–04)
1. A saved arrangement naming a section that no longer exists is ignored for that section.
2. A section with no saved position (new, or the quote-accepted notice seen for the first time)
   is shown at the top of its column, as on Medusa's pages.

## 4. What gets built [High]

### 01. Shared page keys, test stand-in and the four list pages
One Admin module holds the seven page keys (`approval.list`, `company.list`, `company.details`,
`quote.list`, `quote.details`, `translation.list`, `shipment_tracking.list`), with a test that every
key is unique and none is the start of another (Medusa matches widget places by plain prefix). A
Jest stand-in for Medusa's layout component, wired into the Admin test configuration, renders the
sections in default order and exposes the page key and section names, so page tests run without the
dashboard. The Approvals, Companies, Quotes and Translations pages each become a single-column
layout with one named section holding today's content. The toast area stays outside the sections:
everything inside a section becomes a movable entry. The Admin skill's `project.md` gains the
pattern for new pages.

### 02. Shipment tracking
Single column with two named sections, "Shipments that gave up" (with Retry and the page heading)
and "All shipments", in today's order. The existing page test keeps every case and gains one check
of the page key and the two section names in default order.

### 03. Company details
Single column with three named sections: the Business Central warning, company information (header
with actions and the details table) and employees, in that default order; all three movable and
hideable. The company record is passed to the layout so future widgets on `company.details` receive
it, as on Medusa's detail pages. "Company not found" while loading stays as today.

### 04. Quote details
Two columns. Main: the "Quote accepted" notice (an entry only while the quote is accepted), the
quote (header, items, costs, total, Reject and Send), messages, JSON. Side: customer, company. The
quote is passed to the layout for future widgets. Loading and error handling stay before the layout.
Medusa's two-column layout replaces our hand-written columns, so the side column is 440 px wide from
extra-large screens up (accepted in scope).

## 5. Data model [High]

No data of ours. All rows are Medusa's settings module (core, `@medusajs/settings` 2.21.2).

| Entity / field | Key and meaning | Existing callers | Owner | Written by | Stored | Mutable until | Retention | Index |
|---|---|---|---|---|---|---|---|---|
| `layout_configuration` (personal) | `zone` = our page key, `user_id`; `configuration.widgets[<entry id>]` = order, section, hidden | Medusa's own pages | settings module | the admin user's browser via `POST /admin/layouts/:zone/configuration` | stored, not encrypted | never frozen | kept on admin user deletion (core delete-users workflow has no settings step) | unique (`zone`, `user_id`) |
| `layout_configuration` (default) | `zone`, `user_id` null, `is_system_default` true | as above | settings module | any admin user, "Save for everyone" | stored | never frozen | until overwritten | unique `zone` where default |
| Active view | user + zone: personal or default | as above | settings module | Medusa, on save | stored | never frozen | as above | — |
| Page key | one per page, list in task 01 | none (new) | Admin code | code | fixed in code | — | — | — |
| Entry id | stored as `core:<name>`, e.g. `core:company-information` | none (new) | Admin code | code | fixed in code | renaming one drops users' saved position for it | — | — |

Cardinality: one personal row per admin user per page key, at most one default per page key.

## 6. Business rules as state tables [High]

Arrangement of one page key for one admin user:

| State | Event | Outcome | Side effects |
|---|---|---|---|
| nothing saved | open page | sections in source order | none |
| any | Save, Personal | personal row written, active view personal | none for other users |
| any | Save, Default, after confirmation | default row written | every user whose active view is default sees it; users on Personal unchanged |
| personal active | choose Default, Save | active view default | personal row kept, not shown |
| any | Cancel | nothing written | none |
| saved | section renamed or removed in code | that saved entry ignored | none |

Write permission: any logged-in admin user, for Personal and Default (Medusa's rule; accepted in
scope). Actor recorded: the admin user id on the personal row; the default row records none.

## 7. Security-property matrix [High]

Not a security change; no control is added, so no negative test is required.

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| Hiding is not access control | none by design; data still loaded | admin session | hidden data reachable by anyone who can open the page, as today | none (by design) |
| Widgets on our pages see only what the user sees | widgets run in the same admin session | admin session | n/a; no widget added | none |
| Shared default can be changed by any admin | Medusa's own rule, unchanged | admin session | a bad default affects users on Default; any admin can save a new one | none (accepted) |
| No personal data in arrangements | only page key, entry names, positions, user id | — | — | none |

## 8. Decisions [High for new, Medium for scope]

New in this plan:
- Page keys live in one module with a uniqueness and prefix test; section names are literals in each
  page. Why: the prefix rule spans pages; names are local. Source: `dashboard-app.tsx`
  `getWidgetsForSections` (verified).
- Admin tests use a Jest stand-in for `@medusajs/dashboard/components` (module mapping in the Admin
  Jest config). Why: the real package fails to load under jsdom (verified by probe, section 9).
  The stand-in renders, it asserts no Medusa behaviour; edit mode and saving are Medusa's and are
  checked in the browser.
- The toast area and anything not meant to be movable stays outside `sections`. Why: every element
  in a section becomes an entry (verified, `entries.ts`).
- Detail pages pass their record (`company`, `quote`) as the layout's data, as Medusa's detail pages
  do. Why: exposing standard widget places was agreed; without data a widget there gets nothing.
- `hasOutlet` left at its default. Why: our routes have no child routes, so the outlet renders
  nothing (verified, admin-vite-plugin nests only `/@` folders).
- The quote-accepted notice is an entry only while the quote is accepted. Why: today it is shown
  only then; a user positions it while viewing an accepted quote, and the position then applies to
  all accepted quotes.
- No separate list-page render tests. Why: one section of unchanged content is trivial rendering
  (`verification.md`); the browser check covers it.

From the scope: presentation only, no behaviour change; Business Central warning movable and
hideable, first by default; any admin may "Save for everyone"; Manage quote out of scope; standard
widget places, no widget added; Medusa spacing and widths accepted; section split as proposed.

Does the framework already do this? Yes, entirely: `LayoutComposer` and the settings module do
storage, edit mode and widget places; we add no storage, endpoint or reset button. No framework
internal is called; `@medusajs/dashboard/components` is the documented public export.

## 9. Framework assumptions [Medium; Critical for row 8]

| # | Primitive | Verified behaviour | Evidence |
|---|---|---|---|
| 1 | `LayoutComposer`, `LayoutComposer.Entry` from `@medusajs/dashboard/components` | props `widgetsZonePrefix`, `preferredLayoutId`, `sections`, `data`, `hasOutlet` (default true), `disableWidgets` | verified: `dashboard/dist/components.d.ts`, `src/exports/components.tsx` |
| 2 | Entries | each direct child of a section (fragments unwrapped) is an entry; id `core:<Entry id>`, else component name; falsy children skipped | verified: `src/components/layout-composer/entries.ts` |
| 3 | Saved preference | unknown ids ignored; entries without saved order get order 0, stable sort, so new entries show first | verified: `entries.ts` `buildDisplayEntries` |
| 4 | Storage | `/admin/layouts/:zone/configuration`; `layout_configuration` unique per (`zone`, `user_id`), one default per zone; any zone string | verified: `hooks/api/layouts.tsx`, `@medusajs/settings` `models/layout-configuration.js` |
| 5 | Widget places | zone matched by `startsWith(pageKey)`; `.before`/`.after` stripped | verified: `src/dashboard-app/dashboard-app.tsx` |
| 6 | Layouts | `core:single-column` (`gap-y-3`); `core:two-column` (xl grid, 440 px side) | verified: `components/layout/pages/*`, `admin-shared` `CORE_LAYOUT_IDS` |
| 7 | Our Admin bundle | importing `@medusajs/dashboard/components` builds; one shared dashboard context at runtime | verified by probe: Approvals wrapped, `pnpm build` exit 0; built `.medusa/server/public/admin/assets/index-*.js` holds the `useExtension` provider error string once, in the same file as `approval.list`. Probe reverted. |
| 8 | **Critical:** menu drives our pages into edit mode; save, reload, Default | same component and context as Medusa's pages (rows 1, 7) | **UNVERIFIED** in a browser: see Needs your decision 1 |
| 9 | Jest | real dashboard fails under jsdom (`TransformStream is not defined` via `@medusajs/js-sdk`) and needs a non-exported provider | verified by a throwaway test run, removed |

## 10. Open risks and gates [Medium]

| Risk | Owner | Blocking |
|---|---|---|
| Browser run (row 8) fails on our pages | Klaus, at the final gate | blocks push (see decision 1) |
| Backend `tsc --noEmit` fails today (baseline) | worker, per task | no; at or below baseline |
| Hiding the first section also hides the page heading (Shipment tracking, Company details), as on Medusa's pages | Klaus | no; accepted (Klaus, 2026-10-23) |
