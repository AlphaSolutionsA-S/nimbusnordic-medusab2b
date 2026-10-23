# Customize page on all custom Medusa Admin pages

**Date:** 2026-10-23
**Status:** Approved (Klaus Petersen, 2026-10-23)
**Type:** Story
**Priority:** Should
**Parent:** NIMBUS-123
**Issue:** NIMBUS-223
**Key:** NIMBUS-223
**Case folder:** issues/NIMBUS-223/
**Base Branch:** develop

## Background

Medusa Admin's top bar has a "Customize page" option. On Medusa's own pages it switches the page into
edit mode, where an admin user can drag the page's sections into a new order, hide sections, and save
the arrangement for themselves ("Personal") or for every admin user ("Default", saved after a
"Save for everyone" confirmation). On our own Admin pages (Approvals, Companies, Company details,
Quotes, Quote details, Manage quote, Translations, Shipment tracking) the option is shown but does
nothing, because those pages do not use Medusa's page-layout component.

Verified from the installed Medusa packages (2.21.2) and the Medusa documentation:

- The page-layout component (`LayoutComposer`) is a **documented** Medusa Admin component (since
  Medusa 2.16), meant for exactly this: custom Admin pages that support "Customize page" and expose
  their own places where Admin extensions (widgets) can add sections. This corrects the triage note
  in `feature.md`, which called it undocumented.
- The "Customize page" menu item always asks the page's layout component to enter edit mode; a page
  without one ignores the request. This is the cause of the reported behaviour.
- Arrangements are stored by the Medusa backend in its own settings store (database), per page key
  and per admin user, plus one shared default per page. The page key is free text, so our pages get
  their own keys without any backend code of ours. The same store already serves Medusa's pages.
- "Reset": Medusa's pages have no separate reset button. A user returns to the standard arrangement
  by choosing "Default" in edit mode and saving; their personal arrangement is then no longer shown.
  Our pages get exactly this behaviour.

## Requirements

### Functional

1. On each in-scope page (see Proposed structure), choosing "Customize page" enters edit mode, the
   same way as on Medusa's own pages: drag to reorder, hide or show a section, Personal or Default,
   Cancel, Save.
2. A saved arrangement is shown when the same user comes back to the page, on any browser or device
   (it is stored on the server, not in the browser).
3. A user can return to the standard arrangement by choosing "Default" and saving.
4. Until anyone customizes a page, it shows the same sections in the same order as today.
5. Each page is split into the sections listed under Proposed structure (draft, to confirm).
6. Each page exposes Medusa's standard places for Admin extensions (widgets) to add sections, under
   its own page key. No widget is added in this story.
7. Nothing on the pages behaves differently: the same data, actions, permissions and messages.

### Non-functional

- A saved arrangement survives new releases: each section has a fixed name of its own, so renaming
  or minifying code does not silently discard users' saved arrangements.
- No new backend code, endpoint, table or migration; no change to the storefront or the CMS.
- Medusa's standard page layout replaces our hand-written page wrappers. Spacing and column widths
  follow Medusa's own pages (for example, the Quote details side column is 440 px from extra-large
  screens up, against 400 px from large screens up today). Content, wording and order do not change.

## Business rules

- Customizing a page → changes only how the page is arranged on screen. Data shown, actions
  available, permissions and messages stay as they are (no behaviour change).
- Hiding a section → hides it from view only; it is never an access control. The section's data is
  still loaded and still reachable by anyone who can open the page.
- Saving "Personal" → allowed for every logged-in admin user; affects only that user; recorded
  against that admin user.
- Saving "Default" ("Save for everyone") → allowed for every logged-in admin user (Medusa's own rule;
  no extra permission check exists or is added); changes the arrangement for every admin user who
  has no personal arrangement, after a confirmation prompt. Accepted by Klaus.
- Returning to "Default" and saving → the user sees the shared default again.
- No admin user, no arrangement saved, or a saved arrangement naming a section that no longer exists
  → the page shows its standard arrangement; unknown names are ignored.
- The Business Central warning on Company details ("these fields are managed by Business Central")
  → a movable section like the others: it can be reordered and hidden (Klaus, 2026-10-23). By
  default it stays first, above the company information.
- Each page key is unique and none is the start of another page's key (Medusa matches widget places
  by key prefix, so `quote.details` would also catch anything named `quote.details-x`).

## Data model (draft)

No data of ours. The arrangement is stored by Medusa's built-in settings store.

| Entity / field | Key and meaning | Owner | Written by | Stored or derived | Sensitive? | Retention |
|---|---|---|---|---|---|---|
| Page arrangement (personal) | page key + admin user id: per section, order, column and hidden flag | Medusa settings module (core) | the admin user, through Medusa's Admin API | stored | no (section names and positions only) | until changed; ? on admin user deletion |
| Page arrangement (default) | page key: same content, shared | Medusa settings module (core) | any admin user, "Save for everyone" | stored | no | until changed |
| Active view per page | admin user id + page key: Personal or Default | Medusa settings module (core) | Medusa, when the user saves | stored | no | until changed |
| Page keys | e.g. `company.details`, `quote.details` (draft list below) | this story (Admin code) | code | fixed in code | no | — |
| Section names | e.g. `company-info`, `employees` | this story (Admin code) | code | fixed in code | no | — |

## Security properties (draft)

Not a security change: no auth, personal-data or payment flow changes. One note for the planner:
on the detail pages the record shown (company, quote) can be handed to Admin extensions placed on
the page. Those run inside the same admin session and see only what the admin user already sees;
no extension is added in this story.

## Affected apps

- Backend, Admin UI only: `apps/backend/src/admin/routes/**/page.tsx` for the pages below, and the
  admin tests that render them. No API, workflow, module or migration change.

## Proposed structure

Story; high-level tasks (the planner decides the final split):

1. Put the standard page layout on the list pages: Approvals, Companies, Quotes, Translations
   (one section each, single column).
2. Company details: single column; sections "Business Central warning", "Company information" and
   "Employees", in that default order; all three movable and hideable.
3. Quote details: two columns as today. Main column: "Quote accepted" notice (only shown when the
   quote is accepted), "Quote" (header, items, costs, total, Reject and Send buttons), "Messages",
   "JSON". Side column: "Customer", "Company".
4. Shipment tracking: single column; sections "Shipments that gave up" (with Retry) and "All
   shipments". Adjust the existing page test.

Draft page keys: `approval.list`, `company.list`, `company.details`, `quote.list`, `quote.details`,
`translation.list`, `shipment_tracking.list`.

Not proposed: **Manage quote**. It opens as a full-screen dialog over the quote, like Medusa's own
edit dialogs, which do not support "Customize page" either; the top bar with the menu is behind
the dialog. Left out of this story (Klaus, 2026-10-23).

Verification: before planning, one runnable probe (below) and, after the change, a manual check in
the Admin on each page (enter edit mode, reorder, save, reload, Default, save).

## Open questions (answered by Klaus, 2026-10-23)

Answers: 4 → the Business Central warning is a movable section; all other proposals accepted
(priority Should; any admin may "Save for everyone"; section split as proposed; Manage quote out of
scope; standard widget places exposed with no widget added; Medusa's standard spacing and widths).

1. Priority: Must, Should or Could?
2. "Save for everyone": Medusa lets every admin user change the shared default arrangement. Is that
   acceptable for our pages, as it already is on Medusa's own pages? (Restricting it would need
   backend work and is not proposed.)
3. Section split: is the split per page under Proposed structure what you want? In particular, on
   Company details, should the company information be split further (for example "Approval
   settings" and "Order API" as their own sections)? That would change how the page looks today and
   is not proposed.
4. Business Central warning on Company details: keep it fixed and not hideable (proposed), or make
   it a movable section like the others?
5. Manage quote: agree to leave it out of this story (proposed), since it is a dialog, not a page?
6. Widgets: agree that our pages expose Medusa's standard widget places (comes with the layout
   component; turning it off is possible but would differ from Medusa's pages), with no widget
   added now?
7. Look: accept Medusa's standard spacing and column widths (minor differences, mainly the Quote
   details side column), or must the pages match today's spacing pixel for pixel?

## Dependencies

- Medusa Admin 2.21.2 (`@medusajs/dashboard`, `@medusajs/admin-sdk`, `@medusajs/admin-shared`):
  page-layout component, Admin API for layouts, built-in settings module (loaded by default; no
  configuration change in `medusa-config.ts`).
- Verified from installed source: the menu item, the layout component, storage per page key and
  user (server-side, any key accepted), widget places accepted for custom keys (build warns, does
  not fail), standard layouts `core:single-column` and `core:two-column`.
- UNVERIFIED, needs a runnable probe before dispatch: that importing the layout component from
  `@medusajs/dashboard/components` in our Admin code builds and runs in our app (development server
  and production build) with the menu connected to it. The Medusa documentation shows this usage for
  plugins; our Admin code is bundled by the same plugin. Probe: wrap one page (e.g. Approvals) in
  the layout component, run the backend `dev` server and `build`, open the page, choose "Customize
  page", hide the section, save, reload, then choose Default and save.
- UNVERIFIED: the existing admin tests that render pages (`shipment-tracking/__tests__/page.test.tsx`)
  under the layout component, which needs Medusa's Admin context; the planner decides how those
  tests render the page.
- Related: NIMBUS-216 (shipment tracking page), NIMBUS-219 (order API setting on Company details),
  NIMBUS-176 / NIMBUS-196 (Translations page); all merged into `develop`.

## Documentation

- [docs/architecture/admin-page-layout.md](../../docs/architecture/admin-page-layout.md) — Admin page layout and "Customize page" (created)

AI base files updated: `ai/skills/medusa-admin/project.md` (link to the new doc)
