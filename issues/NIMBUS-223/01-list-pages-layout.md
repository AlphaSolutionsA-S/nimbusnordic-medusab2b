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
