# Task 02: Translated page metadata (generateMetadata + Metadata namespace) — Implementation Plan

**Status:** DONE
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 02
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-173 (from develop)
**Depends on:** None (logically independent of Task 01). Run it after Task 01 on the same branch: both
tasks touch no common source file, but later tasks also edit `messages/*.json` and the claims page.

> **USER APPROVAL NEEDED:** the `Metadata.home.description` copy below is a **draft**. The user must approve
> it (or supply replacement copy) before the PR is merged. Implement the draft as written and do not invent
> other copy. If the user changes it, update only those 8 values.

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build`, plus `npx tsc --noEmit -p tsconfig.json`
  (the build ignores TS errors; the baseline is 10 errors, see Task 01)
- **Lint command:** `cd apps/storefront && pnpm lint`
- **Test command:** `cd apps/storefront && pnpm test` (baseline: 3 pre-existing failures in `main-layout.test.tsx`
  and `product-tabs/index.test.tsx`)
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/app/`
- **next-intl mocks:** `__mocks__/next-intl/server.ts` resolves `getTranslations("A.b")` against `messages/en.json`
  (nested namespaces are supported). It interpolates `{name}` placeholders.
- **Conventions:** double quotes, no semicolons (storefront style). The claims page uses single quotes and
  semicolons, so keep that file's own style.

## Solution Design

- **Next.js 15.5.18 check:** the installed `next/dist/lib/metadata/resolve-metadata.js` resolves the
  metadata of the `not-found` convention module through `getDefinedMetadata(errorMod, …)`. That function
  calls `mod.generateMetadata(props, parent)` when it exists, otherwise it uses `mod.metadata`. So
  **`generateMetadata` is supported in `not-found.tsx`**, and we use it there too. No component-rendered
  `<title>` and no static "404" fallback are needed.
- **Locale source:** `getTranslations("Metadata.<page>")` without an explicit locale. It resolves the
  locale from the `X-NEXT-INTL-LOCALE` header, which middleware sets for every `/{countryCode}/…` request, and
  falls back to `DEFAULT_LOCALE` (`en`) when there is no header (`src/i18n/request.ts`). This is the same
  mechanism all Server Components in this app use. The product/category/collection pages pass
  `{ locale: getLocaleForCountry(params.countryCode) }` explicitly. They are **not changed**.
- **New top-level namespace `Metadata`**, one sub-key per page with `title` and (where the page had one)
  `description`. Template copy ("Medusa Next.js Starter Template", "your Medusa Store") is replaced, and the
  typo "You purchase" is fixed.
- **Not-found metadata** reuses the existing `Common.notFound.headingLabel` / `pageMessage` keys (same copy
  as the page body, following the NIMBUS-165 reuse rule), so it needs no new keys. The title changes from
  `"404"` to the translated "Page not found".
- **Root `src/app/not-found.tsx`** (outside `[countryCode]`, decision 3): becomes an async Server Component
  using `getTranslations("Common.notFound")`. With no locale header, `request.ts` resolves `en`. There is no
  `Accept-Language` negotiation. It keeps `next/link` (`href="/"`) and does NOT use `InteractiveLink` /
  `LocalizedClientLink` / `useTranslations`: there is no `NextIntlClientProvider` above the root layout, so
  client-side translation hooks would throw there. Note: for an unmatched URL under a country segment
  (e.g. `/dk/does-not-exist`), middleware has already set the header, so this page renders in that
  country's language. That is the natural next-intl behaviour, not negotiation (see Risks in PLAN.md).
- Title format stays as today (bare page name, no "| Nimbus Nordic" suffix). Only the home page title is the
  brand "Nimbus Nordic" (decision 2).

## Code Skeletons

### Pattern for a static page (replace the `export const metadata` block)

```typescript
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.<pageKey>")

  return {
    title: t("title"),
    description: t("description"), // omit for `checkout` (title only, as today)
  }
}
```

### Modified: `src/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page.tsx`

```typescript
import { retrieveOrder } from "@/lib/data/orders"
import OrderDetailsTemplate from "@/modules/order/templates/order-details-template"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

// ...Props unchanged...

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  const t = await getTranslations("Metadata.orderDetails")

  return {
    title: t("title", { displayId: order.display_id }),
    description: t("description"),
  }
}
// default export unchanged
```

### Modified: segment not-found files

In each of `src/app/[countryCode]/(main)/not-found.tsx`, `src/app/[countryCode]/(checkout)/not-found.tsx`
and `src/app/[countryCode]/(main)/cart/not-found.tsx`, replace the `export const metadata` block with:

```typescript
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Common.notFound")

  return {
    title: t("headingLabel"),
    description: t("pageMessage"),
  }
}
```

(In `cart/not-found.tsx`, use `Cart.notFound.cartMessage` as the description:
`const tCart = await getTranslations("Cart.notFound")` → `description: tCart("cartMessage")`.)

`src/app/[countryCode]/(main)/account/@dashboard/bcorders/[id]/not-found.tsx` has no `metadata` export today.
Leave it unchanged.

### Modified: `src/app/not-found.tsx` (full new content)

```typescript
import { ArrowUpRightMini } from "@medusajs/icons"
import { Text } from "@medusajs/ui"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

// Outside the [countryCode] segment there is no NextIntlClientProvider, so
// only server-side getTranslations is used here. Without a locale header
// src/i18n/request.ts resolves DEFAULT_LOCALE ("en").
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Common.notFound")

  return {
    title: t("headingLabel"),
    description: t("pageMessage"),
  }
}

export default async function NotFound() {
  const t = await getTranslations("Common.notFound")

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("headingLabel")}</h1>
      <p className="text-small-regular text-ui-fg-base">{t("pageMessage")}</p>
      <Link className="flex gap-x-1 items-center group" href="/">
        <Text className="text-ui-fg-interactive">{t("goToFrontpageLabel")}</Text>
        <ArrowUpRightMini
          className="group-hover:rotate-45 ease-in-out duration-150"
          color="var(--fg-interactive)"
        />
      </Link>
    </div>
  )
}
```

### Catalog merge script (run once, do not commit)

Save as `<scratchpad>/apply-catalog-02.mjs` and run it with `node <path>` from `apps/storefront`.
It deep-merges `CHANGES` into each catalog and keeps the file's existing line endings and trailing-newline
state. A `null` value deletes a key (not used in this task).

```javascript
import fs from "node:fs"

const CHANGES = { /* paste the object from "Catalog changes" below */ }

function merge(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete target[key]
    else if (typeof value === "object") target[key] = merge(target[key] ?? {}, value)
    else target[key] = value
  }
  return target
}

for (const [locale, patch] of Object.entries(CHANGES)) {
  const file = `messages/${locale}.json`
  const raw = fs.readFileSync(file, "utf8")
  const eol = raw.includes("\r\n") ? "\r\n" : "\n"
  const trailing = /\r?\n$/.test(raw) ? eol : ""
  const json = merge(JSON.parse(raw), patch)
  fs.writeFileSync(file, JSON.stringify(json, null, 2).split("\n").join(eol) + trailing)
}
```

## Catalog changes

Add a new top-level `Metadata` namespace to all 8 catalogs. `home.description` is a **DRAFT pending user approval**.

```javascript
const CHANGES = {
  en: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Order corporate wear for your business in the Nimbus Nordic B2B webshop." },
    account: { title: "Account", description: "Overview of your account activity." },
    addresses: { title: "Addresses", description: "View your addresses." },
    approvals: { title: "Approvals", description: "Overview of your pending approvals." },
    bcOrders: { title: "BC Orders", description: "Company-wide Business Central order history." },
    returns: { title: "Returns", description: "Company-wide Business Central return history." },
    claims: { title: "Claims", description: "Guidance for submitting a claim." },
    orders: { title: "Orders", description: "Overview of your previous orders." },
    orderDetails: { title: "Order #{displayId}", description: "View your order." },
    profile: { title: "Profile", description: "View and edit your profile." },
    login: { title: "Log in", description: "Log in to your Nimbus Nordic account." },
    cart: { title: "Cart", description: "View your cart." },
    checkout: { title: "Checkout" },
    store: { title: "Store", description: "Explore all of our products." },
    orderConfirmed: { title: "Order confirmed", description: "Your purchase was successful." },
  } },
  da: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Bestil firmatøj til din virksomhed i Nimbus Nordics B2B-webshop." },
    account: { title: "Konto", description: "Oversigt over din kontoaktivitet." },
    addresses: { title: "Adresser", description: "Se dine adresser." },
    approvals: { title: "Godkendelser", description: "Oversigt over dine afventende godkendelser." },
    bcOrders: { title: "BC-ordrer", description: "Virksomhedens samlede ordrehistorik fra Business Central." },
    returns: { title: "Returneringer", description: "Virksomhedens samlede returneringshistorik fra Business Central." },
    claims: { title: "Reklamationer", description: "Vejledning i at indsende en reklamation." },
    orders: { title: "Ordrer", description: "Oversigt over dine tidligere ordrer." },
    orderDetails: { title: "Ordre #{displayId}", description: "Se din ordre." },
    profile: { title: "Profil", description: "Se og redigér din profil." },
    login: { title: "Log ind", description: "Log ind på din Nimbus Nordic-konto." },
    cart: { title: "Kurv", description: "Se din kurv." },
    checkout: { title: "Checkout" },
    store: { title: "Butik", description: "Udforsk alle vores produkter." },
    orderConfirmed: { title: "Ordre bekræftet", description: "Dit køb er gennemført." },
  } },
  sv: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Beställ företagskläder till ditt företag i Nimbus Nordics B2B-webbshop." },
    account: { title: "Konto", description: "Översikt över din kontoaktivitet." },
    addresses: { title: "Adresser", description: "Visa dina adresser." },
    approvals: { title: "Godkännanden", description: "Översikt över dina väntande godkännanden." },
    bcOrders: { title: "BC-beställningar", description: "Företagets samlade orderhistorik från Business Central." },
    returns: { title: "Returer", description: "Företagets samlade returhistorik från Business Central." },
    claims: { title: "Reklamationer", description: "Vägledning för att skicka in en reklamation." },
    orders: { title: "Beställningar", description: "Översikt över dina tidigare beställningar." },
    orderDetails: { title: "Beställning #{displayId}", description: "Visa din beställning." },
    profile: { title: "Profil", description: "Visa och redigera din profil." },
    login: { title: "Logga in", description: "Logga in på ditt Nimbus Nordic-konto." },
    cart: { title: "Varukorg", description: "Visa din varukorg." },
    checkout: { title: "Kassa" },
    store: { title: "Butik", description: "Utforska alla våra produkter." },
    orderConfirmed: { title: "Beställningen är bekräftad", description: "Ditt köp har genomförts." },
  } },
  no: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Bestill firmaklær til bedriften din i Nimbus Nordics B2B-nettbutikk." },
    account: { title: "Konto", description: "Oversikt over kontoaktiviteten din." },
    addresses: { title: "Adresser", description: "Se adressene dine." },
    approvals: { title: "Godkjenninger", description: "Oversikt over ventende godkjenninger." },
    bcOrders: { title: "BC-bestillinger", description: "Bedriftens samlede ordrehistorikk fra Business Central." },
    returns: { title: "Returer", description: "Bedriftens samlede returhistorikk fra Business Central." },
    claims: { title: "Reklamasjoner", description: "Veiledning for å sende inn en reklamasjon." },
    orders: { title: "Bestillinger", description: "Oversikt over dine tidligere bestillinger." },
    orderDetails: { title: "Bestilling #{displayId}", description: "Se bestillingen din." },
    profile: { title: "Profil", description: "Se og rediger profilen din." },
    login: { title: "Logg inn", description: "Logg inn på Nimbus Nordic-kontoen din." },
    cart: { title: "Handlekurv", description: "Se handlekurven din." },
    checkout: { title: "Kasse" },
    store: { title: "Butikk", description: "Utforsk alle produktene våre." },
    orderConfirmed: { title: "Bestillingen er bekreftet", description: "Kjøpet ditt er fullført." },
  } },
  pl: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Zamawiaj odzież firmową dla swojej firmy w sklepie B2B Nimbus Nordic." },
    account: { title: "Konto", description: "Przegląd aktywności na Twoim koncie." },
    addresses: { title: "Adresy", description: "Wyświetl swoje adresy." },
    approvals: { title: "Zatwierdzenia", description: "Przegląd oczekujących zatwierdzeń." },
    bcOrders: { title: "Zamówienia BC", description: "Historia zamówień całej firmy z Business Central." },
    returns: { title: "Zwroty", description: "Historia zwrotów całej firmy z Business Central." },
    claims: { title: "Reklamacje", description: "Wskazówki dotyczące składania reklamacji." },
    orders: { title: "Zamówienia", description: "Przegląd Twoich wcześniejszych zamówień." },
    orderDetails: { title: "Zamówienie #{displayId}", description: "Wyświetl swoje zamówienie." },
    profile: { title: "Profil", description: "Wyświetl i edytuj swój profil." },
    login: { title: "Zaloguj się", description: "Zaloguj się na swoje konto Nimbus Nordic." },
    cart: { title: "Koszyk", description: "Wyświetl swój koszyk." },
    checkout: { title: "Kasa" },
    store: { title: "Sklep", description: "Poznaj wszystkie nasze produkty." },
    orderConfirmed: { title: "Zamówienie potwierdzone", description: "Zakup zakończył się pomyślnie." },
  } },
  it: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Ordina abbigliamento aziendale per la tua azienda nel webshop B2B di Nimbus Nordic." },
    account: { title: "Account", description: "Panoramica delle attività del tuo account." },
    addresses: { title: "Indirizzi", description: "Visualizza i tuoi indirizzi." },
    approvals: { title: "Approvazioni", description: "Panoramica delle approvazioni in sospeso." },
    bcOrders: { title: "Ordini BC", description: "Cronologia degli ordini aziendali da Business Central." },
    returns: { title: "Resi", description: "Cronologia dei resi aziendali da Business Central." },
    claims: { title: "Reclami", description: "Indicazioni per presentare un reclamo." },
    orders: { title: "Ordini", description: "Panoramica dei tuoi ordini precedenti." },
    orderDetails: { title: "Ordine #{displayId}", description: "Visualizza il tuo ordine." },
    profile: { title: "Profilo", description: "Visualizza e modifica il tuo profilo." },
    login: { title: "Accedi", description: "Accedi al tuo account Nimbus Nordic." },
    cart: { title: "Carrello", description: "Visualizza il tuo carrello." },
    checkout: { title: "Checkout" },
    store: { title: "Negozio", description: "Scopri tutti i nostri prodotti." },
    orderConfirmed: { title: "Ordine confermato", description: "Il tuo acquisto è stato completato." },
  } },
  fr: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Commandez des vêtements professionnels pour votre entreprise sur la boutique B2B de Nimbus Nordic." },
    account: { title: "Compte", description: "Aperçu de l'activité de votre compte." },
    addresses: { title: "Adresses", description: "Consultez vos adresses." },
    approvals: { title: "Approbations", description: "Aperçu de vos approbations en attente." },
    bcOrders: { title: "Commandes BC", description: "Historique des commandes de toute l'entreprise dans Business Central." },
    returns: { title: "Retours", description: "Historique des retours de toute l'entreprise dans Business Central." },
    claims: { title: "Réclamations", description: "Conseils pour soumettre une réclamation." },
    orders: { title: "Commandes", description: "Aperçu de vos commandes précédentes." },
    orderDetails: { title: "Commande #{displayId}", description: "Consultez votre commande." },
    profile: { title: "Profil", description: "Consultez et modifiez votre profil." },
    login: { title: "Se connecter", description: "Connectez-vous à votre compte Nimbus Nordic." },
    cart: { title: "Panier", description: "Consultez votre panier." },
    checkout: { title: "Paiement" },
    store: { title: "Boutique", description: "Découvrez tous nos produits." },
    orderConfirmed: { title: "Commande confirmée", description: "Votre achat a bien été effectué." },
  } },
  de: { Metadata: {
    home: { title: "Nimbus Nordic", description: "Bestellen Sie Corporate Wear für Ihr Unternehmen im B2B-Webshop von Nimbus Nordic." },
    account: { title: "Konto", description: "Übersicht über Ihre Kontoaktivitäten." },
    addresses: { title: "Adressen", description: "Ihre Adressen anzeigen." },
    approvals: { title: "Genehmigungen", description: "Übersicht über Ihre ausstehenden Genehmigungen." },
    bcOrders: { title: "BC-Bestellungen", description: "Unternehmensweiter Bestellverlauf aus Business Central." },
    returns: { title: "Rücksendungen", description: "Unternehmensweiter Rücksendeverlauf aus Business Central." },
    claims: { title: "Reklamationen", description: "Hinweise zum Einreichen einer Reklamation." },
    orders: { title: "Bestellungen", description: "Übersicht über Ihre bisherigen Bestellungen." },
    orderDetails: { title: "Bestellung #{displayId}", description: "Ihre Bestellung anzeigen." },
    profile: { title: "Profil", description: "Profil anzeigen und bearbeiten." },
    login: { title: "Anmelden", description: "Melden Sie sich bei Ihrem Nimbus Nordic-Konto an." },
    cart: { title: "Warenkorb", description: "Ihren Warenkorb anzeigen." },
    checkout: { title: "Checkout" },
    store: { title: "Shop", description: "Entdecken Sie alle unsere Produkte." },
    orderConfirmed: { title: "Bestellung bestätigt", description: "Ihr Kauf war erfolgreich." },
  } },
}
```

The page titles reuse the terms already in `Account.nav.*`, `Account.login.submitLabel` and
`Cart.cartDrawer.cartLabel` for each locale, so tab titles match the navigation.

## Impacted Files

| File | Change | Metadata key |
|---|---|---|
| `src/app/[countryCode]/(main)/page.tsx` | static → `generateMetadata`; add `getTranslations` import | `Metadata.home` |
| `src/app/[countryCode]/(main)/account/@dashboard/page.tsx` | static → `generateMetadata`; add import | `Metadata.account` |
| `…/@dashboard/addresses/page.tsx` | static → `generateMetadata` (import exists) | `Metadata.addresses` |
| `…/@dashboard/approvals/page.tsx` | same | `Metadata.approvals` |
| `…/@dashboard/bcorders/page.tsx` | same | `Metadata.bcOrders` |
| `…/@dashboard/returns/page.tsx` | same (added by NIMBUS-140, not in BUG.md) | `Metadata.returns` |
| `…/@dashboard/claims/page.tsx` | same; **single quotes + semicolons** in this file; add `import { getTranslations } from 'next-intl/server';` | `Metadata.claims` |
| `…/@dashboard/orders/page.tsx` | same (import exists) | `Metadata.orders` |
| `…/@dashboard/orders/details/[id]/page.tsx` | hardcoded title/description → translated (skeleton) | `Metadata.orderDetails` |
| `…/@dashboard/profile/page.tsx` | same (import exists) | `Metadata.profile` |
| `src/app/[countryCode]/(main)/account/@login/page.tsx` | static → `generateMetadata`; add import | `Metadata.login` |
| `src/app/[countryCode]/(main)/cart/page.tsx` | same; add import | `Metadata.cart` |
| `src/app/[countryCode]/(checkout)/checkout/page.tsx` | same, title only; add import | `Metadata.checkout` |
| `src/app/[countryCode]/(main)/store/page.tsx` | same; add import. Leave the stray `;``\`` line at the end alone (pre-existing, flagged in NIMBUS-165) | `Metadata.store` |
| `src/app/[countryCode]/(main)/order/confirmed/[id]/page.tsx` | same; add import | `Metadata.orderConfirmed` |
| `src/app/[countryCode]/(main)/not-found.tsx` | static → `generateMetadata` | `Common.notFound` |
| `src/app/[countryCode]/(checkout)/not-found.tsx` | same | `Common.notFound` |
| `src/app/[countryCode]/(main)/cart/not-found.tsx` | same, description from `Cart.notFound.cartMessage` | `Common.notFound` + `Cart.notFound` |
| `src/app/not-found.tsx` | full rewrite (skeleton) | `Common.notFound` |
| `messages/{en,da,sv,no,pl,it,fr,de}.json` | add `Metadata` namespace | — |

Not changed: `src/app/layout.tsx` and `(main)/layout.tsx` (only `metadataBase`), and the product/category/
collection pages (already translated). `bctest/page.tsx` is deleted in Task 03, so do not convert it.

## Test Cases

### TC-1: Static page metadata is translated (en, default mock)
- **Given:** the auto mock (`en` catalog)
- **When:** `generateMetadata()` of addresses, approvals, bcorders, returns, orders and profile runs (add one `it`
  to each existing page test: `addresses-page.test.tsx`, `approvals-page.test.tsx`, `bcorders-page.test.tsx`,
  `bcreturns-page.test.tsx`, `orders-page.test.tsx`, `profile-page.test.tsx`)
- **Then:** `{ title, description }` equal the `Metadata.<key>` en values (e.g. addresses →
  `{ title: "Addresses", description: "View your addresses." }`)

### TC-2: Home page uses the brand and no template copy
- **Given:** the auto mock
- **When:** `generateMetadata()` from `@/app/[countryCode]/(main)/page` runs
- **Then:** `title === "Nimbus Nordic"`, and `description` does not contain `"Medusa"`

### TC-3: Metadata follows the active locale (wiring)
- **Given:** `next-intl/server`'s `getTranslations` mocked to resolve against `messages/da.json`
- **When:** `generateMetadata()` of the cart page and of `(main)/not-found` run
- **Then:** cart → `{ title: "Kurv", description: "Se din kurv." }`; not-found →
  `{ title: "Siden blev ikke fundet", description: "Siden, du forsøgte at tilgå, findes ikke." }`

### TC-4: Order details title interpolates the display id
- **Given:** `retrieveOrder` mocked to resolve `{ display_id: 42 }`
- **When:** `generateMetadata({ params: Promise.resolve({ id: "order_1" }) })`
- **Then:** `{ title: "Order #42", description: "View your order." }`

### TC-5: Order details metadata still 404s for a missing order (edge)
- **Given:** `retrieveOrder` rejects, and `next/navigation`'s `notFound` is mocked to throw `new Error("NEXT_NOT_FOUND")`
- **When:** `generateMetadata(...)`
- **Then:** the promise rejects with `"NEXT_NOT_FOUND"`

### TC-6: Order confirmed metadata has no typo
- **Given:** the auto mock
- **When:** `generateMetadata()` of `order/confirmed/[id]/page`
- **Then:** `description === "Your purchase was successful."`

### TC-7: Root not-found renders translated copy in the default locale
- **Given:** the auto mock (`en`)
- **When:** `await RootNotFound()` is rendered and `generateMetadata()` from `@/app/not-found` is called
- **Then:** the page shows "Page not found", "The page you tried to access does not exist." and "Go to frontpage";
  the metadata title is `"Page not found"`

### TC-8: Segment not-found metadata (en)
- **Given:** the auto mock
- **When:** `generateMetadata()` of `(main)/not-found`, `(checkout)/not-found` and `cart/not-found`
- **Then:** the title is `"Page not found"` for all three. The cart description is
  `"The cart you tried to access does not exist. Clear your cookies and try again."`

### TC-9: Catalog parity
- **Given:** the updated catalogs
- **When:** `src/__tests__/lib/i18n/message-catalogs.test.ts` runs
- **Then:** it passes (identical key paths in all 8 locales)

## Test Scaffolds

### Extend: `src/__tests__/app/not-found-pages.test.tsx` (TC-7, TC-8)

Add imports and tests. The existing `next/navigation` mock stays.

```typescript
import RootNotFound, {
  generateMetadata as rootNotFoundMetadata,
} from "@/app/not-found"
import { generateMetadata as mainNotFoundMetadata } from "@/app/[countryCode]/(main)/not-found"
import { generateMetadata as checkoutNotFoundMetadata } from "@/app/[countryCode]/(checkout)/not-found"
import { generateMetadata as cartNotFoundMetadata } from "@/app/[countryCode]/(main)/cart/not-found"

it("renders the root not-found page in the default locale (TC-7)", async () => {
  render(await RootNotFound())
  // IMPLEMENT: assert the 3 en strings
  // IMPLEMENT: expect(await rootNotFoundMetadata()).toEqual({ title: "Page not found", description: "The page you tried to access does not exist." })
})

it("translates the segment not-found metadata (TC-8)", async () => {
  // IMPLEMENT
})
```

The existing default imports (`MainNotFound`, …) are unchanged. Use named imports for `generateMetadata`.

### New File: `src/__tests__/app/page-metadata.test.ts` (TC-2, TC-4, TC-5, TC-6 plus the account/login/checkout/claims/store/cart pages)

```typescript
jest.mock("@/lib/data/orders", () => ({
  retrieveOrder: jest.fn(),
  listOrders: jest.fn(async () => []),
}))
jest.mock("@/lib/data/customer", () => ({ retrieveCustomer: jest.fn(async () => null) }))
jest.mock("@/lib/data/cart", () => ({ retrieveCart: jest.fn(async () => null) }))
jest.mock("@/lib/data/regions", () => ({ listRegions: jest.fn(async () => []) }))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  redirect: jest.fn(),
}))
// Page default exports pull in large template trees with untransformed ESM
// dependencies; only generateMetadata is under test (same approach as
// category-page-metadata.test.ts). Stub the templates the imported pages use:
jest.mock("@/modules/order/templates/order-details-template", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/order/templates/order-completed-template", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/cart/templates", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/home/components/featured-products", () => ({ __esModule: true, default: () => null }))
jest.mock("@/modules/home/components/hero", () => ({ __esModule: true, default: () => null }))
// IMPLEMENT: add further jest.mock(..., () => ({ __esModule: true, default: () => null })) stubs for
// any template the store/checkout/login/claims pages import that fails to load under Jest
// (e.g. "@/modules/store/templates/paginated-products", "@/modules/store/components/refinement-list",
// "@/modules/checkout/templates/checkout-form", "@/modules/checkout/templates/checkout-summary",
// "@/modules/checkout/components/payment-wrapper", "@/modules/account/templates/login-template",
// "@/lib/data/cms"). Named exports need the matching shape, e.g.
// { ClaimsPageContent: () => null } for "@/modules/account/components/claims-page-content".

import { retrieveOrder } from "@/lib/data/orders"
import { generateMetadata as homeMetadata } from "@/app/[countryCode]/(main)/page"
import { generateMetadata as orderDetailsMetadata } from "@/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page"
import { generateMetadata as orderConfirmedMetadata } from "@/app/[countryCode]/(main)/order/confirmed/[id]/page"
// IMPLEMENT: import generateMetadata from account/@dashboard/page, @login/page, cart/page,
// (checkout)/checkout/page, store/page, claims/page

describe("page generateMetadata", () => {
  it("uses the brand for the home page (TC-2)", async () => {
    const metadata = await homeMetadata()
    expect(metadata.title).toBe("Nimbus Nordic")
    expect(String(metadata.description)).not.toContain("Medusa")
  })

  it("interpolates the order display id (TC-4)", async () => {
    ;(retrieveOrder as jest.Mock).mockResolvedValueOnce({ display_id: 42 })
    // IMPLEMENT
  })

  it("still calls notFound for a missing order (TC-5)", async () => {
    ;(retrieveOrder as jest.Mock).mockRejectedValueOnce(new Error("404"))
    // IMPLEMENT: await expect(orderDetailsMetadata({ params: Promise.resolve({ id: "x" }) })).rejects.toThrow("NEXT_NOT_FOUND")
  })

  it("fixes the order-confirmed typo (TC-6)", async () => {
    // IMPLEMENT
  })

  // IMPLEMENT: one it() per remaining page asserting its en Metadata values
})
```

### New File: `src/__tests__/app/page-metadata-locale.test.ts` (TC-3)

```typescript
type Catalog = Record<string, unknown>

jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(async (namespace: string) => {
    const catalog = require("../../../messages/da.json") as Catalog
    const dict = namespace
      .split(".")
      .reduce<unknown>((acc, part) => (acc as Catalog)?.[part], catalog) as Catalog
    return (key: string) => {
      const value = key
        .split(".")
        .reduce<unknown>((acc, part) => (acc as Catalog)?.[part], dict)
      return typeof value === "string" ? value : key
    }
  }),
}))
jest.mock("@/lib/data/cart", () => ({ retrieveCart: jest.fn(async () => null) }))
jest.mock("@/lib/data/customer", () => ({ retrieveCustomer: jest.fn(async () => null) }))
jest.mock("@/modules/cart/templates", () => ({ __esModule: true, default: () => null }))

import { generateMetadata as cartMetadata } from "@/app/[countryCode]/(main)/cart/page"
import { generateMetadata as mainNotFoundMetadata } from "@/app/[countryCode]/(main)/not-found"

describe("generateMetadata follows the active locale", () => {
  it("translates the cart page and not-found metadata into Danish (TC-3)", async () => {
    // IMPLEMENT: expect(await cartMetadata()).toEqual({ title: "Kurv", description: "Se din kurv." })
    // IMPLEMENT: expect(await mainNotFoundMetadata()).toEqual({ title: "Siden blev ikke fundet", description: "Siden, du forsøgte at tilgå, findes ikke." })
  })
})
```

## Implementation Steps

1. Run the catalog merge script with the `CHANGES` object above (from `apps/storefront`). Check `git diff messages/`:
   only additions, no reformatting of existing lines.
2. Convert each file in the Impacted Files table using the pattern. Remove the now-unused `Metadata`
   import only if nothing else uses it (every file still uses it for the return type, so keep it).
3. Rewrite `src/app/not-found.tsx` from the skeleton.
4. Update the three segment `not-found.tsx` files.
5. Write and extend the tests (TC-1…TC-9). Run `pnpm test`: only the 3 baseline failures may remain.
6. `npx tsc --noEmit -p tsconfig.json`: no new errors. `pnpm lint`: no new errors.
7. From `apps/storefront`, confirm `grep -rn "export const metadata" src/app` only lists `src/app/layout.tsx`,
   `src/app/[countryCode]/(main)/layout.tsx` (both `metadataBase` only) and `bctest/page.tsx` (deleted in
   Task 03).
