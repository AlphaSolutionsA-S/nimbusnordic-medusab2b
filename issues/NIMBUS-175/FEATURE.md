# Admin translation editor for storefront UI text

- **Date:** 2026-09-30
- **Status:** Feature captured
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-175 (parent epic NIMBUS-159 Multi-lingual frontend)
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-175/
- **Size:** L
- **Area:** Medusa Admin (custom page) + backend module; storefront i18n (`apps/storefront/messages/*.json`)
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-30T07:57:13Z

## Description
Give admins a page in Medusa Admin where they can view and edit the storefront's UI text (labels, buttons, messages) for every supported language, without a developer having to edit files. The page groups texts by section (like Shopify's "Edit theme content" screen). Admins can switch language, import and export the translation files, see which texts are missing or different between languages, and see which texts are new in the code and have not been translated yet.

## Why
Storefront texts now live in per-language files in the code. Every wording change or new translation needs a developer and a deployment. Letting business users maintain translations themselves cuts turnaround time, reduces developer load, and makes it easy to spot untranslated text before it reaches customers.

## Acceptance criteria
- [ ] Admin users can open a "Translations" page from the Medusa Admin navigation.
- [ ] The page lists all storefront texts grouped by section, with a readable label and an editable field per text (as in the reference screenshot).
- [ ] Admin can switch between all supported storefront languages (da, de, en, fr, it, no, pl, sv).
- [ ] Admin can edit a text and save it; the saved value is stored per language.
- [ ] Admin can import a language file (JSON) to create or replace that language's translations.
- [ ] Admin can export a language's translations as a JSON file in the same format the storefront uses.
- [ ] Admin can compare languages and see texts that are missing or empty in one language compared to another (e.g. English as reference).
- [ ] Admin can compare stored translations against the file shipped in the code, and see new texts that exist in the code but not yet in the stored translations (and texts that were removed).
- [ ] Admin can search/filter texts by key or value.
- [ ] Only authenticated admin users can view or change translations.

## Out of scope
- Machine/AI translation suggestions (possible follow-up).
- Translating product/catalog data (handled elsewhere in Medusa); this covers storefront UI text only.
- Transactional email/notification text (NIMBUS-162).
- Adding new languages to the storefront routing.

## Open questions
- **Runtime source of truth:** Should the storefront read translations from the database at runtime (with caching/revalidation), or is the DB only an editing workspace whose export is committed back into `apps/storefront/messages/*.json` and deployed? This drives most of the design.
- If the storefront reads from the DB: what is the fallback when a key is missing in the DB (code file → English)?
- How does "diff towards file" get the file contents in a deployed backend — bundled copy of `messages/*.json` at build time, fetched from the storefront, or uploaded by the admin?
- Import behaviour: replace the whole language, or merge (keep existing values, add new keys)? Should import show a preview/diff before applying?
- Section and field labels: derive from the JSON key path (e.g. `Common.notFound.headingLabel` → "Common › Not found › Heading label"), or maintain separate human-friendly labels?
- Is an edit history / audit trail (who changed what, when) needed, or is export-as-backup enough?
- Should editing be restricted to specific admin roles?
- ICU/next-intl placeholders (e.g. `{count}`, plurals): should the editor validate that placeholders match the reference language?

## Mockups / references
- `./mockups/shopify-theme-content-reference.png` — Shopify "Edit theme content" screen: section tabs across the top, grouped headings, one labelled input per key, search in the top-right.
- Current storefront message files: `apps/storefront/messages/{da,de,en,fr,it,no,pl,sv}.json` (next-intl, nested JSON, ~31–34 KB each), loaded in `apps/storefront/src/i18n/request.ts`.
- Related: NIMBUS-159 (epic), NIMBUS-165 (key extraction), NIMBUS-167 (translated content), NIMBUS-173 (untranslated text bug).

## Technical notes
*(Leave empty initially. Implementation plan goes in `PLAN.md` once work starts.)*

Initial idea from the requester, to be validated during scoping: store each language's full JSON document as one DB row keyed by locale; import/export round-trips the JSON file.
