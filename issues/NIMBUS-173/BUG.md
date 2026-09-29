# Multi-lingual storefront: remaining English text not translated

- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-173 (parent epic NIMBUS-159, relates to NIMBUS-165)
- **Severity:** Major
- **Area:** Storefront (`apps/storefront`) — i18n / next-intl
- **Reported by:** Klaus Petersen (static audit run with Claude Code)
- **Reported at:** 2026-09-29T00:00:00Z

## Summary

A review of the multi-lingual storefront found that some text still shows in English whatever
country/language the customer is browsing in. The translation catalogs are complete: all 8
locales have exactly the same keys as `en.json`. The problem is text that was never moved into
the catalogs, a few wrong catalog values, and prices and dates that are always formatted with
hardcoded English locales.

## Steps to reproduce

1. Open the storefront under a non-English country, e.g. `/dk/...` or `/de/...`.
2. Add an item to a cart that is locked for approval, or trigger a cart update failure → English toast.
3. Go to checkout → payment method names ("Credit card", "Pay by invoice") and the header brand
   ("Medusa B2B Starter") are in English / template text.
4. Look at the browser tab title on account, cart, checkout and store pages → English text; the home
   page title is "Medusa Next.js Starter Template".
5. Look at any price or order date → US/UK formatting (e.g. `DKK 1,234.50` instead of `1.234,50 kr.`).

## Expected

All customer-visible text comes from `apps/storefront/messages/<locale>.json`, and prices and dates
are formatted with the active locale.

## Actual

The static audit found the following in `apps/storefront/src` (317 files, tests excluded). It used
the TypeScript AST to find JSX text, text attributes, toast calls, `metadata` objects and
capitalised string literals.

### 1. Hardcoded visible UI text

| Location | Text |
|---|---|
| `src/lib/context/cart-context.tsx:85,172,174,218,279,298` | `toast.error`: "Cart is locked for approval.", "Failed to add to cart", "Failed to delete item", "Failed to update cart quantity", "Failed to empty cart" |
| `src/modules/checkout/components/payment-button/index.tsx:320` | "An unknown error occurred, please try again." |
| `src/modules/cart/components/add-note-button/index.tsx:94` | "Note:" |
| `src/modules/skeletons/components/skeleton-cart-button/index.tsx:8` | "Cart" (loading placeholder, flashes on every page load) |
| `src/modules/skeletons/components/skeleton-mega-menu/index.tsx:9` | "Products" (loading placeholder) |
| `src/modules/checkout/components/country-select/index.tsx:12` | default `placeholder = "Country"` |
| `src/lib/constants.tsx:14,18,34` | `paymentInfoMap` titles "Credit card", "Pay by invoice" (rendered in checkout payment, payment-container and order payment-details) |
| `src/modules/account/components/bc-order-filters/index.tsx:10` | status values "Open"/"Draft" (check whether they are shown raw) |
| `src/lib/util/convert-cart-to-csv.ts:32-42` | CSV column headers ("Item ID", "Product Title", "Unit Price", …) |
| `src/lib/util/map-claims-page.ts:20` | fallback title "Claims" |
| `src/modules/products/components/thumbnail/index.tsx:57` | `alt="Thumbnail"` |
| `src/modules/common/icons/bancontact.tsx:20`, `ideal.tsx:20` | SVG `<title>` "Bancontact icon", "iDEAL icon" |

### 2. Hardcoded page metadata (tab title / meta description)

Static `export const metadata` with English `title`/`description` in:

- `src/app/[countryCode]/(main)/page.tsx` — "Medusa Next.js Starter Template" / "A performant frontend ecommerce starter template…"
- `account/@dashboard/page.tsx`, `addresses/page.tsx`, `approvals/page.tsx`, `bcorders/page.tsx` ("BC Orders"), `claims/page.tsx`, `orders/page.tsx`, `profile/page.tsx` ("…your Medusa Store profile.")
- `account/@login/page.tsx` — "Log in to your Medusa Store account."
- `cart/page.tsx`, `(checkout)/checkout/page.tsx`, `store/page.tsx`
- `order/confirmed/[id]/page.tsx` — "Order Confirmed" / "You purchase was successful" (also a typo)
- `orders/details/[id]/page.tsx:20` — `generateMetadata` with hardcoded description "View your order"
- The `not-found.tsx` files in `(main)`, `(checkout)` and `cart` — "Something went wrong"
- `src/app/not-found.tsx` — the whole page is English ("Page not found", "The page you tried to access does not exist.", "Go to frontpage"). It sits outside `[countryCode]`, so it has no locale context and needs a decision (default locale, or `Accept-Language`).

Only the product, category and collection pages translate their metadata (via `MetaDescription.storeSuffix`).

### 3. Locale-insensitive number and date formatting

- `src/lib/util/money.ts:16` — `convertToLocale` defaults `locale = "en-US"`. **None of the 36 callers pass a locale**, so all prices are US-formatted.
- Hardcoded `"en-GB"`: `approval-card/index.tsx:83,100,109,125`, `bc-order-card/index.tsx:16,27`,
  `bc-order-line-fulfillment/index.tsx:10`, `bc-order-return/index.tsx:41`, `order-card/index.tsx:73`,
  `templates/bc-order-detail-template.tsx:22,44`.
- Hardcoded `"en-US"`: `common/components/amount-cell/index.tsx:4`.
- `order/components/payment-details/index.tsx:56` — `toLocaleString()` with no argument (uses the runtime default locale).

### 4. Wrong catalog values (all locales)

- `Common.thumbnail.altFallback` = `"test"` — used as the alt fallback in `src/modules/common/components/thumbnail/index.tsx:21`.
- `Layout.nav.brandName` = `"Medusa B2B Starter"` — rendered in the checkout header, `src/app/[countryCode]/(checkout)/layout.tsx:22`.

The other values that match English (Status, Total, SKU, brand names, …) are real words shared
across languages and were reviewed as acceptable.

### 5. English errors surfaced through `err.message`

These components display `err.message` directly: checkout `shipping`, `shipping-address`,
`billing-address`, `payment`, `payment-button` (lines 120, 187, 245, 295, 364), `cart-to-csv-button`
and `quote-details` (`toast.error(e.message)`). The messages come from English `throw new Error(...)`
calls in `src/lib/data/cart.ts` (e.g. "No existing cart found when setting addresses") or from the
Medusa backend. The quote message form (`quotes/components/quote-messages.tsx:15`) uses zod's default
English validation messages.

### Out of scope / notes

- Developer-only errors (`useCart must be used within a CartProvider`, Stripe key missing,
  `No regions found`) and `console.error` text don't need translating.
- `src/app/[countryCode]/(main)/bctest/page.tsx` ("BC API Test") is a test page that ships with the
  storefront. Consider removing it (separate concern).
- Test gap: `src/__tests__/lib/i18n/message-catalogs.test.ts` only checks key parity. Nothing stops
  new hardcoded strings from being added (e.g. an ESLint rule such as `i18next/no-literal-string` or
  `react/jsx-no-literals`).

## Environment

- OS: Windows 11 (static analysis, not a runtime repro)
- Browser / runtime: n/a — source audit of the Next.js storefront using next-intl
- Build / commit: `develop` @ `5558cf0`
- Tenant / data context: any non-English country segment (`da`, `de`, `fr`, `it`, `no`, `pl`, `sv`)

## Evidence

- Findings above came from a TypeScript-AST scan of `apps/storefront/src`, plus a key-parity and
  identical-value comparison of `apps/storefront/messages/*.json`.

## Analysis

*(Leave empty initially. Fill in `ANALYSIS.md` when investigation starts and link from here.)*
