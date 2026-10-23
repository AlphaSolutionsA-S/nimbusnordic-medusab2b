# Customize page on all custom Medusa Admin pages

- Tracker: [NIMBUS-223](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-223)
- Priority: Should (to confirm with Klaus)
- Size: M (T-shirt)
- Area: Medusa Admin, custom pages (Approvals, Companies, Company details, Quotes, Quote details, Manage quote, Translations, Shipment tracking)
- Requested by: Klaus Petersen
- Requested at: 2026-10-23T00:00:00Z

## Description
Medusa Admin has a "Customize page" option in its top-bar menu that lets an admin user rearrange the
sections of a page. It works on Medusa's own pages, but on our own Admin pages (companies, approvals,
quotes, translations, shipment tracking) the option does nothing. All our custom Admin pages should
support "Customize page" the same way Medusa's own pages do.

## Why
Admin users get one consistent Admin: the menu option is shown on every page, so it should work on
every page, and users can arrange our pages to suit how they work, just as they can on Medusa's pages.

## Acceptance criteria
- [ ] On each custom Admin page (Approvals, Companies, Company details, Quotes, Quote details, Manage
      quote, Translations, Shipment tracking), choosing "Customize page" enters edit mode, the same way
      it does on Medusa's own pages.
- [ ] The admin user can rearrange the page's sections and the new arrangement is kept when they
      come back to the page.
- [ ] The admin user can reset a page to its default arrangement.
- [ ] Until a user customizes a page, it looks as it does today.
- [ ] Nothing on the pages behaves differently: the same data, actions, permissions and messages.

## Out of scope
- New sections, fields or actions on any page.
- Changes to what data a page shows or who may see it.
- Customizing the sidebar, settings sidebar or top bar (these already work and are not page-specific).
- Medusa's own pages.

## Open questions
- Priority: Must, Should or Could?
- Should the arrangement be per user (as on Medusa's pages) or shared by all admin users?
- How finely should each page be split into sections that can be moved (for example, on Company
  details: company info, employees, approval settings, order API setting as separate sections)?
- Should other Admin extensions (widgets) be able to add sections to our pages, as they can on
  Medusa's pages?

## Mockups / references
- Medusa Admin top-bar menu: "Customize page" on any built-in page (e.g. Orders, Order details).
- Related: NIMBUS-216 (shipment tracking overview page, in progress), NIMBUS-219 (order API setting
  on the company page), NIMBUS-176 / NIMBUS-196 (Translations page).

## Technical notes
*(Triage notes only; the design belongs in `scope.md` / `plan.md`.)*

- Cause (from Klaus's investigation, Medusa dashboard 2.21.2): built-in pages wrap their content in
  the dashboard's `LayoutComposer`; the "Customize page" menu item always shows, but only a mounted
  `LayoutComposer` enters edit mode. Our pages under `apps/backend/src/admin/routes/**/page.tsx`
  render plain markup.
- `LayoutComposer` is exported from `@medusajs/dashboard/components` but is not in the Medusa docs:
  an undocumented API. UNVERIFIED: whether layout preferences persist for custom zone prefixes, and
  whether widgets inject into custom zones.
- Pages: 8 files, 840 lines in total; the larger ones are `companies/[companyId]/page.tsx` and
  `quotes/[quoteId]/page.tsx` (~260 lines each), `shipment-tracking/page.tsx` (126), `companies/page.tsx`
  (97); the rest are thin wrappers over components.
- Existing admin tests: `routes/shipment-tracking/__tests__/page.test.tsx`, `routes/translations/__tests__/*`.
- `shipment-tracking/page.tsx` was changed under NIMBUS-216, now merged into `develop` (Klaus, 2026-10-23).
