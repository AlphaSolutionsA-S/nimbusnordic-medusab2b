# Task 03: Remaining hardcoded UI text, catalog value fixes and bctest removal — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-173 (from develop)
**Depends on:** Task 01 (`payment-details/index.tsx` and `product-preview/index.tsx` are edited in both) and
Task 02 (`claims/page.tsx` and `messages/*.json` are edited in both)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build`, plus `npx tsc --noEmit -p tsconfig.json` (baseline: 10
  errors, see Task 01; the build ignores TS errors)
- **Lint command:** `cd apps/storefront && pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test` (baseline: 3 pre-existing failures, see Task 01)
- **Test framework:** Jest + React Testing Library; the next-intl auto mocks resolve against `messages/en.json`
- **Test location:** `apps/storefront/src/__tests__/…` (mirrors `src/`)
- **Conventions:** double quotes, no semicolons, except the files that already use single quotes + semicolons
  (`claims/page.tsx`, `lib/util/map-claims-page.ts`, `types/cms.ts`, where you keep the local style).
  Namespace rules from `issues/NIMBUS-165/extraction-checklist.md`: reuse an existing key when the text is
  the same; a component reachable from both trees uses `useTranslations` (works in non-async Server and
  Client Components); an `async` Server Component uses `getTranslations`.

## Solution Design

Each BUG.md §1/§4 item and its fix (CSV headers stay English by decision 7, so `convert-cart-to-csv.ts`
is **not** touched):

| # | Item | Fix | Key |
|---|---|---|---|
| A | `cart-context.tsx` toasts (l.85, 172, 174, 218, 279, 298) | `const t = useTranslations("Cart.cartContext")` in `CartProvider` | **new** `Cart.cartContext.*` |
| B | `add-note-button` "Note:" (l.94) | reuse the existing key | `Cart.addNoteButton.noteLabel` (exists) |
| C | `skeleton-cart-button` "Cart" | reuse | `Cart.cartDrawer.cartLabel` (exists) |
| D | `skeleton-mega-menu` "Products" | reuse | `Layout.megaMenu.productsLabel` (exists) |
| E | `country-select` default `placeholder = "Country"` | default from catalog | `Checkout.addressForm.countryPlaceholder` (exists) |
| F | `paymentInfoMap` titles (`lib/constants.tsx`) | map keeps provider ids and icons; `title: string` → `titleKey: PaymentMethodTitleKey`; resolved at render | **new** `Common.paymentMethods.*` |
| G | `bc-order-filters` "Open"/"Draft" option text (and the same pattern in `bc-return-filters`, "Open"/"Released", added by NIMBUS-140) | option **values** stay (BC API filter values), only the visible label is translated | **new** `Account.bcStatus.*` |
| H | `map-claims-page.ts` fallback `'Claims'` (and `EMPTY_CLAIMS_PAGE.title` in `claims/page.tsx`) | map a missing CMS title to `undefined`, so `ClaimsPageContent` falls back to its translated `defaultTitle` | `Account.claimsPageContent.defaultTitle` (exists) |
| I | `products/components/thumbnail` `alt="Thumbnail"` | new optional `alt` prop (callers pass the product title) + translated fallback | `Common.thumbnail.altFallback` (value fixed) |
| J | `bancontact.tsx` / `ideal.tsx` SVG `<title>` | brand stays; the word "icon" is translated | **new** `Common.paymentIcon.title` = `"{brand} icon"` |
| K | `Common.thumbnail.altFallback` = "test" | real value in all 8 locales | value change |
| L | `Layout.nav.brandName` = "Medusa B2B Starter" | "Nimbus Nordic" in all 8 locales (decision 1) | value change |
| M | `bctest` page (requirement G) | delete the page and its test, remove the `BcTest` namespace from all 8 catalogs, and delete `listBusinessCentralOperations` + its private `StoreBusinessCentralOperationsResponse` type (the page was the only caller; verified by grep) | namespace removal |

Out of this task: the payment-button fallback error and all `err.message` displays are handled in Task 04.

## Code Skeletons

### Modified: `src/lib/constants.tsx` (top part)

```typescript
import Bancontact from "@/modules/common/icons/bancontact"
import FilePlus from "@/modules/common/icons/file-plus"
import Ideal from "@/modules/common/icons/ideal"
import PayPal from "@/modules/common/icons/paypal"
import { CreditCard } from "@medusajs/icons"
import React from "react"

// Keys of the `Common.paymentMethods` catalog namespace.
export type PaymentMethodTitleKey =
  | "creditCard"
  | "ideal"
  | "bancontact"
  | "paypal"
  | "invoice"

export type PaymentInfo = {
  titleKey: PaymentMethodTitleKey
  icon: React.JSX.Element
}

/* Map of payment provider_id to its title key and icon. Titles are resolved
   through `Common.paymentMethods` at render time. */
export const paymentInfoMap: Record<string, PaymentInfo> = {
  pp_stripe_stripe: { titleKey: "creditCard", icon: <CreditCard /> },
  "pp_medusa-payments_default": { titleKey: "creditCard", icon: <CreditCard /> },
  "pp_stripe-ideal_stripe": { titleKey: "ideal", icon: <Ideal /> },
  "pp_stripe-bancontact_stripe": { titleKey: "bancontact", icon: <Bancontact /> },
  pp_paypal_paypal: { titleKey: "paypal", icon: <PayPal /> },
  pp_system_default: { titleKey: "invoice", icon: <FilePlus /> },
  // Add more payment providers here
}
// isStripeLike / isPaypal / isManual / currencySymbolMap … unchanged
```

### Render sites for payment titles

- `src/modules/checkout/components/payment/index.tsx` (client): add
  `const tPaymentMethods = useTranslations("Common.paymentMethods")` next to the existing `t`. Replace
  - l.242 `paymentInfoMap[selectedPaymentMethod]?.title || selectedPaymentMethod` →
    `paymentInfoMap[selectedPaymentMethod] ? tPaymentMethods(paymentInfoMap[selectedPaymentMethod].titleKey) : selectedPaymentMethod`
  - l.259 `: paymentInfoMap[selectedPaymentMethod]?.title` →
    `: paymentInfoMap[selectedPaymentMethod] && tPaymentMethods(paymentInfoMap[selectedPaymentMethod].titleKey)`
- `src/modules/checkout/components/payment-container/index.tsx`: prop type
  `paymentInfoMap: Record<string, PaymentInfo>` (`import { isManual, type PaymentInfo } from "@/lib/constants"`;
  drop the now-unused `type JSX` import if nothing else uses it). Add
  `const tPaymentMethods = useTranslations("Common.paymentMethods")` (`import { useTranslations } from "next-intl"`).
  l.42 → `{paymentInfoMap[paymentProviderId] ? tPaymentMethods(paymentInfoMap[paymentProviderId].titleKey) : paymentProviderId}`
- `src/modules/order/components/payment-details/index.tsx` (async): add
  `const tPaymentMethods = await getTranslations("Common.paymentMethods")`. l.33 →
  `{tPaymentMethods(paymentInfoMap[payment.provider_id].titleKey)}` (keep the existing non-optional access).

### Modified: `src/modules/common/icons/ideal.tsx` (same change in `bancontact.tsx` with `brand: "Bancontact"`)

```typescript
import { useTranslations } from "next-intl"
// …
const Ideal: React.FC<IconProps> = ({ size = "20", color = "currentColor", ...attributes }) => {
  const t = useTranslations("Common.paymentIcon")

  return (
    <svg /* unchanged attributes */>
      <title>{t("title", { brand: "iDEAL" })}</title>
      {/* path unchanged */}
    </svg>
  )
}
```

(`bancontact.tsx` declares its component as `const Ideal` too. That is pre-existing, so leave the name.)

### Modified: `src/lib/context/cart-context.tsx`

Add `import { useTranslations } from "next-intl"`. In `CartProvider`, after `const { countryCode } = useParams()`,
add `const t = useTranslations("Cart.cartContext")`. Replace:

| Line | Old | New |
|---|---|---|
| 85 | `toast.error("Cart is locked for approval.")` | `toast.error(t("lockedForApprovalToast"))` |
| 172 | same text | `toast.error(t("lockedForApprovalToast"))` |
| 174 | `"Failed to add to cart"` | `t("addToCartFailedToast")` |
| 218 | `"Failed to delete item"` | `t("deleteItemFailedToast")` |
| 279 | `"Failed to update cart quantity"` | `t("updateQuantityFailedToast")` |
| 298 | `"Failed to empty cart"` | `t("emptyCartFailedToast")` |

Leave the `e.message === "Cart is pending approval"` comparison as it is (Task 04 covers error mapping; that
message is not thrown anywhere in the current code). Do not change the `useCallback` dependency array (there
is a pre-existing `exhaustive-deps` warning; leave it). Adding `t` to the deps is not required, because `t` is stable.

### Modified: `src/modules/cart/components/add-note-button/index.tsx` (l.94)

```tsx
<span className="text-neutral-950">{`${t("noteLabel")} `}</span>
```

### Modified: skeletons

```tsx
// skeleton-cart-button/index.tsx
import { useTranslations } from "next-intl"
import ShoppingBag from "@/modules/common/icons/shopping-bag"

export default function SkeletonCartButton() {
  const t = useTranslations("Cart.cartDrawer")
  // … <span …>{t("cartLabel")}</span> … the "0" badge stays
}

// skeleton-mega-menu/index.tsx
import { useTranslations } from "next-intl"
// …
export default function SkeletonMegaMenu() {
  const t = useTranslations("Layout.megaMenu")
  // … <LocalizedClientLink …>{t("productsLabel")}</LocalizedClientLink>
}
```

### Modified: `src/modules/checkout/components/country-select/index.tsx`

```tsx
import { useTranslations } from "next-intl"
// …
>(({ placeholder, region, defaultValue, ...props }, ref) => {
  const t = useTranslations("Checkout.addressForm")
  // … unchanged …
  <NativeSelect
    ref={innerRef}
    placeholder={placeholder ?? t("countryPlaceholder")}
    // …
```

(`forwardRef` render functions may call hooks. Keep the existing `CountrySelect.displayName`, if present.)

### Modified: `src/modules/account/components/bc-order-filters/index.tsx` and `bc-return-filters/index.tsx`

```tsx
// bc-order-filters
const BC_ORDER_STATUSES: BCOrderStatus[] = ["Open", "Draft"] // unchanged values

// Visible labels only — option values stay as the BC API filter values.
const STATUS_LABEL_KEYS = {
  Open: "open",
  Draft: "draft",
} as const satisfies Partial<Record<BCOrderStatus, string>>

// in the component:
const tStatus = useTranslations("Account.bcStatus")
// …
{BC_ORDER_STATUSES.map((s) => (
  <option key={s} value={s}>
    {tStatus(STATUS_LABEL_KEYS[s as keyof typeof STATUS_LABEL_KEYS])}
  </option>
))}
```

For `bc-return-filters` (`BC_RETURN_STATUSES = ["Open", "Released"] as const`) use
`const STATUS_LABEL_KEYS = { Open: "open", Released: "released" } as const` and index with `STATUS_LABEL_KEYS[s]`.
The raw `order.status` / `item.status` shown in `bc-order-card`, `bc-return-card` and
`bc-order-detail-template` are BC data values and are **not** changed (see PLAN.md follow-ups).

### Modified: claims fallback

```typescript
// src/types/cms.ts
export type ClaimsPage = {
  title?: string;
  layout: ReadonlyArray<ClaimsBlock>;
};

// src/lib/util/map-claims-page.ts, l.20
    title: document.title || undefined,

// src/app/[countryCode]/(main)/account/@dashboard/claims/page.tsx
const EMPTY_CLAIMS_PAGE: PayloadClaimsPage = {
  layout: [],
};
```

`ClaimsPageContent` already renders `page?.title ?? t('defaultTitle')`, so it needs no change. Check with
`npx tsc --noEmit` that nothing else reads `ClaimsPage.title` as a required string
(`grep -rn "\.title" src/modules/account/components/claims-*`).

### Modified: `src/modules/products/components/thumbnail/index.tsx`

```tsx
import { useTranslations } from "next-intl"
// …
type ThumbnailProps = {
  thumbnail?: string | null
  // TODO: Fix image typings
  images?: any[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  type?: "preview" | "full"
  // Accessible image description, e.g. the product title. Falls back to a
  // translated generic "Product image".
  alt?: string | null
  "data-testid"?: string
}

// Thumbnail: destructure `alt` and pass it on: <ImageOrPlaceholder image={initialImage} size={size} type={type} alt={alt} />

const ImageOrPlaceholder = ({
  image,
  size,
  type,
  alt,
}: Pick<ThumbnailProps, "size" | "type" | "alt"> & {
  image?: string
}) => {
  const t = useTranslations("Common.thumbnail")

  return image ? (
    <Image
      src={image}
      alt={alt || t("altFallback")}
      // … rest unchanged
```

Callers that pass the product title:

| File | Add prop |
|---|---|
| `src/modules/cart/components/item-full/index.tsx` l.99 | `alt={item.product?.title}` |
| `src/modules/cart/components/item-preview/index.tsx` l.33 | `alt={item.product?.title}` |
| `src/modules/order/components/item/index.tsx` l.17 | `alt={item.product_title}` |
| `src/modules/products/components/product-preview/index.tsx` l.39 | `alt={product.title}` |
| `src/modules/account/components/previously-purchased/product.tsx` l.21 | `alt={product_title}` |
| `src/app/[countryCode]/(main)/account/@dashboard/quotes/components/quote-table/index.tsx` l.36 | `alt={item.product_title}` |

### bctest removal

- Delete `src/app/[countryCode]/(main)/bctest/page.tsx` (and the now-empty `bctest/` folder).
- Delete `src/__tests__/app/bctest-page.test.tsx`.
- In `src/lib/data/business-central.ts`, delete `type StoreBusinessCentralOperationsResponse` (l.17–19) and
  `export const listBusinessCentralOperations` (l.21–34). Keep all other exports and imports (`sdk` and
  `getAuthHeaders` are still used).
- Before deleting, re-run `grep -rn "listBusinessCentralOperations\|bctest\|BcTest" apps/storefront` (excluding
  `node_modules`/`.next`) and confirm the page and its test are the only users. The backend route
  `/store/business-central/operations` stays (no backend changes in this bug).

## Catalog changes

Use the merge script from Task 02 (`apply-catalog-02.mjs`, same code) with this `CHANGES` object
(`null` deletes a key):

```javascript
const CHANGES = {
  en: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Product image" },
      paymentMethods: { creditCard: "Credit card", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Pay by invoice" },
      paymentIcon: { title: "{brand} icon" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Cart is locked for approval.",
      addToCartFailedToast: "Failed to add to cart",
      deleteItemFailedToast: "Failed to delete item",
      updateQuantityFailedToast: "Failed to update cart quantity",
      emptyCartFailedToast: "Failed to empty cart",
    } },
    Account: { bcStatus: { open: "Open", draft: "Draft", released: "Released" } },
  },
  da: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Produktbillede" },
      paymentMethods: { creditCard: "Kreditkort", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Betal med faktura" },
      paymentIcon: { title: "{brand}-ikon" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Kurven er låst, mens den afventer godkendelse.",
      addToCartFailedToast: "Kunne ikke tilføje til kurven",
      deleteItemFailedToast: "Kunne ikke fjerne varen",
      updateQuantityFailedToast: "Kunne ikke opdatere antallet i kurven",
      emptyCartFailedToast: "Kunne ikke tømme kurven",
    } },
    Account: { bcStatus: { open: "Åben", draft: "Kladde", released: "Frigivet" } },
  },
  sv: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Produktbild" },
      paymentMethods: { creditCard: "Kreditkort", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Betala mot faktura" },
      paymentIcon: { title: "{brand}-ikon" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Varukorgen är låst i väntan på godkännande.",
      addToCartFailedToast: "Det gick inte att lägga till i varukorgen",
      deleteItemFailedToast: "Det gick inte att ta bort artikeln",
      updateQuantityFailedToast: "Det gick inte att uppdatera antalet i varukorgen",
      emptyCartFailedToast: "Det gick inte att tömma varukorgen",
    } },
    Account: { bcStatus: { open: "Öppen", draft: "Utkast", released: "Frisläppt" } },
  },
  no: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Produktbilde" },
      paymentMethods: { creditCard: "Kredittkort", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Betal med faktura" },
      paymentIcon: { title: "{brand}-ikon" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Handlekurven er låst mens den venter på godkjenning.",
      addToCartFailedToast: "Kunne ikke legge til i handlekurven",
      deleteItemFailedToast: "Kunne ikke fjerne varen",
      updateQuantityFailedToast: "Kunne ikke oppdatere antallet i handlekurven",
      emptyCartFailedToast: "Kunne ikke tømme handlekurven",
    } },
    Account: { bcStatus: { open: "Åpen", draft: "Utkast", released: "Frigitt" } },
  },
  pl: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Zdjęcie produktu" },
      paymentMethods: { creditCard: "Karta kredytowa", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Płatność na fakturę" },
      paymentIcon: { title: "Ikona {brand}" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Koszyk jest zablokowany do czasu zatwierdzenia.",
      addToCartFailedToast: "Nie udało się dodać do koszyka",
      deleteItemFailedToast: "Nie udało się usunąć produktu",
      updateQuantityFailedToast: "Nie udało się zaktualizować ilości w koszyku",
      emptyCartFailedToast: "Nie udało się opróżnić koszyka",
    } },
    Account: { bcStatus: { open: "Otwarte", draft: "Wersja robocza", released: "Zwolnione" } },
  },
  it: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Immagine del prodotto" },
      paymentMethods: { creditCard: "Carta di credito", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Pagamento con fattura" },
      paymentIcon: { title: "Icona {brand}" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Il carrello è bloccato in attesa di approvazione.",
      addToCartFailedToast: "Impossibile aggiungere al carrello",
      deleteItemFailedToast: "Impossibile rimuovere l'articolo",
      updateQuantityFailedToast: "Impossibile aggiornare la quantità nel carrello",
      emptyCartFailedToast: "Impossibile svuotare il carrello",
    } },
    Account: { bcStatus: { open: "Aperto", draft: "Bozza", released: "Rilasciato" } },
  },
  fr: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Image du produit" },
      paymentMethods: { creditCard: "Carte bancaire", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Paiement sur facture" },
      paymentIcon: { title: "Icône {brand}" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Le panier est verrouillé en attente d'approbation.",
      addToCartFailedToast: "Impossible d'ajouter au panier",
      deleteItemFailedToast: "Impossible de supprimer l'article",
      updateQuantityFailedToast: "Impossible de mettre à jour la quantité du panier",
      emptyCartFailedToast: "Impossible de vider le panier",
    } },
    Account: { bcStatus: { open: "Ouvert", draft: "Brouillon", released: "Lancé" } },
  },
  de: {
    BcTest: null,
    Common: {
      thumbnail: { altFallback: "Produktbild" },
      paymentMethods: { creditCard: "Kreditkarte", ideal: "iDeal", bancontact: "Bancontact", paypal: "PayPal", invoice: "Kauf auf Rechnung" },
      paymentIcon: { title: "{brand}-Symbol" },
    },
    Layout: { nav: { brandName: "Nimbus Nordic" } },
    Cart: { cartContext: {
      lockedForApprovalToast: "Der Warenkorb ist bis zur Genehmigung gesperrt.",
      addToCartFailedToast: "Artikel konnte nicht in den Warenkorb gelegt werden",
      deleteItemFailedToast: "Artikel konnte nicht entfernt werden",
      updateQuantityFailedToast: "Menge im Warenkorb konnte nicht aktualisiert werden",
      emptyCartFailedToast: "Warenkorb konnte nicht geleert werden",
    } },
    Account: { bcStatus: { open: "Offen", draft: "Entwurf", released: "Freigegeben" } },
  },
}
```

## Impacted Files

- `messages/{en,da,sv,no,pl,it,fr,de}.json`: see above
- `src/lib/constants.tsx`: `paymentInfoMap` shape + exported `PaymentMethodTitleKey`, `PaymentInfo`
- `src/modules/checkout/components/payment/index.tsx`, `payment-container/index.tsx`,
  `src/modules/order/components/payment-details/index.tsx`: title resolution
- `src/modules/common/icons/ideal.tsx`, `bancontact.tsx`: translated `<title>`
- `src/lib/context/cart-context.tsx`: 6 toasts
- `src/modules/cart/components/add-note-button/index.tsx`: "Note:"
- `src/modules/skeletons/components/skeleton-cart-button/index.tsx`, `skeleton-mega-menu/index.tsx`
- `src/modules/checkout/components/country-select/index.tsx`: default placeholder
- `src/modules/account/components/bc-order-filters/index.tsx`, `bc-return-filters/index.tsx`: status labels
- `src/types/cms.ts`, `src/lib/util/map-claims-page.ts`, `src/app/[countryCode]/(main)/account/@dashboard/claims/page.tsx`
- `src/modules/products/components/thumbnail/index.tsx` + 6 callers (table above)
- Deleted: `src/app/[countryCode]/(main)/bctest/page.tsx`, `src/__tests__/app/bctest-page.test.tsx`
- `src/lib/data/business-central.ts`: remove `listBusinessCentralOperations` + type
- Tests (see below)

## Test Cases

### TC-1: Payment method titles are translated at render time
- **Given:** `payment-details` test order with `provider_id: "pp_system_default"` and no `card_last4`
- **When:** `await PaymentDetails({ order })` renders (en mock)
- **Then:** `screen.getByTestId("payment-method")` has text `"Pay by invoice"`. The existing Stripe test case
  shows `"Credit card"`.

### TC-2: Unknown payment provider falls back to its id (edge)
- **Given:** `<RadioGroup>` wrapping `<PaymentContainer paymentProviderId="pp_unknown" paymentInfoMap={paymentInfoMap} selectedPaymentOptionId={null} />`
  (`import { RadioGroup } from "@headlessui/react"`)
- **When:** rendered
- **Then:** the text `"pp_unknown"` is shown

### TC-3: Cart toasts are translated (wiring)
- **Given:** `@/lib/data/cart` mocked with `deleteLineItem: jest.fn().mockRejectedValue(new Error("x"))`,
  `@medusajs/ui`'s `toast` mocked (`jest.mock("@medusajs/ui", () => ({ ...jest.requireActual("@medusajs/ui"), toast: { error: jest.fn() } }))`),
  `next/navigation` `useParams → { countryCode: "gb" }`, and a test consumer inside `<CartProvider cart={cart}>`
  that calls `handleDeleteItem("item_1")` from `useCart()`
- **When:** the delete fails
- **Then:** `toast.error` was called with `"Failed to delete item"` (the en catalog value)

### TC-4: Payment icon titles keep the brand and translate "icon"
- **Given:** `<Ideal />` and `<Bancontact />` rendered
- **When:** the SVG `<title>` is read (`container.querySelector("title")?.textContent`)
- **Then:** `"iDEAL icon"` and `"Bancontact icon"` in en

### TC-5: Skeletons and add-note use catalog text
- **Given:** `<SkeletonCartButton />`, `<SkeletonMegaMenu />` (mock `next/navigation` `useParams`, as
  other `LocalizedClientLink` tests do), and the existing add-note test
- **When:** rendered
- **Then:** `"Cart"`, `"Products"` and `"Note:"` are shown. The existing `add-note-button` test must still pass.

### TC-6: Country select default placeholder comes from the catalog
- **Given:** the existing `country-select` test
- **When:** rendered without a `placeholder` prop
- **Then:** the option `"Country"` is shown. Rename the first test to
  `"falls back to the translated catalog placeholder when the caller passes none"`.

### TC-7: BC filter labels are translated but values stay
- **Given:** `<BcOrderFilters />` and `<BcReturnFilters />`
- **When:** rendered
- **Then:** option `"Open"` has `value="Open"`; `"Draft"` / `"Released"` are shown. For a locale check, add a
  new test file with `useLocale`/`useTranslations` from a `da`-backed mock (optional). The minimum is the en
  label plus the value assertion.

### TC-8: Missing CMS claims title falls back to the translated default
- **Given:** `mapPayloadClaimsPage({ layout: [] })` (no title)
- **When:** the result is rendered with `<ClaimsPageContent page={result} />`
- **Then:** `mapPayloadClaimsPage` returns `title: undefined`, and the heading shows `"Claims"` (from
  `Account.claimsPageContent.defaultTitle`). The existing `cms.test.ts` case with `title: 'Claims'` still passes.

### TC-9: Product thumbnail alt uses the title, with a translated fallback
- **Given:** `<Thumbnail thumbnail="/a.png" alt="Polo shirt" />` and `<Thumbnail thumbnail="/a.png" />`
  (`@/modules/products/components/thumbnail`)
- **When:** rendered
- **Then:** `getByAltText("Polo shirt")`; `getByAltText("Product image")`

### TC-10: Catalog value fixes and brand name
- **Given:** the updated catalogs
- **When:** `checkout-layout.test.tsx` and `common/components/thumbnail/index.test.tsx` run
- **Then:** update their expectations: `"Medusa B2B Starter"` → `"Nimbus Nordic"`, and alt `"test"` →
  `"Product image"`. Both pass.

### TC-11: bctest is gone and catalogs stay in parity
- **Given:** the deletions
- **When:** `pnpm test` runs, and `grep -rn "BcTest\|bctest\|listBusinessCentralOperations" src messages` (from `apps/storefront`)
- **Then:** `message-catalogs.test.ts` passes, `business-central.test.ts` passes, and grep returns nothing

## Test Scaffolds

### New File: `src/__tests__/lib/context/cart-context.test.tsx` (TC-3)

```tsx
jest.mock("@/lib/data/cart", () => ({
  addToCartBulk: jest.fn(),
  deleteLineItem: jest.fn(),
  emptyCart: jest.fn(),
  updateLineItem: jest.fn(),
}))
jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { registerCartAddHandler: jest.fn() },
}))
jest.mock("next/navigation", () => ({ useParams: jest.fn(() => ({ countryCode: "gb" })) }))
jest.mock("@medusajs/ui", () => ({
  ...jest.requireActual("@medusajs/ui"),
  toast: { error: jest.fn() },
}))

import { act, render, waitFor } from "@testing-library/react"
import { toast } from "@medusajs/ui"
import { useEffect } from "react"

import { deleteLineItem } from "@/lib/data/cart"
import { CartProvider, useCart } from "@/lib/context/cart-context"
import type { B2BCart } from "@/types/global"

const cart = {
  id: "cart_1",
  items: [{ id: "item_1", quantity: 1, unit_price: 10, created_at: "2026-01-01" }],
} as unknown as B2BCart

function DeleteOnMount() {
  const { handleDeleteItem } = useCart()
  useEffect(() => {
    void handleDeleteItem("item_1")
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount
  return null
}

describe("CartProvider toasts", () => {
  it("shows the translated delete-failure toast (TC-3)", async () => {
    ;(deleteLineItem as jest.Mock).mockRejectedValueOnce(new Error("backend text"))
    // IMPLEMENT: render(<CartProvider cart={cart}><DeleteOnMount /></CartProvider>) inside act
    // IMPLEMENT: await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to delete item"))
  })
})
```

If `@/lib/data/cart-event-bus` exports under a different name, check that module and match its export shape.

### New/extended tests for TC-1, TC-2, TC-4, TC-5, TC-7, TC-8, TC-9

- Extend `src/__tests__/modules/order/components/payment-details/index.test.tsx` (TC-1).
- New `src/__tests__/modules/checkout/components/payment-container/index.test.tsx` (TC-2).
- New `src/__tests__/modules/common/icons/payment-icons.test.tsx` (TC-4).
- New `src/__tests__/modules/skeletons/components/skeleton-cart-button/index.test.tsx` and
  `skeleton-mega-menu/index.test.tsx` (TC-5).
- Extend `bc-order-filters/index.test.tsx` and `bc-return-filters/index.test.tsx` (TC-7).
- New `src/__tests__/lib/util/map-claims-page.test.ts` (TC-8).
- New `src/__tests__/modules/products/components/thumbnail/index.test.tsx` (TC-9).

Each follows the existing pattern: `render(...)`, `screen.getBy…`, and the auto next-intl mock.

## Implementation Steps

1. Run the catalog merge with the `CHANGES` above. `git diff messages/` shows: `BcTest` removed, 2 values
   changed, and new keys added, in all 8 files.
2. Apply A–J in the order of the Solution Design table.
3. Remove bctest (M), grepping first.
4. `npx tsc --noEmit -p tsconfig.json`: no new errors (the `paymentInfoMap` type change makes the compiler
   flag any leftover `.title` access).
5. Update `checkout-layout.test.tsx`, `common/components/thumbnail/index.test.tsx` and `country-select` test
   titles; add the new tests; run `pnpm test` (only the 3 baseline failures).
6. From `apps/storefront`, confirm:
   `grep -rnE '"(Cart is locked|Failed to (add|delete|update|empty))' src/lib/context` is empty, and
   `grep -rn 'alt="Thumbnail"' src` is empty.
7. Do NOT touch `src/lib/util/convert-cart-to-csv.ts` (CSV headers stay English, decision 7).
