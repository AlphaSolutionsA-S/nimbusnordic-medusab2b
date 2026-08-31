# NIMBUS-168: SEO Metadata and hreflang

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-168

## Objective
Add `hreflang` alternate-language links and localized title/description metadata to every public
page, so search engines index each of the 8 country/region variants correctly instead of flagging
them as duplicate content.

## Analysis
- Exploration found only **one** existing `alternates` usage in the whole app (the categories
  page's bare `canonical` path) and **zero** `hreflang`/`languages` entries anywhere. No
  `sitemap.ts`/`robots.ts` exists either (sitemap is explicitly out of scope for this story).
- 4 `generateMetadata` implementations exist total; the 4th (account order-details) is a private,
  authenticated page and is deliberately excluded from `hreflang` — indexing it would be
  meaningless.
- A single shared `buildLocaleAlternates(path)` helper avoids duplicating the 8-country URL-mapping
  logic across the 3 public pages, and reuses `COUNTRY_LANGUAGE_MAP` from NIMBUS-164 as the source
  of truth for which languages/countries exist.
- Localized title/description (Task 02) only affects **static template text** (e.g. the
  `"| Medusa Store"` suffix) — actual product/category/collection content is Medusa data and stays
  untranslated, consistent with the epic's "static UI text only" scope.

## Execution Plan
1. **Task 01:** add `buildLocaleAlternates()`, wire `alternates.languages` into the 3 public-page
   `generateMetadata` functions.
2. **Task 02:** localize the static suffix/template text in those same 3 pages' titles and
   descriptions via a new `MetaDescription` translation namespace.

## Decisions & Trade-offs
- Excluded the authenticated order-details page from hreflang — not indexable content, adding
  alternates there would be noise.
- Kept sitemap.xml out of scope entirely, per the stakeholder decision recorded in scope.md — not
  bundled in even though it's a natural companion to hreflang.
- Task 02 sequenced after Task 01 since both touch the same 3 files — implement as one combined
  edit per file if dispatched together to avoid overlapping diffs.

## Verification
- [ ] `buildLocaleAlternates` returns exactly 8 correctly-formed URLs, one per target language
      (TC-1, Task 01).
- [ ] Product and category pages' metadata include populated `alternates.languages` (TC-2/TC-3,
      Task 01).
- [ ] Localized title suffix reflects the resolved locale, with correct fallback for unmapped
      countries (TC-1/TC-2, Task 02).
- [ ] Product/category/collection data content itself remains untranslated (TC-3, Task 02) —
      confirms no scope creep into product-content translation.
- [ ] Manual check: view-source on a product page shows `<link rel="alternate" hreflang="...">`
      tags for all 8 locales.
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` pass.
