# Task 01: Locale-aware price and date formatting — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 01
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-173 (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build`. `next.config.js` sets
  `typescript.ignoreBuildErrors: true`, so the build does NOT type-check. Always also run
  `cd apps/storefront && npx tsc --noEmit -p tsconfig.json`.
- **Type-check baseline on develop:** 10 pre-existing `error TS` lines, in
  `account-nav.test.tsx` (3), `company-card-bc-readonly.test.tsx` (1), `quote-messages.tsx` (1, zod resolver
  typing), `profile-card/index.tsx` (3), and `cart-drawer/index.tsx` (2). Do not add new ones.
- **Lint command:** `cd apps/storefront && pnpm lint` (`next lint`, legacy `.eslintrc.js`)
- **Test command:** `cd apps/storefront && pnpm test` (Jest + RTL, jsdom)
- **Test baseline on develop:** 3 pre-existing failures that are NOT caused by this work:
  `src/__tests__/app/main-layout.test.tsx` (1) and
  `src/__tests__/modules/products/components/product-tabs/index.test.tsx` (2). Do not fix them.
- **Test location:** `apps/storefront/src/__tests__/` (mirrors `src/`), naming `<name>.test.ts(x)`
- **next-intl mocks:** `apps/storefront/__mocks__/next-intl.tsx` (`useTranslations`, `useLocale` → `"en"`)
  and `apps/storefront/__mocks__/next-intl/server.ts` (`getTranslations`, `getMessages`, …). Jest applies
  them automatically. The server mock has **no `getLocale` yet**. This task adds it.
- **Conventions:** 2-space indent, **no semicolons, double quotes** (match the surrounding storefront files,
  which override the generic TS style), kebab-case file names for non-component modules.

## Solution Design

One locale source and one formatting approach everywhere:

1. **New helper** `src/lib/i18n/formatting-locale.ts` → `getFormattingLocale(locale: string): string`.
   It maps a next-intl locale (`"da"`, `"en"`, …) to a full BCP 47 tag. It derives the region from
   `COUNTRY_LANGUAGE_MAP` (the single source of truth), so `en` → `en-GB` (its country is `gb`) and `da` → `da-DK`.
   Norwegian uses the Intl language subtag `nb`, so `no` → `nb-NO`. An unknown locale falls back to
   `DEFAULT_LOCALE` → `en-GB`.
2. **`convertToLocale`** (`src/lib/util/money.ts`) gets a **required** `locale: string` (the next-intl locale).
   It calls `getFormattingLocale` internally. The `"en-US"` default is removed.
3. **All other number/date formatting** uses `Intl.*` / `toLocale*String` with `getFormattingLocale(locale)`.
   Money in BC components goes through `convertToLocale` too, so no `new Intl.NumberFormat("en-GB", …)` remains.
4. **Where the locale comes from:**
   - Non-async components (with or without `"use client"`), including shared components rendered from both
     trees: `const locale = useLocale()` from `"next-intl"`. next-intl 4.14 supports `useLocale` in non-async
     Server Components and in Client Components (inside the `NextIntlClientProvider` in
     `src/app/[countryCode]/layout.tsx`, which receives the real locale).
   - `async` Server Components: `const locale = await getLocale()` from `"next-intl/server"`.
   - Plain utilities (`get-product-price.ts`, `amount-cell`'s `formatAmount`) take `locale` as a parameter.
     They never read it themselves.
5. Currency is unchanged. Only the presentation locale changes.

Decision: `Intl` + helper instead of next-intl `useFormatter`/`getFormatter`. `convertToLocale` is a plain
function that is also called from utilities (`get-product-price.ts`), so it cannot use a hook. Using `Intl` in
every place keeps one approach, and the tests use the real Node ICU (Node 22 has full ICU) with no extra mocks.

## Code Skeletons

### New File: `apps/storefront/src/lib/i18n/formatting-locale.ts`

```typescript
import {
  COUNTRY_LANGUAGE_MAP,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "./country-language-map"

// Intl formats Norwegian (Bokmål) under the "nb" language subtag; the
// storefront's locale code for Norway is "no".
const INTL_LANGUAGE_OVERRIDES: Partial<Record<Locale, string>> = {
  no: "nb",
}

function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Maps a next-intl locale ("da", "en", ...) to the full BCP 47 tag used for
 * number/date formatting ("da-DK", "en-GB", ...). The region comes from
 * COUNTRY_LANGUAGE_MAP so that map stays the single source of truth.
 * Unknown locales fall back to DEFAULT_LOCALE.
 */
export function getFormattingLocale(locale: string): string {
  const resolved: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  // IMPLEMENT: find the first country code in COUNTRY_LANGUAGE_MAP whose value === resolved
  //   (Object.keys(COUNTRY_LANGUAGE_MAP).find(...)).
  // IMPLEMENT: language = INTL_LANGUAGE_OVERRIDES[resolved] ?? resolved
  // IMPLEMENT: return country ? `${language}-${country.toUpperCase()}` : language
}
```

### Modified File: `apps/storefront/src/lib/util/money.ts` (full new content)

```typescript
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import { isEmpty } from "@/lib/util/isEmpty"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  // The active next-intl locale ("da", "en", ...) — from useLocale()/getLocale().
  locale: string
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale,
}: ConvertToLocaleParams) => {
  return currency_code && !isEmpty(currency_code)
    ? new Intl.NumberFormat(getFormattingLocale(locale), {
        style: "currency",
        currency: currency_code,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount)
    : amount.toString()
}
```

### Modified File: `apps/storefront/src/lib/util/get-product-price.ts`

New signatures (bodies unchanged except for passing `locale` to both `convertToLocale` calls and to
`getPricesForVariant`):

```typescript
export const getPricesForVariant = (
  variant: any,
  locale: string
): VariantPrice | null => { /* pass `locale` into both convertToLocale({...}) calls */ }

export function getProductPrice({
  product,
  variantId,
  locale,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
  locale: string
}) { /* getPricesForVariant(cheapestVariant, locale) / getPricesForVariant(variant, locale) */ }
```

(Keep the existing `any` types. They are pre-existing and out of scope.)

### Modified File: `apps/storefront/src/modules/common/components/amount-cell/index.tsx`

```typescript
import { convertToLocale } from "@/lib/util/money"
import { clx } from "@medusajs/ui"
import { useLocale } from "next-intl"

export const formatAmount = (
  amount: number,
  currency_code: string,
  locale: string
) => {
  return convertToLocale({ amount, currency_code, locale })
}

// AmountCell: add `const locale = useLocale()` as the first line of the body and
// pass `locale` to both formatAmount(...) calls. Everything else unchanged.
```

### Modified File: `apps/storefront/__mocks__/next-intl/server.ts`

Add this export below `getMessages` (keep everything else):

```typescript
// Mirrors useLocale() in the client mock — tests run against the `en` catalog.
export async function getLocale() {
  return "en"
}
```

## Impacted Files

For every `convertToLocale({ ... })` call below, add `locale` as a property. Obtain `locale` once at the top of
the component body as listed. Put new imports in the existing import block:
`import { useLocale } from "next-intl"` / `import { getLocale } from "next-intl/server"` /
`import { getFormattingLocale } from "@/lib/i18n/formatting-locale"`.

| File | Kind | Locale source | Changes |
|---|---|---|---|
| `src/lib/util/money.ts` | util | param | see skeleton |
| `src/lib/util/get-product-price.ts` | util | param | see skeleton |
| `src/modules/common/components/amount-cell/index.tsx` | shared | `useLocale()` in `AmountCell`; param in `formatAmount` | see skeleton |
| `src/modules/common/components/cart-totals/index.tsx` | client | `useLocale()` | 6 calls |
| `src/modules/common/components/line-item-price/index.tsx` | shared | `useLocale()` | 3 calls |
| `src/modules/cart/templates/items.tsx` | shared | `useLocale()` | 1 call |
| `src/modules/cart/components/cart-totals/index.tsx` | client | `useLocale()` | 6 calls |
| `src/modules/cart/components/cart-drawer/index.tsx` | client | `useLocale()` in `CartDrawer` | 2 calls (l.133, l.184) |
| `src/modules/checkout/components/checkout-totals/index.tsx` | client | `useLocale()` (after the `useTranslations` line, before the early `return null`) | 6 calls |
| `src/modules/checkout/components/shipping/index.tsx` | client | `useLocale()` | 2 calls (l.128, l.164) |
| `src/modules/checkout/components/promotion-code/index.tsx` | client | `useLocale()` | 1 call (l.141) |
| `src/modules/account/components/quote-card/index.tsx` | shared | `useLocale()` | 1 call (l.90) |
| `src/modules/account/components/order-card/index.tsx` | shared | `useLocale()` | 1 call (l.89) + date l.73: `createdAt.toLocaleDateString(getFormattingLocale(locale), {…same options…})` |
| `src/modules/account/components/approval-card/index.tsx` | async | `await getLocale()` | 1 call (l.138) + 4 dates l.83/100/109/125: replace `"en-GB"` with `formattingLocale` where `const formattingLocale = getFormattingLocale(locale)` |
| `src/modules/account/components/bc-order-card/index.tsx` | async | `await getLocale()` | `formattedAmount = convertToLocale({ amount: order.totalAmountIncludingTax, currency_code: order.currencyCode, locale })`; date l.27 `toLocaleDateString(getFormattingLocale(locale), {…})` |
| `src/modules/account/components/bc-return-card/index.tsx` | async | `await getLocale()` | date l.22 `toLocaleDateString(getFormattingLocale(locale), {…})` (added by NIMBUS-140, not in BUG.md) |
| `src/modules/account/components/bc-order-line-fulfillment/index.tsx` | shared | `useLocale()` | remove module-level `dateFormatter` + `formatDate`; inside the component: `const dateFormatter = new Intl.DateTimeFormat(getFormattingLocale(locale), { dateStyle: "medium", timeZone: "UTC" })` and `const formatDate = (date: string) => dateFormatter.format(new Date(date))`. Keep `UNKNOWN_SHIPMENT_DATE` at module level. |
| `src/modules/account/components/bc-order-return/index.tsx` | client | `useLocale()` | `formattedUnitPrice = (amount: number) => convertToLocale({ amount, currency_code: order.currencyCode, locale })` |
| `src/modules/account/templates/bc-order-detail-template.tsx` | async | `await getLocale()` | `formattedAmount = (amount: number) => convertToLocale({ amount, currency_code: order.currencyCode, locale })`; l.44 `toLocaleDateString(getFormattingLocale(locale))` |
| `src/modules/order/components/order-summary/index.tsx` | async | `await getLocale()` | 1 call in `getAmount` |
| `src/modules/order/components/payment-details/index.tsx` | async | `await getLocale()` | 1 call (l.50) + l.56 `.toLocaleString(getFormattingLocale(locale))` |
| `src/modules/order/components/item/item-total-price.tsx` | shared | `useLocale()` | 2 calls |
| `src/modules/products/components/product-price/index.tsx` | shared | `useLocale()` | `getProductPrice({ product, locale })` |
| `src/modules/products/components/product-variants-table/index.tsx` | shared | `useLocale()` in `ProductVariantsTable` body (NOT inside the `.map` callback) | `getProductPrice({ product, variantId: variant.id, locale })` |
| `src/modules/products/components/product-preview/index.tsx` | async | `await getLocale()` | `getProductPrice({ product, locale })` |
| `src/modules/products/components/product-actions/mobile-actions.tsx` | client (dead code, flagged in NIMBUS-165) | `useLocale()` | `getProductPrice({ product: product, variantId: variant?.id, locale })` |
| `src/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-details/index.tsx` | client | `useLocale()` in `QuoteDetails` | 3 `formatAmount(…, …, locale)` calls (l.101, l.111, l.190) |
| `src/modules/shipping/components/free-shipping-price-nudge/index.tsx` | client | `useLocale()` in **both** `FreeShippingInline` and `FreeShippingPopup` | `formatAmount(…, …, locale)` (l.76, l.160) |
| `src/modules/account/components/employees-card/employee.tsx` | client | `useLocale()` in `Employee` | `formatAmount(…, …, locale)` (l.135, l.165) |
| `__mocks__/next-intl/server.ts` | test mock | — | add `getLocale` |
| `src/lib/i18n/README.md` | docs | — | add a short "Formatting prices and dates" section (see step 9) |

After the edits, these greps must return nothing (from `apps/storefront`):

```bash
grep -rnE '"en-GB"|"en-US"' src --include=*.ts --include=*.tsx | grep -v __tests__
grep -rn "toLocaleString()" src --include=*.tsx
```

`npx tsc --noEmit` must report no **new** errors. With `locale` required, the compiler flags any
`convertToLocale`/`getProductPrice`/`formatAmount` call you missed.

## Test Cases

### TC-1: Helper maps every supported locale to its formatting tag
- **Given:** `SUPPORTED_LOCALES`
- **When:** `getFormattingLocale(locale)` is called for each
- **Then:** da→`da-DK`, en→`en-GB`, sv→`sv-SE`, no→`nb-NO`, pl→`pl-PL`, it→`it-IT`, fr→`fr-FR`, de→`de-DE`

### TC-2: Helper falls back for an unknown locale
- **Given:** `"xx"` and `""`
- **When:** `getFormattingLocale` is called
- **Then:** returns `"en-GB"`

### TC-3: Every returned tag is supported by Intl
- **Given:** all 8 tags from TC-1
- **When:** `Intl.NumberFormat.supportedLocalesOf(tags)`
- **Then:** returns all 8 (none dropped)

### TC-4: convertToLocale formats Danish style for `da`
- **Given:** `{ amount: 1234.5, currency_code: "dkk", locale: "da" }`
- **When:** `convertToLocale` is called
- **Then:** result matches `/^1\.234,50\s?kr\.$/`. Intl uses non-breaking spaces, so always compare with
  `\s` in a regex or normalise with `.replace(/\s/g, " ")`.

### TC-5: convertToLocale keeps en as en-GB (not US)
- **Given:** `{ amount: 1234.5, currency_code: "dkk", locale: "en" }` and `{ amount: 100, currency_code: "usd", locale: "en" }`
- **When:** `convertToLocale`
- **Then:** `"DKK 1,234.50"` and `"US$100.00"`

### TC-6: convertToLocale edge cases
- **Given:** `{ amount: 1234.5, currency_code: "", locale: "da" }`, then `{ amount: 1234.5, currency_code: "eur", locale: "xx" }`
- **When:** `convertToLocale`
- **Then:** `"1234.5"` (no currency → raw number), then en-GB formatting `"€1,234.50"`

### TC-7: Client component uses the active locale (wiring)
- **Given:** `next-intl` mocked with `useLocale: () => "da"` (pattern below) and `useCart` returning a cart with
  `currency_code: "usd", total: 100`
- **When:** `<CartTotals />` (`@/modules/cart/components/cart-totals`) renders
- **Then:** `screen.getByTestId("cart-total").textContent` matches `/^100,00\s?US\$$/`

### TC-8: Async Server Component uses getLocale for amount and date (wiring)
- **Given:** `next-intl/server` mocked with `getLocale: async () => "de"`, and a BC order
  `{ orderDate: "2026-01-15T12:00:00.000Z", currencyCode: "usd", totalAmountIncludingTax: 100, … }`
- **When:** `await BcOrderCard({ order })` renders
- **Then:** `bc-order-date` has text `15.1.2026`, and the rendered amount matches `/100,00\s?\$/`

### TC-9: Existing suites still pass with the default `en` mock
- **Given:** the auto mocks (`useLocale` → `"en"`, new `getLocale` → `"en"`)
- **When:** the full suite runs
- **Then:** only the 3 baseline failures remain. In particular
  `bc-order-detail-template.test.tsx` still finds `"Ships 12 Oct 2026"` (en → en-GB, same as before), and
  every async Server Component test that now calls `getLocale` passes (approval-card, bc-order-card,
  bc-return-card, bc-order-detail-template, order-summary, payment-details, product-preview).

## Test Scaffolds

### New File: `apps/storefront/src/__tests__/lib/i18n/formatting-locale.test.ts`

```typescript
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import { SUPPORTED_LOCALES } from "@/lib/i18n/country-language-map"

const EXPECTED: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
  da: "da-DK",
  en: "en-GB",
  sv: "sv-SE",
  no: "nb-NO",
  pl: "pl-PL",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
}

describe("getFormattingLocale", () => {
  it.each(SUPPORTED_LOCALES)("maps %s to its formatting tag (TC-1)", (locale) => {
    expect(getFormattingLocale(locale)).toBe(EXPECTED[locale])
  })

  it.each(["xx", ""])("falls back to en-GB for unknown locale %p (TC-2)", (locale) => {
    // IMPLEMENT
  })

  it("only returns tags Intl supports (TC-3)", () => {
    // IMPLEMENT: const tags = SUPPORTED_LOCALES.map(getFormattingLocale)
    // expect(Intl.NumberFormat.supportedLocalesOf(tags)).toEqual(tags)
  })
})
```

### New File: `apps/storefront/src/__tests__/lib/util/money.test.ts`

```typescript
import { convertToLocale } from "@/lib/util/money"

describe("convertToLocale", () => {
  it("formats Danish style for the da locale (TC-4)", () => {
    expect(
      convertToLocale({ amount: 1234.5, currency_code: "dkk", locale: "da" })
    ).toMatch(/^1\.234,50\s?kr\.$/)
  })

  it("formats en as en-GB (TC-5)", () => {
    // IMPLEMENT: "DKK 1,234.50" and "US$100.00"
  })

  it("returns the raw amount without a currency code (TC-6)", () => {
    // IMPLEMENT
  })

  it("falls back to en-GB for an unknown locale (TC-6)", () => {
    // IMPLEMENT: expect(...).toBe("€1,234.50")
  })
})
```

### New File: `apps/storefront/src/__tests__/modules/cart/components/cart-totals/locale.test.tsx`

This overrides only `useLocale`. The rest comes from the shared manual mock. The relative path goes from this
test file to `apps/storefront/__mocks__` (this pattern was verified to work in this Jest setup).

```typescript
jest.mock("next-intl", () => ({
  ...jest.requireActual("../../../../../../__mocks__/next-intl"),
  useLocale: () => "da",
}))

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(),
}))

import { render, screen } from "@testing-library/react"

import { useCart } from "@/lib/context/cart-context"
import CartTotals from "@/modules/cart/components/cart-totals"

describe("CartTotals locale formatting", () => {
  it("formats the total with the active locale (TC-7)", () => {
    ;(useCart as jest.Mock).mockReturnValue({
      isUpdatingCart: false,
      cart: {
        currency_code: "usd",
        total: 100,
        item_subtotal: 90,
        tax_total: 10,
        shipping_total: 0,
        discount_total: 0,
        gift_card_total: 0,
      },
    })

    render(<CartTotals />)

    // IMPLEMENT: expect(screen.getByTestId("cart-total").textContent).toMatch(/^100,00\s?US\$$/)
  })
})
```

### Modified File: `apps/storefront/src/__tests__/modules/account/components/bc-order-card/index.test.tsx`

This needs a file-level `jest.mock("next-intl/server", …)` for the `de` case. That would affect the existing
tests in the file, so put TC-8 in a **new** file:
`apps/storefront/src/__tests__/modules/account/components/bc-order-card/locale.test.tsx`:

```typescript
jest.mock("next-intl/server", () => ({
  ...jest.requireActual("../../../../../../__mocks__/next-intl/server"),
  getLocale: async () => "de",
}))

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "de" })),
}))

import { render, screen } from "@testing-library/react"

import BcOrderCard from "@/modules/account/components/bc-order-card"

const order = {
  id: "order-1",
  number: "BC-1",
  orderDate: "2026-01-15T12:00:00.000Z",
  currencyCode: "usd",
  totalAmountIncludingTax: 100,
  status: "Open",
  invoiceStatus: "open",
} as any

describe("BcOrderCard locale formatting", () => {
  it("formats date and amount with the active locale (TC-8)", async () => {
    render(await BcOrderCard({ order }))
    // IMPLEMENT: expect(screen.getByTestId("bc-order-date")).toHaveTextContent("15.1.2026")
    // IMPLEMENT: expect(document.body.textContent).toMatch(/100,00\s?\$/)
  })
})
```

## Implementation Steps

1. Create `src/lib/i18n/formatting-locale.ts` from the skeleton and fill in the `IMPLEMENT` lines.
2. Replace `src/lib/util/money.ts` with the skeleton content.
3. Add `getLocale` to `__mocks__/next-intl/server.ts`.
4. Update `get-product-price.ts` and `amount-cell/index.tsx` (skeletons above).
5. Work through the Impacted Files table top to bottom. For each file: add the locale source at the top of
   the component body (hooks must stay unconditional and before any early `return`), add `locale` to every
   formatter call, and replace `"en-GB"`/`"en-US"`/argument-less `toLocaleString()` with
   `getFormattingLocale(locale)`.
6. Run the two greps from "Impacted Files". Both must be empty.
7. `npx tsc --noEmit -p tsconfig.json`: the error count must still be 10, with the same files as the baseline.
8. Add the 4 test files (TC-1…TC-8). Run `pnpm test`: only the 3 baseline failures may remain.
9. Append to `src/lib/i18n/README.md`:
   ```markdown
   ## Formatting prices and dates

   Never hardcode a formatting locale. Get the active next-intl locale (`useLocale()` in
   non-async components, `await getLocale()` in async Server Components) and pass it to
   `convertToLocale({ ..., locale })`, or to `Intl.*` / `toLocale*String` via
   `getFormattingLocale(locale)` from `src/lib/i18n/formatting-locale.ts` (e.g. `da` → `da-DK`,
   `en` → `en-GB`).
   ```
10. Do not touch currency selection, routing, or `country-language-map.ts`.
