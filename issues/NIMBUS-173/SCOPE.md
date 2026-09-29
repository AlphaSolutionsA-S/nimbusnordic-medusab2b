# Multi-lingual storefront: remaining English text not translated

- **Date:** 2026-09-29
- **Status:** Scoped (approved 2026-09-29)
- **Type:** Bug
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-173 (parent epic NIMBUS-159, relates to NIMBUS-165)
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-173/
- **Size:** M (T-shirt)
- **Area:** Storefront — i18n (next-intl), page metadata, price/date formatting, error messages
- **Base Branch:** develop
- **Requested by:** Klaus Petersen
- **Requested at:** 2026-09-29T00:00:00Z

## Background

The multi-lingual storefront (epic NIMBUS-159) couples language 1:1 with the country segment
(`/{countryCode}/...`) and renders static UI text from `apps/storefront/messages/<locale>.json`
for 8 locales (da, en, sv, no, pl, it, fr, de). The string extraction in NIMBUS-165 left some
text behind. A static audit (see `BUG.md`) found that customers on a non-English country still see:

- English toasts, placeholders, payment-method names and a few labels;
- English (and Medusa template) browser-tab titles and meta descriptions on most pages;
- prices and dates always formatted US/UK style (`DKK 1,234.50` instead of `1.234,50 kr.`);
- two wrong catalog values ("test" image alt fallback, "Medusa B2B Starter" brand name);
- raw English error messages from the storefront's data layer, the backend and zod validation.

The catalogs themselves are complete (key parity across all 8 locales), so this is a gap in
coverage rather than in translations.

Findings were spot-checked during scoping and hold: 20 files still export a static English
`metadata` object, only 4 routes use `generateMetadata`, 16 files (6 of them Client Components)
call `convertToLocale` without a locale, and there are 12 hardcoded `en-GB`/`en-US` formatter
calls plus one argument-less `toLocaleString()`.

## Requirements

### Functional

**A. Hardcoded visible UI text (BUG.md §1)** — in scope
- Cart toasts (locked for approval, add/delete/update/empty failures), the payment-button
  fallback error, "Note:", skeleton placeholders ("Cart", "Products"), the country-select
  default placeholder, and the claims page fallback title come from the catalogs.
- Payment-method titles ("Credit card", "Pay by invoice") are shown translated in checkout
  payment, payment container and order payment details. The payment-provider map keeps a
  stable identifier and the title is resolved through a translation key at render time.
- Order-status filter ("Open"/"Draft"): the filter values stay as-is because the BC API uses
  them. If they are shown to the customer, the displayed label is translated.
- Cart CSV export column headers **stay in English** (decision: fixed column names for systems
  that import the file). No change to `convert-cart-to-csv.ts`.
- The product thumbnail `alt="Thumbnail"` fallback is translated. Preferred: use the product
  title where available, with a translated generic fallback (e.g. "Product image").
- Payment icon SVG `<title>`s (Bancontact, iDEAL): the brand name stays and the word "icon"
  comes from a translated key.

**B. Page metadata (BUG.md §2)** — in scope
- Every customer-facing page under `[countryCode]` that has English `title`/`description`
  moves from static `metadata` to `generateMetadata` using `getTranslations` (new `Metadata`
  namespace, one sub-key per page). This covers home, account dashboard/addresses/approvals/
  bcorders/claims/orders/profile, login, cart, checkout, store and order confirmed, and the
  hardcoded "View your order" description on order details.
- Medusa template copy ("Medusa Next.js Starter Template", "your Medusa Store") is replaced with
  Nimbus Nordic copy. Fix the "You purchase" typo.
- The segment `not-found.tsx` files in `(main)`, `(checkout)` and `cart` get translated
  metadata. Check that Next 15 allows this in `not-found`. If it only allows static `metadata`
  there, use a translated title rendered by the component, or a neutral static "404" title.
- Root `src/app/not-found.tsx` (outside `[countryCode]`): recommended default is to render in
  the default locale (`en`) with translated keys via `getTranslations`. `src/i18n/request.ts`
  already falls back to `DEFAULT_LOCALE` when middleware has set no locale header. No
  `Accept-Language` negotiation. Middleware redirects paths without a country code, so this
  page is rarely reached.

**C. Locale-aware number and date formatting (BUG.md §3)** — in scope
- Every price uses the active locale. `convertToLocale` gets the locale from its callers, and
  its hardcoded `"en-US"` default is removed. Making `locale` required is recommended, so the
  compiler catches any missed caller.
- The formatting locale comes from the next-intl locale (`getLocale()` in Server Components,
  `useLocale()` in Client Components). A small helper next to `country-language-map.ts` maps it
  to a full BCP 47 formatting tag (`da-DK`, `en-GB`, `sv-SE`, `nb-NO`, `pl-PL`, `it-IT`,
  `fr-FR`, `de-DE`). That map stays the single source of truth, so `en` formats as `en-GB`
  (its country is `gb`) and not as US.
- All hardcoded `en-GB`/`en-US` date and number formatters (approval card, BC order card, BC
  order line fulfillment, BC order return, order card, BC order detail template, amount cell)
  and the argument-less `toLocaleString()` in payment details use the same locale source. They
  can use next-intl's `useFormatter`/`getFormatter` or `Intl.*` with the helper's tag,
  whichever the planner finds simplest. Use one approach throughout.
- Currency stays as provided by the cart/order/region. Only presentation changes.

**D. Wrong catalog values (BUG.md §4)** — in scope
- `Common.thumbnail.altFallback` ("test") gets a proper translated value in all 8 locales.
- `Layout.nav.brandName` ("Medusa B2B Starter") gets the correct brand text in all 8 locales
  (recommended default: "Nimbus Nordic", not translated).

**E. Errors shown to customers (BUG.md §5)** — in scope
- Components that show `err.message` / `e.message` directly (checkout shipping, shipping
  address, billing address, payment, payment button, cart-to-csv button, quote details) show
  a translated message instead.
- Errors raised in the storefront's own data layer (`lib/data/cart.ts`) that can reach a
  customer map to translated keys (for example via a stable error code). Unknown errors,
  including Medusa backend messages, show a translated generic fallback ("Something went
  wrong, please try again"). The raw message is logged for diagnostics and never shown in
  English.
- The quote message form's zod validation messages are translated. Pass translated messages
  into the schema; do not use zod's English defaults.

**F. Regression guard** — in scope
- Add an ESLint rule (`react/jsx-no-literals`, already available through the Next ESLint
  config) set to `warn` for `src/app` and `src/modules`. Allow a small list of punctuation and
  decorative glyphs, and exclude tests. Keep it at `warn` so the build does not fail on
  pre-existing or intentional literals, while new hardcoded JSX text shows up in review.

**G. Remove the `bctest` test page** — in scope (decision at approval)
- Delete `src/app/[countryCode]/(main)/bctest/page.tsx` and its test
  `src/__tests__/app/bctest-page.test.tsx`.
- Remove the `BcTest` namespace from all 8 catalogs (the key-parity test must still pass).
- Remove `listBusinessCentralOperations` from `src/lib/data/business-central.ts`. The page is
  its only caller, so it becomes dead code. Check again before deleting.

### Out of scope

- Developer-only errors and logs (`useCart must be used within a CartProvider`, missing Stripe
  key, `No regions found`, `console.*` text).
- Translating the cart CSV export headers (kept in English by decision).
- Product/catalog content from Medusa/BC/Payload CMS, and email/notification localization
  (already out of the epic).
- Values in `BUG.md` that are identical across languages (Status, Total, SKU, brand names),
  reviewed as acceptable.
- Translating Medusa backend error text at its source. The storefront uses the generic
  fallback instead.
- `hreflang`/SEO work beyond translating title/description (epic story 6).

### Non-Functional

- New keys are added to all 8 catalogs with real translations. The existing key-parity test
  (`message-catalogs.test.ts`) must keep passing.
- Follow the namespace conventions from NIMBUS-165 (`issues/NIMBUS-165/extraction-checklist.md`),
  including the Server (`getTranslations`) vs Client (`useTranslations`) split and reusing
  existing keys where the text is the same.
- No change to routing, locale resolution or currency behaviour.
- Error handling must not leak internal/backend details to customers. Raw messages go to logs
  only, without PII (OWASP A09).
- Existing unit tests are updated for components whose output changes, e.g. snapshots or
  assertions on formatted prices.

## Affected Apps

- **storefront** — all changes: catalogs (`messages/*.json`), `lib/constants.tsx`,
  `lib/util/money.ts` and its callers, date/number formatters in account/order modules, page
  `metadata` → `generateMetadata`, not-found pages, cart context and data-layer error mapping,
  quote message form validation, ESLint config.
- **backend** — no changes.

## Proposed Structure

Suggested task breakdown for the implementation-planner:

1. **Locale formatting helper and money/date formatting** — add the locale→formatting-tag
   helper, make `convertToLocale` take the locale, update all callers (Server and Client), and
   replace the hardcoded `en-GB`/`en-US`/argument-less formatters.
2. **Page metadata** — add the `Metadata` namespace, convert static metadata to
   `generateMetadata`, fix template copy and the typo, and handle the segment and root
   not-found pages.
3. **Remaining hardcoded UI text and catalog value fixes** — BUG.md §1 items (except the CSV
   headers) plus `altFallback` and `brandName`, in all 8 locales. Also remove the `bctest`
   page (requirement G).
4. **Customer-facing error messages** — error-code mapping for `cart.ts`, generic fallback for
   unknown/backend errors, translated zod messages in the quote form.
5. **Lint guard** — `react/jsx-no-literals` at `warn`, with the allowlist tuned so the current
   codebase is (nearly) clean.
6. **Verification** — unit tests and key-parity test pass. Manual check on at least `/dk`,
   `/de` and `/gb`: prices (`1.234,50 kr.`), dates, tab titles, checkout payment names,
   header brand and a forced cart error toast.

## Decisions (approved by Klaus Petersen, 2026-09-29)

All recommended defaults were accepted, except questions 4 and 7.

1. **Brand name** — "Nimbus Nordic", the same in all locales (`Layout.nav.brandName` and page titles).
2. **Home page copy** — title "Nimbus Nordic". The planner drafts a short neutral B2B meta
   description per locale for the user to approve.
3. **Root `src/app/not-found.tsx`** — translated keys rendered in the default locale (`en`), with no
   `Accept-Language` negotiation.
4. **`bctest` page** — **remove it as part of this bug** (requirement G).
5. **Lint guard** — include `react/jsx-no-literals` at `warn` for `src/app` and `src/modules`.
6. **Backend/unknown errors** — generic translated fallback plus logging, with no per-message
   mapping of backend errors.
7. **CSV export headers** — **keep them in English**.
8. **`en` formatting** — `en-GB`.
9. **Base branch** — `develop`.

## Dependencies

- NIMBUS-159 (parent epic): locale architecture and the country→language map.
- NIMBUS-165 (relates): extraction conventions, namespaces and flagged exceptions
  (`Thumbnail` alt, `bc-order-filters`, payment icon titles, root not-found) that this bug
  resolves.
- Translations for new keys in all 8 locales. The same translation source and review process
  as NIMBUS-165 is assumed.
