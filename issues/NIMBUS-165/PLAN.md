# NIMBUS-165: Extract UI Text into Translation Keys

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-165

## Objective
Move all hardcoded storefront UI copy into translation keys, using current English copy as the
default content, with zero visual/behavioral regression.

## Analysis
- Exploration counted **202 `.tsx` files** under `apps/storefront/src/modules` — full enumeration
  in a plan document isn't practical. The plan instead fixes a namespace convention (Task 01),
  demonstrates the pattern on 3 representative high-traffic areas with exact file/line references
  found during exploration (layout nav — Task 02; checkout contact/address forms — Task 03;
  login/register — Task 04), then sweeps everything else against a tracked checklist (Task 05).
- Server vs. Client Component distinction matters for which hook to use: `nav/index.tsx` is a
  Server Component (`getTranslations`); `contact-details-form`, `login`, `register` are Client
  Components (`useTranslations`).
- One string needs rich-text handling: the login heading embeds a `<br/>` — using `t.rich()`
  avoids injecting raw HTML into translatable strings, which matters for NIMBUS-167's machine
  translation step.
- Data-sourced strings (Medusa product/category names, country `display_name` in the existing
  country-select) are explicitly out of scope — only hardcoded UI copy is extracted.

## Execution Plan
1. **Task 01:** fix namespace convention, write a tracked extraction checklist covering every
   module folder.
2. **Task 02:** extract nav/header/footer strings (worked example, Server Component pattern).
3. **Task 03:** extract checkout contact-details and address-form strings (Client Component
   pattern, plus the shared `CountrySelect` default placeholder).
4. **Task 04:** extract login/register strings (Client Component pattern, `t.rich` for embedded
   markup).
5. **Task 05:** sweep all remaining checklist areas using the same pattern; add a full-catalog
   key-structure-parity test; final regression pass across the whole storefront.

## Decisions & Trade-offs
- Chose not to pre-enumerate all ~190 remaining files' strings — flagged explicitly in Task 05
  rather than silently claiming full coverage from 3 worked examples. The checklist file is the
  single source of truth for what's done.
- All 8 locale catalogs get identical English content at this stage — non-English translation is
  NIMBUS-167's separate scope, kept structurally decoupled so catalogs stay parity-testable.
- Country `display_name` values (data from Medusa) are left untouched — only the `CountrySelect`'s
  own `placeholder="Country"` default is extracted, not the option list content.

## Verification
- [ ] Regression tests per extracted area confirm rendered `en` text is byte-identical to
      pre-extraction content (TC-1 in Tasks 02–05).
- [ ] Rich-text login heading renders an actual `<br>` element, not a literal string (TC-2, Task
      04).
- [ ] Full-catalog key-structure-parity test passes across all 8 locale files (TC-2, Task 05).
- [ ] `extraction-checklist.md` shows every area checked off.
- [ ] Manual full-storefront walkthrough (home, PLP, PDP, cart, checkout, account) in `en` shows no
      visual/behavioral change from pre-extraction.
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
