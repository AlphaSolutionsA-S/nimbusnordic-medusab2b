# NIMBUS-173: Multi-lingual storefront: remaining English text not translated

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-173

## Objective
Every customer-visible text, tab title, price, date and error in the storefront follows the active
country/language, with no Medusa template copy left, plus a lint guard against regressions.

## Analysis
All BUG.md findings were checked against `develop` @ `e913d55`. They hold, with these differences:

- **Formatting:** `convertToLocale` is called 36 times in 15 files. One of them is the `get-product-price.ts`
  util, whose 4 calling components also need the locale. A second money formatter, `formatAmount` in `common/components/amount-cell` (hardcoded
  `en-US`), is used by `AmountCell`, quote details, the free-shipping nudge and employee cards. The new
  `bc-return-card` (NIMBUS-140) adds another hardcoded `en-GB` date. The fix covers 13 hardcoded
  `en-GB`/`en-US` sites plus the argument-less `toLocaleString()`.
- **Metadata:** Next **15.5.18** resolves `generateMetadata` on `not-found` modules
  (`resolve-metadata.js` → `getDefinedMetadata(errorMod)`), so the not-found pages use `generateMetadata`
  too. The new `returns/page.tsx` (NIMBUS-140) also has static English metadata and is included.
- **Errors:** in production, Next.js replaces the message of errors *thrown* from Server Actions. So showing
  `err.message` shows English backend text in dev and a generic English Next.js sentence in prod. Error
  codes can only survive in values that a Server Action *returns* (`useActionState` actions). The design
  therefore puts the translated generic fallback at the UI boundary, with a small stable code
  (`CART_NOT_FOUND`) where it can survive.
- **Catalog reuse:** "Note:" (`Cart.addNoteButton.noteLabel`), "Cart", "Products" and "Country" already exist
  as keys. They are reused rather than duplicated.
- **Tests:** next-intl is mocked globally (`__mocks__/next-intl.tsx`, `__mocks__/next-intl/server.ts`, en catalog).
  The server mock has no `getLocale`, so Task 01 adds it; without it every async Server Component test would
  break. A per-file locale override (`jest.requireActual` of the mock file + `useLocale`/`getLocale` override)
  was verified to work. Tests that need expectation updates: `checkout-layout.test.tsx` (brand),
  `common/components/thumbnail/index.test.tsx` (alt), `country-select` (test title), and
  `bctest-page.test.tsx` (deleted). Price/date assertions in existing tests are unaffected, because en keeps
  formatting as en-GB (e.g. "Ships 12 Oct 2026").
- **Tooling:** `next.config.js` has `typescript.ignoreBuildErrors: true`, so a required `locale` param is only
  enforced by running `tsc --noEmit` (baseline: 10 errors). The lint dry run of `react/jsx-no-literals`
  with the planned allowlist reports exactly 8 warnings on develop, all fixed by Tasks 02/03.

## Execution Plan
1. **Task 01:** add `getFormattingLocale` (`src/lib/i18n/formatting-locale.ts`, derived from
   `COUNTRY_LANGUAGE_MAP`, `no` → `nb-NO`). Make `locale` required in `convertToLocale`, `getProductPrice` and
   `formatAmount`. Wire `useLocale()` / `await getLocale()` into all callers and replace every hardcoded
   formatter. Add `getLocale` to the server mock.
2. **Task 02:** add the `Metadata` namespace (15 pages, 8 locales). Convert static `metadata` to
   `generateMetadata`, including the three segment not-found pages (reusing `Common.notFound`) and the
   root not-found (server-only `getTranslations`, `en` default).
3. **Task 03:** cart toasts, payment method titles (`titleKey`), payment icon titles, skeletons, "Note:",
   the country placeholder, BC status filter labels, the claims fallback, and the product thumbnail alt.
   Fix `altFallback` and `brandName`. Remove the bctest page, its test, the `BcTest` namespace and
   `listBusinessCentralOperations`.
4. **Task 04:** `customer-error.ts` (code + key mapping + PII-free logging) and the `useCustomerErrorMessage`
   hook. Replace all `err.message` displays. Add a specific translated message for promotion codes and
   Stripe card errors, and translated zod messages in the quote form. Use `CART_NOT_FOUND` in `cart.ts`.
5. **Task 05:** `react/jsx-no-literals` at warn for `src/app` + `src/modules`, with a glyph allowlist.
6. **Task 06:** automated gates plus manual checks on /dk, /de, /gb, with evidence in PROGRESS.md.

## Decisions & Trade-offs
- **`Intl` + helper, not next-intl `useFormatter`:** `convertToLocale` is also called from a plain util, so it
  cannot use a hook. `Intl` everywhere is one approach, and tests use real Node ICU with no extra mocks.
- **Callers pass the next-intl locale (`"da"`), and `convertToLocale` maps it internally.** This leaves one
  mapping point, and the compiler catches missed callers (when `tsc` is run).
- **Implicit `getTranslations("Metadata.x")`** (request-header locale) in new `generateMetadata`s. The existing
  product/category/collection pages keep their explicit `getLocaleForCountry` form.
- **Tab titles keep their current shape** (bare page name, no "| Nimbus Nordic" suffix). Only the home title is
  the brand. Adding a suffix everywhere would be a small follow-up if wanted.
- **Root not-found:** plain `getTranslations` resolves `en` when no country header is present (decision 3). For an
  unmatched URL under a country segment, middleware has already set the header, so that page renders in the
  country's language. This is next-intl's normal behaviour, not Accept-Language negotiation.
- **Generic fallback at the UI boundary** (decision 6), plus 3 targeted messages (promotion code, Stripe
  card/validation errors, password update) where a generic text would hide what the customer must do.
- **BC status filters:** option values stay (they are BC API filter values). Only the visible label is
  translated. The same fix is applied to the new `bc-return-filters`.
- **`paymentInfoMap`:** `title` becomes `titleKey` (a type-checked union). Brand names (iDeal, Bancontact,
  PayPal) are catalog values identical in all locales.

## Verification
- [ ] `pnpm test`: only the 3 baseline failures. New tests cover: the helper for all 8 locales plus the fallback;
      `convertToLocale` da/en/edge cases; locale wiring in a client (`CartTotals`, da) and an async server
      (`BcOrderCard`, de) component; metadata in en and da; order-details interpolation and not-found edge;
      root and segment not-found; payment titles; cart toasts; thumbnail alt; claims fallback; error-key mapping;
      PII-free logging; the translated shipping error; promotion error; zod message; `cart.ts` error code.
- [ ] `message-catalogs.test.ts` passes (key parity across 8 locales after additions and the `BcTest` removal).
- [ ] `tsc --noEmit`: no new errors (still 10). `pnpm lint`: 0 `react/jsx-no-literals` warnings. `pnpm build` passes.
- [ ] Greps: no `"en-GB"`/`"en-US"`, no `toLocaleString()`, no Medusa template copy, no `BcTest`/`bctest`.
- [ ] Manual /dk, /de, /gb: prices (`1.234,50 kr.`), dates, tab titles, checkout payment names, header brand,
      a forced cart error toast, and the quote validation message.

### Follow-ups noticed (not in scope, not fixed)
- `Checkout.review.agreementText` still says "Medusa's Terms of Sale" in all locales (template copy).
- `Layout.promoBanner` ("Build your own B2B store…", "Deploy to Medusa Cloud") and `MedusaCTA` in the
  checkout layout are template copy. The `main-layout.test.tsx` baseline failure is related.
- BC order/return **status values** shown raw in `bc-order-card`, `bc-return-card` and
  `bc-order-detail-template` (BC data such as "Open", "Released").
- Login/register (`lib/data/customer.ts`) action messages and `payment/index.tsx`'s Stripe `CardElement`
  inline error (Stripe localises it by browser locale, not by storefront locale) are not covered by
  BUG.md §5.
- `setBillingAddress`/`setContactDetails` call `getCartId()` without `await` (the check is always truthy).
- `medusaError` logs full response data and headers server-side (possible PII in logs, OWASP A09).
- `setRequestLocale(countryCode)` in `[countryCode]/layout.tsx` passes a country code, not a locale.
  It is harmless because the header decides the locale.
