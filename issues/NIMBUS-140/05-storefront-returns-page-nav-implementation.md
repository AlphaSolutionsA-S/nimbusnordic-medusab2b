# Task 05: Returns page route, account nav entry, and translations — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 05
**Date:** 2026-09-15
**Branch:** feature/NIMBUS-140 (from develop)
**Depends on:** Task 04

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/app/`, `apps/storefront/src/__tests__/modules/account/components/`
- **Naming conventions:** kebab-case directories, PascalCase component names, double-quoted strings, no trailing semicolons. JSON message files use 2-space indentation, matching existing formatting exactly.

## Solution Design

1. Add the `/account/returns` page route (list + filters + overview, mirroring `bcorders/page.tsx`) and its `loading.tsx`.
2. Add a new **top-level** "Returns" entry to `AccountNav` (both the mobile and desktop nav lists), positioned after "BC Orders" and before "Claims" — **not** nested under Orders, per SCOPE.md's explicit requirement.
3. Add the required translation keys to **all 5** locale message files (`en`, `da`, `de`, `fr`, `it`) to keep locale parity with the rest of the `Account` namespace.

The return **detail** page itself (`/account/returns/[id]/page.tsx`) is explicitly out of scope — that is NIMBUS-141. This task only wires the `LocalizedClientLink` in `BcReturnCard` (already done in Task 04) to point at `/account/returns/{number}`, and the nav link to `/account/returns`. Do not create a `[id]` route under `returns/`.

## Code Skeletons

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/page.tsx`

```typescript
import { listBCReturns } from "@/lib/data/business-central"
import BcReturnFilters from "@/modules/account/components/bc-return-filters"
import BcReturnOverview from "@/modules/account/components/bc-return-overview"
import type { BCReturnListResponse } from "@/types/bc-order"
import { Heading } from "@medusajs/ui"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export const metadata: Metadata = {
  title: "Returns",
  description: "Company-wide Business Central return history.",
}

const LIMIT = 20

export default async function Returns({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    status?: string
    date_from?: string
    date_to?: string
    search?: string
  }>
}) {
  const t = await getTranslations("Account.bcReturnsPage")
  const params = await searchParams

  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1)
  const offset = (currentPage - 1) * LIMIT
  const { status, date_from, date_to, search } = params

  let result: BCReturnListResponse | null = null
  let hasError = false

  try {
    result = await listBCReturns({
      limit: LIMIT,
      offset,
      status,
      date_from,
      date_to,
      search,
    })
  } catch {
    hasError = true
  }

  return (
    <div
      className="w-full flex flex-col gap-y-4"
      data-testid="bc-returns-page-wrapper"
    >
      <div className="mb-4">
        <Heading>{t("heading")}</Heading>
      </div>
      <BcReturnFilters
        currentStatus={status}
        currentDateFrom={date_from}
        currentDateTo={date_to}
        currentSearch={search}
      />
      <BcReturnOverview
        result={result}
        error={hasError}
        currentPage={currentPage}
        limit={LIMIT}
      />
    </div>
  )
}
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/loading.tsx`

```typescript
import Spinner from "@/modules/common/icons/spinner"

export default function Loading() {
  return (
    <div className="flex items-center justify-center w-full h-full text-ui-fg-base">
      <Spinner size={36} />
    </div>
  )
}
```

### New File: `apps/storefront/src/__tests__/app/bcreturns-page.test.tsx`

```typescript
import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  listBCReturns: jest.fn(() => Promise.resolve({ returns: [], count: 0 })),
}))
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/returns"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))
// bc-return-overview is itself an async Server Component; React's client test
// renderer can't render an unresolved async component as a nested element.
// It has its own dedicated regression test, so stub it here.
jest.mock("@/modules/account/components/bc-return-overview", () => ({
  __esModule: true,
  default: () => null,
}))

import Returns from "@/app/[countryCode]/(main)/account/@dashboard/returns/page"

describe("Returns page", () => {
  it("renders the extracted heading unchanged", async () => {
    const element = await Returns({ searchParams: Promise.resolve({}) })
    render(element)

    expect(screen.getByText("Returns")).toBeInTheDocument()
  })
})
```

## Impacted Files

### `apps/storefront/src/modules/account/components/account-nav/index.tsx` (edit)

**Edit 1 — add the icon import**, right after the `Package` import.

Old:
```typescript
import Package from "@/modules/common/icons/package"
import User from "@/modules/common/icons/user"
```

New:
```typescript
import Package from "@/modules/common/icons/package"
import UTurnArrowRight from "@/modules/common/icons/u-turn-arrow-right"
import User from "@/modules/common/icons/user"
```

**Edit 2 — mobile nav: add a "Returns" `<li>` between "BC Orders" and "Claims".**

Old:
```typescript
                <li>
                  <LocalizedClientLink
                    href="/account/bcorders"
                    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
                    data-testid="bc-orders-link"
                  >
                    <div className="flex items-center gap-x-2">
                      <Package size={20} />
                      <span>{t("bcOrdersLabel")}</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/account/claims"
                    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
                    data-testid="claims-link"
                  >
                    <div className="flex items-center gap-x-2">
                      <FilePlus size={16} />
                      <span>{t("claimsLabel")}</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </LocalizedClientLink>
                </li>
                {customer?.employee?.is_admin && (
```

New:
```typescript
                <li>
                  <LocalizedClientLink
                    href="/account/bcorders"
                    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
                    data-testid="bc-orders-link"
                  >
                    <div className="flex items-center gap-x-2">
                      <Package size={20} />
                      <span>{t("bcOrdersLabel")}</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/account/returns"
                    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
                    data-testid="returns-link"
                  >
                    <div className="flex items-center gap-x-2">
                      <UTurnArrowRight size={20} />
                      <span>{t("returnsLabel")}</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/account/claims"
                    className="flex items-center justify-between py-4 border-b border-gray-200 px-8"
                    data-testid="claims-link"
                  >
                    <div className="flex items-center gap-x-2">
                      <FilePlus size={16} />
                      <span>{t("claimsLabel")}</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </LocalizedClientLink>
                </li>
                {customer?.employee?.is_admin && (
```

**Edit 3 — desktop nav: add a "Returns" `<li>` between "BC Orders" and "Claims".**

Old:
```typescript
            <li>
              <AccountNavLink
                href="/account/bcorders"
                route={route!}
                data-testid="bc-orders-link"
              >
                {t("bcOrdersLabel")}
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/claims"
                route={route!}
                data-testid="claims-link"
              >
                {t("claimsLabel")}
              </AccountNavLink>
            </li>
            {customer?.employee?.is_admin && (
```

New:
```typescript
            <li>
              <AccountNavLink
                href="/account/bcorders"
                route={route!}
                data-testid="bc-orders-link"
              >
                {t("bcOrdersLabel")}
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/returns"
                route={route!}
                data-testid="returns-link"
              >
                {t("returnsLabel")}
              </AccountNavLink>
            </li>
            <li>
              <AccountNavLink
                href="/account/claims"
                route={route!}
                data-testid="claims-link"
              >
                {t("claimsLabel")}
              </AccountNavLink>
            </li>
            {customer?.employee?.is_admin && (
```

### `apps/storefront/src/__tests__/modules/account/components/account-nav.test.tsx` (edit)

Add one new test after the existing `'Claims link appears after BC Orders in both nav variants'` test, before the closing `})` of the `describe` block.

Old (last test in the file):
```typescript
  it('Claims link appears after BC Orders in both nav variants', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    // Get desktop nav
    const desktopNav = screen.getByTestId('account-nav');
    const bcOrdersLink = within(desktopNav).getByTestId('bc-orders-link');
    const claimsLink = within(desktopNav).getByTestId('claims-link');

    expect(bcOrdersLink).toBeInTheDocument();
    expect(claimsLink).toBeInTheDocument();

    // Both should have proper hrefs
    expect(bcOrdersLink).toHaveAttribute('href', expect.stringContaining('/account/bcorders'));
    expect(claimsLink).toHaveAttribute('href', expect.stringContaining('/account/claims'));
  });
});
```

New:
```typescript
  it('Claims link appears after BC Orders in both nav variants', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    // Get desktop nav
    const desktopNav = screen.getByTestId('account-nav');
    const bcOrdersLink = within(desktopNav).getByTestId('bc-orders-link');
    const claimsLink = within(desktopNav).getByTestId('claims-link');

    expect(bcOrdersLink).toBeInTheDocument();
    expect(claimsLink).toBeInTheDocument();

    // Both should have proper hrefs
    expect(bcOrdersLink).toHaveAttribute('href', expect.stringContaining('/account/bcorders'));
    expect(claimsLink).toHaveAttribute('href', expect.stringContaining('/account/claims'));
  });

  // TC-1 (integration/wiring): Returns is a top-level nav entry (not nested under
  // Orders), present in both nav variants with the correct href.
  it('Returns link is a top-level entry in both nav variants', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    const desktopNav = screen.getByTestId('account-nav');
    const desktopReturnsLink = within(desktopNav).getByTestId('returns-link');
    expect(desktopReturnsLink).toBeInTheDocument();
    expect(desktopReturnsLink).toHaveAttribute('href', expect.stringContaining('/account/returns'));

    const mobileNav = screen.getByTestId('mobile-account-nav');
    const mobileReturnsLink = within(mobileNav).getByTestId('returns-link');
    expect(mobileReturnsLink).toBeInTheDocument();
    expect(mobileReturnsLink).toHaveAttribute('href', expect.stringContaining('/account/returns'));
  });
});
```

### `apps/storefront/messages/en.json` (edit)

**Edit 1 — add `returnsLabel` to the `Account.nav` namespace.**

Old:
```json
    "nav": {
      "accountLabel": "Account",
      "helloLabel": "Hello {name}",
      "profileLabel": "Profile",
      "companyLabel": "Company",
      "addressesLabel": "Addresses",
      "ordersLabel": "Orders",
      "bcOrdersLabel": "BC Orders",
      "claimsLabel": "Claims",
      "approvalsLabel": "Approvals",
      "quotesLabel": "Quotes",
      "logoutLabel": "Log out",
      "overviewLabel": "Overview"
```

New:
```json
    "nav": {
      "accountLabel": "Account",
      "helloLabel": "Hello {name}",
      "profileLabel": "Profile",
      "companyLabel": "Company",
      "addressesLabel": "Addresses",
      "ordersLabel": "Orders",
      "bcOrdersLabel": "BC Orders",
      "returnsLabel": "Returns",
      "claimsLabel": "Claims",
      "approvalsLabel": "Approvals",
      "quotesLabel": "Quotes",
      "logoutLabel": "Log out",
      "overviewLabel": "Overview"
```

**Edit 2 — add the new `Account.bcReturnsPage`, `Account.bcReturnOverview`, `Account.bcReturnFilters`, `Account.bcReturnCard` namespaces, right after `bcOrdersPage` (the last key before the `Account` namespace closes).**

Old:
```json
    "bcOrdersPage": {
      "heading": "BC Orders"
    }
  },
```

New:
```json
    "bcOrdersPage": {
      "heading": "BC Orders"
    },
    "bcReturnsPage": {
      "heading": "Returns"
    },
    "bcReturnOverview": {
      "errorHeading": "Something went wrong",
      "errorMessage": "We were unable to load your returns. Please try again.",
      "tryAgainLabel": "Try again",
      "emptyHeading": "No returns found",
      "emptyMessage": "You haven't submitted any returns yet."
    },
    "bcReturnFilters": {
      "statusLabel": "Status",
      "allStatusesOption": "All statuses",
      "fromLabel": "From",
      "toLabel": "To",
      "searchLabel": "Search",
      "searchPlaceholder": "Return number…",
      "clearLabel": "Clear"
    },
    "bcReturnCard": {
      "detailsLabel": "Details",
      "relatedOrderLabel": "Order #{number}",
      "itemCountLabel": "{count} items"
    }
  },
```

### `apps/storefront/messages/da.json` (edit)

**Edit 1 — `Account.nav`:**

Old:
```json
    "nav": {
      "accountLabel": "Konto",
      "helloLabel": "Hej {name}",
      "profileLabel": "Profil",
      "companyLabel": "Virksomhed",
      "addressesLabel": "Adresser",
      "ordersLabel": "Ordrer",
      "bcOrdersLabel": "BC-ordrer",
      "claimsLabel": "Reklamationer",
      "approvalsLabel": "Godkendelser",
      "quotesLabel": "Tilbud",
      "logoutLabel": "Log ud",
      "overviewLabel": "Oversigt"
```

New:
```json
    "nav": {
      "accountLabel": "Konto",
      "helloLabel": "Hej {name}",
      "profileLabel": "Profil",
      "companyLabel": "Virksomhed",
      "addressesLabel": "Adresser",
      "ordersLabel": "Ordrer",
      "bcOrdersLabel": "BC-ordrer",
      "returnsLabel": "Returneringer",
      "claimsLabel": "Reklamationer",
      "approvalsLabel": "Godkendelser",
      "quotesLabel": "Tilbud",
      "logoutLabel": "Log ud",
      "overviewLabel": "Oversigt"
```

**Edit 2 — new namespaces after `bcOrdersPage`:**

Old:
```json
    "bcOrdersPage": {
      "heading": "BC-ordrer"
    }
  },
```

New:
```json
    "bcOrdersPage": {
      "heading": "BC-ordrer"
    },
    "bcReturnsPage": {
      "heading": "Returneringer"
    },
    "bcReturnOverview": {
      "errorHeading": "Noget gik galt",
      "errorMessage": "Vi kunne ikke indlæse dine returneringer. Prøv igen.",
      "tryAgainLabel": "Prøv igen",
      "emptyHeading": "Ingen returneringer fundet",
      "emptyMessage": "Du har endnu ikke indsendt nogen returneringer."
    },
    "bcReturnFilters": {
      "statusLabel": "Status",
      "allStatusesOption": "Alle statusser",
      "fromLabel": "Fra",
      "toLabel": "Til",
      "searchLabel": "Søg",
      "searchPlaceholder": "Returnummer…",
      "clearLabel": "Ryd"
    },
    "bcReturnCard": {
      "detailsLabel": "Detaljer",
      "relatedOrderLabel": "Ordre #{number}",
      "itemCountLabel": "{count} varer"
    }
  },
```

### `apps/storefront/messages/de.json` (edit)

**Edit 1 — `Account.nav`:**

Old:
```json
    "nav": {
      "accountLabel": "Konto",
      "helloLabel": "Hallo {name}",
      "profileLabel": "Profil",
      "companyLabel": "Unternehmen",
      "addressesLabel": "Adressen",
      "ordersLabel": "Bestellungen",
      "bcOrdersLabel": "BC-Bestellungen",
      "claimsLabel": "Reklamationen",
      "approvalsLabel": "Genehmigungen",
      "quotesLabel": "Angebote",
      "logoutLabel": "Abmelden",
      "overviewLabel": "Übersicht"
```

New:
```json
    "nav": {
      "accountLabel": "Konto",
      "helloLabel": "Hallo {name}",
      "profileLabel": "Profil",
      "companyLabel": "Unternehmen",
      "addressesLabel": "Adressen",
      "ordersLabel": "Bestellungen",
      "bcOrdersLabel": "BC-Bestellungen",
      "returnsLabel": "Retouren",
      "claimsLabel": "Reklamationen",
      "approvalsLabel": "Genehmigungen",
      "quotesLabel": "Angebote",
      "logoutLabel": "Abmelden",
      "overviewLabel": "Übersicht"
```

**Edit 2 — new namespaces after `bcOrdersPage`:**

Old:
```json
    "bcOrdersPage": {
      "heading": "BC-Bestellungen"
    }
  },
```

New:
```json
    "bcOrdersPage": {
      "heading": "BC-Bestellungen"
    },
    "bcReturnsPage": {
      "heading": "Retouren"
    },
    "bcReturnOverview": {
      "errorHeading": "Etwas ist schiefgelaufen",
      "errorMessage": "Ihre Retouren konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
      "tryAgainLabel": "Erneut versuchen",
      "emptyHeading": "Keine Retouren gefunden",
      "emptyMessage": "Sie haben noch keine Retouren eingereicht."
    },
    "bcReturnFilters": {
      "statusLabel": "Status",
      "allStatusesOption": "Alle Status",
      "fromLabel": "Von",
      "toLabel": "Bis",
      "searchLabel": "Suche",
      "searchPlaceholder": "Retourennummer…",
      "clearLabel": "Löschen"
    },
    "bcReturnCard": {
      "detailsLabel": "Details",
      "relatedOrderLabel": "Bestellung #{number}",
      "itemCountLabel": "{count} Artikel"
    }
  },
```

### `apps/storefront/messages/fr.json` (edit)

**Edit 1 — `Account.nav`:**

Old:
```json
    "nav": {
      "accountLabel": "Compte",
      "helloLabel": "Bonjour {name}",
      "profileLabel": "Profil",
      "companyLabel": "Entreprise",
      "addressesLabel": "Adresses",
      "ordersLabel": "Commandes",
      "bcOrdersLabel": "Commandes BC",
      "claimsLabel": "Réclamations",
      "approvalsLabel": "Approbations",
      "quotesLabel": "Devis",
      "logoutLabel": "Se déconnecter",
      "overviewLabel": "Aperçu"
```

New:
```json
    "nav": {
      "accountLabel": "Compte",
      "helloLabel": "Bonjour {name}",
      "profileLabel": "Profil",
      "companyLabel": "Entreprise",
      "addressesLabel": "Adresses",
      "ordersLabel": "Commandes",
      "bcOrdersLabel": "Commandes BC",
      "returnsLabel": "Retours",
      "claimsLabel": "Réclamations",
      "approvalsLabel": "Approbations",
      "quotesLabel": "Devis",
      "logoutLabel": "Se déconnecter",
      "overviewLabel": "Aperçu"
```

**Edit 2 — new namespaces after `bcOrdersPage`:**

Old:
```json
    "bcOrdersPage": {
      "heading": "Commandes BC"
    }
  },
```

New:
```json
    "bcOrdersPage": {
      "heading": "Commandes BC"
    },
    "bcReturnsPage": {
      "heading": "Retours"
    },
    "bcReturnOverview": {
      "errorHeading": "Une erreur s'est produite",
      "errorMessage": "Nous n'avons pas pu charger vos retours. Veuillez réessayer.",
      "tryAgainLabel": "Réessayer",
      "emptyHeading": "Aucun retour trouvé",
      "emptyMessage": "Vous n'avez soumis aucun retour pour le moment."
    },
    "bcReturnFilters": {
      "statusLabel": "Statut",
      "allStatusesOption": "Tous les statuts",
      "fromLabel": "De",
      "toLabel": "À",
      "searchLabel": "Rechercher",
      "searchPlaceholder": "Numéro de retour…",
      "clearLabel": "Effacer"
    },
    "bcReturnCard": {
      "detailsLabel": "Détails",
      "relatedOrderLabel": "Commande #{number}",
      "itemCountLabel": "{count} articles"
    }
  },
```

### `apps/storefront/messages/it.json` (edit)

**Edit 1 — `Account.nav`:**

Old:
```json
    "nav": {
      "accountLabel": "Account",
      "helloLabel": "Ciao {name}",
      "profileLabel": "Profilo",
      "companyLabel": "Azienda",
      "addressesLabel": "Indirizzi",
      "ordersLabel": "Ordini",
      "bcOrdersLabel": "Ordini BC",
      "claimsLabel": "Reclami",
      "approvalsLabel": "Approvazioni",
      "quotesLabel": "Preventivi",
      "logoutLabel": "Esci",
      "overviewLabel": "Panoramica"
```

New:
```json
    "nav": {
      "accountLabel": "Account",
      "helloLabel": "Ciao {name}",
      "profileLabel": "Profilo",
      "companyLabel": "Azienda",
      "addressesLabel": "Indirizzi",
      "ordersLabel": "Ordini",
      "bcOrdersLabel": "Ordini BC",
      "returnsLabel": "Resi",
      "claimsLabel": "Reclami",
      "approvalsLabel": "Approvazioni",
      "quotesLabel": "Preventivi",
      "logoutLabel": "Esci",
      "overviewLabel": "Panoramica"
```

**Edit 2 — new namespaces after `bcOrdersPage`:**

Old:
```json
    "bcOrdersPage": {
      "heading": "Ordini BC"
    }
  },
```

New:
```json
    "bcOrdersPage": {
      "heading": "Ordini BC"
    },
    "bcReturnsPage": {
      "heading": "Resi"
    },
    "bcReturnOverview": {
      "errorHeading": "Qualcosa è andato storto",
      "errorMessage": "Non è stato possibile caricare i tuoi resi. Riprova.",
      "tryAgainLabel": "Riprova",
      "emptyHeading": "Nessun reso trovato",
      "emptyMessage": "Non hai ancora inviato alcun reso."
    },
    "bcReturnFilters": {
      "statusLabel": "Stato",
      "allStatusesOption": "Tutti gli stati",
      "fromLabel": "Da",
      "toLabel": "A",
      "searchLabel": "Cerca",
      "searchPlaceholder": "Numero di reso…",
      "clearLabel": "Cancella"
    },
    "bcReturnCard": {
      "detailsLabel": "Dettagli",
      "relatedOrderLabel": "Ordine #{number}",
      "itemCountLabel": "{count} articoli"
    }
  },
```

## Test Cases

### TC-1: Happy path — page renders the heading
- **Given:** `listBCReturns` resolves with an empty page (mocked).
- **When:** The `Returns` page component is rendered.
- **Then:** The heading text "Returns" (from `Account.bcReturnsPage.heading`) is present.

### TC-2: Edge case / integration — nav shows "Returns" as a top-level entry in both variants
- **Given:** `AccountNav` is rendered for a non-admin customer.
- **When:** The desktop nav (`account-nav`) and mobile nav (`mobile-account-nav`) are inspected.
- **Then:** Both contain a `returns-link` element with `href` containing `/account/returns`, positioned as a sibling of `bc-orders-link` and `claims-link` (not nested under `orders-link`).

### TC-3: Integration — graceful degradation on BC error (already covered structurally)
- **Given:** `listBCReturns` throws (BC API error/timeout).
- **When:** The `Returns` page component runs.
- **Then:** `hasError` is set to `true` and `BcReturnOverview` receives `error={true}` instead of the page throwing — this is the same try/catch pattern as `bcorders/page.tsx` and is exercised indirectly by Task 04's `BcReturnOverview` error-state test (TC-5 in Task 04); no separate test is needed here beyond confirming the `try`/`catch` is present in the code (see Implementation Steps).

## Implementation Steps

1. Create `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/page.tsx` exactly as specified.
2. Create `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/loading.tsx` exactly as specified.
3. Edit `apps/storefront/src/modules/account/components/account-nav/index.tsx`: apply Edit 1 (import), Edit 2 (mobile nav), and Edit 3 (desktop nav) exactly as specified.
4. Edit `apps/storefront/src/__tests__/modules/account/components/account-nav.test.tsx` to add the new "Returns link is a top-level entry" test exactly as specified.
5. Edit all 5 message files (`en.json`, `da.json`, `de.json`, `fr.json`, `it.json`) under `apps/storefront/messages/` exactly as specified — each has 2 edits (nav label, new namespaces). Preserve exact JSON formatting (2-space indent) and comma placement.
6. Create `apps/storefront/src/__tests__/app/bcreturns-page.test.tsx` exactly as specified.
7. Do **not** create a `returns/[id]/page.tsx` — that is NIMBUS-141's responsibility.
8. Run `cd apps/storefront && pnpm test` and confirm all new and modified tests pass, including all of Task 04's component tests (their translation-dependent assertions depend on this task's message-file edits).
9. Run `pnpm build` from the repo root and confirm no TypeScript errors.
10. Run `pnpm lint` from the repo root and confirm no new lint errors, and validate all 5 JSON message files are syntactically valid (e.g. `node -e "JSON.parse(require('fs').readFileSync('apps/storefront/messages/en.json'))"` for each locale).
