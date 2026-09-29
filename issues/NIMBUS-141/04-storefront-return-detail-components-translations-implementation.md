# Task 04: Return detail components, template and all-locale translations — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-141 (from develop)
**Depends on:** Task 03; NIMBUS-140 Task 04 and Task 05 (merged to develop)

> NIMBUS-140 must be merged first:
> - The back link targets NIMBUS-140's `/account/returns` page.
> - NIMBUS-140 adds its own `Account.*` namespaces to the same catalogs.
>
> The catalog anchors below do not depend on NIMBUS-140's keys. New namespaces go at the **end
> of the `Account` object**, and `viewReturnLabel` goes inside NIMBUS-138's `Account.bcOrderReturn`.

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (`jest-environment-jsdom`)
- **Test location:** `apps/storefront/src/__tests__/modules/account/components/<component>/index.test.tsx` and `apps/storefront/src/__tests__/modules/account/templates/`
- **Naming conventions:** kebab-case folders, PascalCase component names, double quotes, no
  semicolons. `messages/*.json` use **LF** line endings and 2-space indentation. New `.tsx` files
  may use LF or CRLF; the existing BC files use CRLF.

## IMPORTANT: `next-intl` is mocked automatically

`apps/storefront/__mocks__/next-intl.tsx` (providing `useTranslations`) and
`__mocks__/next-intl/server.ts` (providing `getTranslations`) are applied to every test. They
resolve keys against the **real `messages/en.json`**, and `{name}` interpolation is a plain
string replace with no ICU plural or select support. Tests therefore assert real English copy.
**Apply the catalog edits (step 1) before running the tests.** Do not add `jest.mock("next-intl")`.

## Solution Design

Three **synchronous** components use `useTranslations` from `next-intl`. That is valid in
non-async Server Components, as in the existing `bc-order-line-fulfillment` and `order-card`.
Being synchronous, they can be nested and still render in React Testing Library, which cannot
render nested *async* Server Components (see NIMBUS-140 Task 04). The components carry no
`"use client"`.

| Component | Path | Purpose |
|---|---|---|
| `BcReturnLines` | `src/modules/account/components/bc-return-lines/index.tsx` | Lines table: item (description, item no. and variant), unit, requested qty, received qty, reason. **No prices** (Q4). Empty state. Kept separate so that NIMBUS-172 can reuse it for posted receipt lines. |
| `BcReturnExpectedCredit` | `src/modules/account/components/bc-return-expected-credit/index.tsx` | "Expected credit" summary: excl. tax (only when not `null`), incl. tax, and the disclaimer that the credit note sets the final amount. Amounts use the existing `convertToLocale` from `@/lib/util/money`, the same formatter as `order-card`. The currency comes from the backend, where a blank BC currency is already resolved to LCY. |
| `BcReturnDetailTemplate` | `src/modules/account/templates/bc-return-detail-template.tsx` | Page body: back link to `/account/returns`, heading "Return #…", date requested (`documentDate`, `en-GB` date like the BC order page), and the decoded BC status as a pill (same classes as NIMBUS-140's `bc-return-card`), plus the two sections above in `Container`s. |

- **Status:** shown exactly as the backend decoded it, for example "Pending Approval", with no
  relabelling (Q1).
- **Reason:** the raw BC reason code, for example `NORMAL`, or `-` when empty. See PLAN.md open
  question OQ-2.
- **Extensibility for NIMBUS-172:** the template is only a composition of sections. A posted
  return can reuse `BcReturnLines`, and can swap or omit the credit section, without changing
  them.

All texts for this task **and** for Task 05 (not-found page, error state, confirmation link)
are added here, in all 8 locales, so each task is green on its own.

## Code Skeletons

### New File: `apps/storefront/src/modules/account/components/bc-return-lines/index.tsx`

```tsx
import { Heading } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import type { BCReturnDetailLine } from "@/types/bc-order"

type BcReturnLinesProps = {
  lines: BCReturnDetailLine[]
}

const BcReturnLines = ({ lines }: BcReturnLinesProps) => {
  const t = useTranslations("Account.bcReturnLines")

  return (
    <div data-testid="bc-return-lines">
      <Heading level="h2" className="mb-4">
        {t("itemsHeading")}
      </Heading>
      {lines.length === 0 ? (
        <p
          className="text-base-regular text-ui-fg-subtle"
          data-testid="bc-return-lines-empty"
        >
          {t("emptyMessage")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small-regular">
            <thead className="border-b border-ui-border-base text-ui-fg-subtle">
              <tr>
                <th className="pb-2 pr-4 font-normal">{t("itemColumnLabel")}</th>
                <th className="pb-2 pr-4 font-normal">{t("unitColumnLabel")}</th>
                <th className="pb-2 pr-4 font-normal">
                  {t("requestedQuantityColumnLabel")}
                </th>
                <th className="pb-2 pr-4 font-normal">
                  {t("receivedQuantityColumnLabel")}
                </th>
                <th className="pb-2 font-normal">{t("reasonColumnLabel")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-ui-border-base"
                  data-testid="bc-return-line"
                >
                  <td className="py-3 pr-4 text-ui-fg-base">
                    <div>{line.description || line.itemNumber}</div>
                    {line.itemNumber && (
                      <div
                        className="text-ui-fg-subtle"
                        data-testid="bc-return-line-item-number"
                      >
                        {t("itemNumberLabel", { number: line.itemNumber })}
                        {line.variantCode
                          ? ` · ${t("variantLabel", { variant: line.variantCode })}`
                          : ""}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-ui-fg-base">
                    {line.unitOfMeasureCode}
                  </td>
                  <td
                    className="py-3 pr-4 text-ui-fg-base"
                    data-testid="bc-return-line-quantity"
                  >
                    {line.quantity}
                  </td>
                  <td
                    className="py-3 pr-4 text-ui-fg-base"
                    data-testid="bc-return-line-received"
                  >
                    {line.quantityReceived}
                  </td>
                  <td
                    className="py-3 text-ui-fg-base"
                    data-testid="bc-return-line-reason"
                  >
                    {line.returnReasonCode || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default BcReturnLines
```

### New File: `apps/storefront/src/modules/account/components/bc-return-expected-credit/index.tsx`

```tsx
import { Heading } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { convertToLocale } from "@/lib/util/money"
import type { BCReturnExpectedCredit } from "@/types/bc-order"

type BcReturnExpectedCreditProps = {
  expectedCredit: BCReturnExpectedCredit
}

const BcReturnExpectedCredit = ({ expectedCredit }: BcReturnExpectedCreditProps) => {
  const t = useTranslations("Account.bcReturnExpectedCredit")
  const formatAmount = (amount: number) =>
    convertToLocale({ amount, currency_code: expectedCredit.currencyCode })

  return (
    <div className="flex flex-col gap-y-3" data-testid="bc-return-expected-credit">
      <Heading level="h2">{t("heading")}</Heading>
      <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
        {expectedCredit.amountExcludingTax !== null && (
          <div>
            <dt className="text-ui-fg-subtle">{t("excludingTaxLabel")}</dt>
            <dd
              className="text-ui-fg-base"
              data-testid="bc-return-expected-credit-excluding-tax"
            >
              {formatAmount(expectedCredit.amountExcludingTax)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-ui-fg-subtle">{t("includingTaxLabel")}</dt>
          <dd
            className="text-ui-fg-base font-medium"
            data-testid="bc-return-expected-credit-including-tax"
          >
            {formatAmount(expectedCredit.amountIncludingTax)}
          </dd>
        </div>
      </dl>
      <p
        className="text-small-regular text-ui-fg-subtle"
        data-testid="bc-return-expected-credit-disclaimer"
      >
        {t("disclaimer")}
      </p>
    </div>
  )
}

export default BcReturnExpectedCredit
```

### New File: `apps/storefront/src/modules/account/templates/bc-return-detail-template.tsx`

```tsx
import { Container, Heading } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import BcReturnExpectedCredit from "@/modules/account/components/bc-return-expected-credit"
import BcReturnLines from "@/modules/account/components/bc-return-lines"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCReturnDetail } from "@/types/bc-order"

type BcReturnDetailTemplateProps = {
  bcReturn: BCReturnDetail
}

const BcReturnDetailTemplate = ({ bcReturn }: BcReturnDetailTemplateProps) => {
  const t = useTranslations("Account.bcReturnDetailTemplate")

  return (
    <div className="flex flex-col gap-y-4" data-testid="bc-return-detail">
      <LocalizedClientLink
        href="/account/returns"
        className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base"
        data-testid="bc-return-back-link"
      >
        {t("backToReturnsLabel")}
      </LocalizedClientLink>

      <Container className="flex flex-col gap-y-4">
        <Heading level="h1">
          {t("returnNumberHeading", { number: bcReturn.number })}
        </Heading>
        <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
          <div>
            <dt className="text-ui-fg-subtle">{t("requestedDateLabel")}</dt>
            <dd className="text-ui-fg-base" data-testid="bc-return-document-date">
              {new Date(bcReturn.documentDate).toLocaleDateString("en-GB")}
            </dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">{t("statusLabel")}</dt>
            <dd>
              <span
                className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
                data-testid="bc-return-status"
              >
                {bcReturn.status}
              </span>
            </dd>
          </div>
        </dl>
      </Container>

      <Container>
        <BcReturnLines lines={bcReturn.lines} />
      </Container>

      <Container>
        <BcReturnExpectedCredit expectedCredit={bcReturn.expectedCredit} />
      </Container>
    </div>
  )
}

export default BcReturnDetailTemplate
```

### New File: `apps/storefront/src/__tests__/modules/account/components/bc-return-lines/index.test.tsx`

```tsx
import { render, screen, within } from "@testing-library/react"

import BcReturnLines from "@/modules/account/components/bc-return-lines"
import type { BCReturnDetailLine } from "@/types/bc-order"

const lines: BCReturnDetailLine[] = [
  {
    id: "line-30000",
    sequence: 30000,
    lineType: "Item",
    itemNumber: "FVIE-M-BLACK",
    variantCode: "XL",
    description: "Fjeld Vest",
    unitOfMeasureCode: "PCS",
    quantity: 2,
    quantityReceived: 1,
    returnReasonCode: "NORMAL",
  },
  {
    id: "line-60000",
    sequence: 60000,
    lineType: "Item",
    itemNumber: "F2",
    variantCode: "",
    description: "",
    unitOfMeasureCode: "PCS",
    quantity: 1,
    quantityReceived: 0,
    returnReasonCode: "",
  },
]

describe("BcReturnLines", () => {
  // TC-1: happy path — column headers and per-line values, incl. received quantity.
  it("renders item, unit, requested and received quantities and the reason per line", () => {
    render(<BcReturnLines lines={lines} />)

    expect(screen.getByText("Items")).toBeInTheDocument()
    expect(screen.getByText("Item")).toBeInTheDocument()
    expect(screen.getByText("Unit")).toBeInTheDocument()
    expect(screen.getByText("Requested")).toBeInTheDocument()
    expect(screen.getByText("Received")).toBeInTheDocument()
    expect(screen.getByText("Reason")).toBeInTheDocument()

    const [first, second] = screen.getAllByTestId("bc-return-line")
    expect(within(first).getByText("Fjeld Vest")).toBeInTheDocument()
    expect(within(first).getByTestId("bc-return-line-item-number")).toHaveTextContent(
      "Item no. FVIE-M-BLACK · Variant XL"
    )
    expect(within(first).getByTestId("bc-return-line-quantity")).toHaveTextContent("2")
    expect(within(first).getByTestId("bc-return-line-received")).toHaveTextContent("1")
    expect(within(first).getByTestId("bc-return-line-reason")).toHaveTextContent("NORMAL")

    // Missing description falls back to the item number; no variant suffix; empty reason → "-".
    expect(within(second).getByTestId("bc-return-line-item-number")).toHaveTextContent(
      /^Item no\. F2$/
    )
    expect(within(second).getByTestId("bc-return-line-reason")).toHaveTextContent("-")
  })

  // TC-2: scope decision Q4 — no line prices or amounts are shown.
  it("does not render any price or amount column", () => {
    render(<BcReturnLines lines={lines} />)

    expect(screen.queryByText(/price/i)).toBeNull()
    expect(screen.queryByText(/amount/i)).toBeNull()
  })

  // TC-3: edge case — a return without item lines shows an empty message instead of a table.
  it("renders the empty message when there are no lines", () => {
    render(<BcReturnLines lines={[]} />)

    expect(screen.getByTestId("bc-return-lines-empty")).toHaveTextContent(
      "This return has no item lines."
    )
    expect(screen.queryByRole("table")).toBeNull()
  })
})
```

### New File: `apps/storefront/src/__tests__/modules/account/components/bc-return-expected-credit/index.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"

import { convertToLocale } from "@/lib/util/money"
import BcReturnExpectedCredit from "@/modules/account/components/bc-return-expected-credit"

// jest-dom normalises the rendered text's whitespace (Intl uses U+00A0 after the currency code).
const money = (amount: number, currencyCode: string) =>
  convertToLocale({ amount, currency_code: currencyCode }).replace(/\s/g, " ")

describe("BcReturnExpectedCredit", () => {
  // TC-1: happy path — both totals in the return's currency, labelled as expected.
  it("renders the expected credit excluding and including tax with the disclaimer", () => {
    render(
      <BcReturnExpectedCredit
        expectedCredit={{
          currencyCode: "DKK",
          amountIncludingTax: 1598.75,
          amountExcludingTax: 1279,
        }}
      />
    )

    expect(screen.getByText("Expected credit")).toBeInTheDocument()
    expect(screen.getByText("Expected credit excluding tax")).toBeInTheDocument()
    expect(screen.getByText("Expected credit including tax")).toBeInTheDocument()
    expect(
      screen.getByTestId("bc-return-expected-credit-excluding-tax")
    ).toHaveTextContent(money(1279, "DKK"))
    expect(
      screen.getByTestId("bc-return-expected-credit-including-tax")
    ).toHaveTextContent(money(1598.75, "DKK"))
    expect(screen.getByTestId("bc-return-expected-credit-disclaimer")).toHaveTextContent(
      "This amount is an estimate based on the return order. The final amount is set on the credit note."
    )
  })

  // TC-2: edge case — prices incl. VAT: no net figure, only the incl.-tax amount.
  it("hides the excluding-tax amount when it is null", () => {
    render(
      <BcReturnExpectedCredit
        expectedCredit={{
          currencyCode: "SEK",
          amountIncludingTax: 500,
          amountExcludingTax: null,
        }}
      />
    )

    expect(screen.queryByTestId("bc-return-expected-credit-excluding-tax")).toBeNull()
    expect(
      screen.getByTestId("bc-return-expected-credit-including-tax")
    ).toHaveTextContent(money(500, "SEK"))
  })
})
```

### New File: `apps/storefront/src/__tests__/modules/account/templates/bc-return-detail-template.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import BcReturnDetailTemplate from "@/modules/account/templates/bc-return-detail-template"
import type { BCReturnDetail } from "@/types/bc-order"

const bcReturn: BCReturnDetail = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Pending Approval",
  lines: [
    {
      id: "line-30000",
      sequence: 30000,
      lineType: "Item",
      itemNumber: "FVIE-M-BLACK",
      variantCode: "XL",
      description: "Fjeld Vest",
      unitOfMeasureCode: "PCS",
      quantity: 2,
      quantityReceived: 1,
      returnReasonCode: "NORMAL",
    },
  ],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
}

describe("BcReturnDetailTemplate", () => {
  // TC-1: happy path — header fields, decoded BC status and both sections.
  it("renders the return number, requested date, BC status, lines and expected credit", () => {
    render(<BcReturnDetailTemplate bcReturn={bcReturn} />)

    expect(screen.getByText("Return #31502910")).toBeInTheDocument()
    expect(screen.getByText("Requested on")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-document-date")).toHaveTextContent(
      new Date("2026-09-27").toLocaleDateString("en-GB")
    )
    expect(screen.getByTestId("bc-return-status")).toHaveTextContent("Pending Approval")
    expect(screen.getByTestId("bc-return-lines")).toBeInTheDocument()
    expect(screen.getByTestId("bc-return-expected-credit")).toBeInTheDocument()
  })

  // TC-2: wiring — the back link goes to the NIMBUS-140 overview in the current country.
  it("links back to the returns overview", () => {
    render(<BcReturnDetailTemplate bcReturn={bcReturn} />)

    const backLink = screen.getByTestId("bc-return-back-link")
    expect(backLink).toHaveTextContent("Back to returns")
    expect(backLink).toHaveAttribute("href", "/dk/account/returns")
  })
})
```

## Message Catalogs (all 8 locales)

Edit **each** of `apps/storefront/messages/{en,da,de,fr,it,no,pl,sv}.json`. Only insert keys;
preserve 2-space indentation, LF line endings and the existing key order. **All 8 files must end
up with identical key paths**, which `src/__tests__/lib/i18n/message-catalogs.test.ts` enforces.

**Edit A: `Account.bcOrderReturn.viewReturnLabel`.** Insert one line directly after the existing
`"backToOrderDetailsLabel": "…",` line in `Account.bcOrderReturn`:

| Locale | Line to insert |
|---|---|
| en | `      "viewReturnLabel": "View return",` |
| da | `      "viewReturnLabel": "Se returnering",` |
| de | `      "viewReturnLabel": "Rücksendung anzeigen",` |
| fr | `      "viewReturnLabel": "Voir le retour",` |
| it | `      "viewReturnLabel": "Visualizza reso",` |
| no | `      "viewReturnLabel": "Vis retur",` |
| pl | `      "viewReturnLabel": "Zobacz zwrot",` |
| sv | `      "viewReturnLabel": "Visa retur",` |

**Edit B: five new namespaces at the end of `Account`.** The last key of `Account` is currently
`bcOrderLineFulfillment`, and its object ends with the `"reservationFreightLabel": "…"` line.
Add a comma after the closing `}` of that last `Account` child object, then insert the locale's
block below it, before the `  },` that closes `Account` and the following `  "Cart": {`. For
`en.json`, the result looks like this:

```json
      "reservationFreightLabel": "Freight: {freightType}"
    },
    "bcReturnDetailTemplate": {
      …
    },
    …
    "bcReturnDetailPage": {
      …
    }
  },
  "Cart": {
```

If another change has meanwhile added keys after `bcOrderLineFulfillment`, insert after the
**last** `Account` child object instead. The rule is the same: the new blocks become the last
keys of `Account`.

### `en.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Back to returns",
      "returnNumberHeading": "Return #{number}",
      "requestedDateLabel": "Requested on",
      "statusLabel": "Status"
    },
    "bcReturnLines": {
      "itemsHeading": "Items",
      "itemColumnLabel": "Item",
      "unitColumnLabel": "Unit",
      "requestedQuantityColumnLabel": "Requested",
      "receivedQuantityColumnLabel": "Received",
      "reasonColumnLabel": "Reason",
      "itemNumberLabel": "Item no. {number}",
      "variantLabel": "Variant {variant}",
      "emptyMessage": "This return has no item lines."
    },
    "bcReturnExpectedCredit": {
      "heading": "Expected credit",
      "excludingTaxLabel": "Expected credit excluding tax",
      "includingTaxLabel": "Expected credit including tax",
      "disclaimer": "This amount is an estimate based on the return order. The final amount is set on the credit note."
    },
    "bcReturnNotFound": {
      "headingLabel": "Return not found",
      "message": "This return is unavailable. Returns that have been fully processed are no longer shown here."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Something went wrong",
      "errorMessage": "We were unable to load this return. Please try again."
    }
```

### `da.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Tilbage til returneringer",
      "returnNumberHeading": "Returnering #{number}",
      "requestedDateLabel": "Anmodet den",
      "statusLabel": "Status"
    },
    "bcReturnLines": {
      "itemsHeading": "Varer",
      "itemColumnLabel": "Vare",
      "unitColumnLabel": "Enhed",
      "requestedQuantityColumnLabel": "Anmodet",
      "receivedQuantityColumnLabel": "Modtaget",
      "reasonColumnLabel": "Årsag",
      "itemNumberLabel": "Varenr. {number}",
      "variantLabel": "Variant {variant}",
      "emptyMessage": "Denne returnering har ingen varelinjer."
    },
    "bcReturnExpectedCredit": {
      "heading": "Forventet kreditering",
      "excludingTaxLabel": "Forventet kreditering ekskl. moms",
      "includingTaxLabel": "Forventet kreditering inkl. moms",
      "disclaimer": "Beløbet er et estimat baseret på returordren. Det endelige beløb fastsættes på kreditnotaen."
    },
    "bcReturnNotFound": {
      "headingLabel": "Returnering ikke fundet",
      "message": "Denne returnering er ikke tilgængelig. Returneringer, der er færdigbehandlet, vises ikke længere her."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Noget gik galt",
      "errorMessage": "Vi kunne ikke indlæse denne returnering. Prøv igen."
    }
```

### `de.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Zurück zu den Rücksendungen",
      "returnNumberHeading": "Rücksendung #{number}",
      "requestedDateLabel": "Angefordert am",
      "statusLabel": "Status"
    },
    "bcReturnLines": {
      "itemsHeading": "Artikel",
      "itemColumnLabel": "Artikel",
      "unitColumnLabel": "Einheit",
      "requestedQuantityColumnLabel": "Angefordert",
      "receivedQuantityColumnLabel": "Erhalten",
      "reasonColumnLabel": "Grund",
      "itemNumberLabel": "Artikelnr. {number}",
      "variantLabel": "Variante {variant}",
      "emptyMessage": "Diese Rücksendung enthält keine Artikelpositionen."
    },
    "bcReturnExpectedCredit": {
      "heading": "Erwartete Gutschrift",
      "excludingTaxLabel": "Erwartete Gutschrift netto",
      "includingTaxLabel": "Erwartete Gutschrift brutto",
      "disclaimer": "Dieser Betrag ist eine Schätzung auf Basis des Rücksendeauftrags. Der endgültige Betrag wird in der Gutschrift festgelegt."
    },
    "bcReturnNotFound": {
      "headingLabel": "Rücksendung nicht gefunden",
      "message": "Diese Rücksendung ist nicht verfügbar. Vollständig bearbeitete Rücksendungen werden hier nicht mehr angezeigt."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Etwas ist schiefgelaufen",
      "errorMessage": "Diese Rücksendung konnte nicht geladen werden. Bitte versuchen Sie es erneut."
    }
```

### `fr.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Revenir aux retours",
      "returnNumberHeading": "Retour #{number}",
      "requestedDateLabel": "Demandé le",
      "statusLabel": "Statut"
    },
    "bcReturnLines": {
      "itemsHeading": "Articles",
      "itemColumnLabel": "Article",
      "unitColumnLabel": "Unité",
      "requestedQuantityColumnLabel": "Demandé",
      "receivedQuantityColumnLabel": "Reçu",
      "reasonColumnLabel": "Motif",
      "itemNumberLabel": "Réf. article {number}",
      "variantLabel": "Variante {variant}",
      "emptyMessage": "Ce retour ne contient aucune ligne d'article."
    },
    "bcReturnExpectedCredit": {
      "heading": "Avoir prévu",
      "excludingTaxLabel": "Avoir prévu hors taxes",
      "includingTaxLabel": "Avoir prévu toutes taxes comprises",
      "disclaimer": "Ce montant est une estimation basée sur l'ordre de retour. Le montant définitif est fixé sur l'avoir."
    },
    "bcReturnNotFound": {
      "headingLabel": "Retour introuvable",
      "message": "Ce retour n'est pas disponible. Les retours entièrement traités ne sont plus affichés ici."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Une erreur s'est produite",
      "errorMessage": "Nous n'avons pas pu charger ce retour. Veuillez réessayer."
    }
```

### `it.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Torna ai resi",
      "returnNumberHeading": "Reso #{number}",
      "requestedDateLabel": "Richiesto il",
      "statusLabel": "Stato"
    },
    "bcReturnLines": {
      "itemsHeading": "Articoli",
      "itemColumnLabel": "Articolo",
      "unitColumnLabel": "Unità",
      "requestedQuantityColumnLabel": "Richiesta",
      "receivedQuantityColumnLabel": "Ricevuta",
      "reasonColumnLabel": "Motivo",
      "itemNumberLabel": "Cod. articolo {number}",
      "variantLabel": "Variante {variant}",
      "emptyMessage": "Questo reso non contiene righe articolo."
    },
    "bcReturnExpectedCredit": {
      "heading": "Accredito previsto",
      "excludingTaxLabel": "Accredito previsto imponibile",
      "includingTaxLabel": "Accredito previsto imposte incluse",
      "disclaimer": "Questo importo è una stima basata sull'ordine di reso. L'importo definitivo è indicato nella nota di credito."
    },
    "bcReturnNotFound": {
      "headingLabel": "Reso non trovato",
      "message": "Questo reso non è disponibile. I resi completamente elaborati non vengono più mostrati qui."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Qualcosa è andato storto",
      "errorMessage": "Non è stato possibile caricare questo reso. Riprova."
    }
```

### `no.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Tilbake til returer",
      "returnNumberHeading": "Retur #{number}",
      "requestedDateLabel": "Forespurt den",
      "statusLabel": "Status"
    },
    "bcReturnLines": {
      "itemsHeading": "Varer",
      "itemColumnLabel": "Vare",
      "unitColumnLabel": "Enhet",
      "requestedQuantityColumnLabel": "Forespurt",
      "receivedQuantityColumnLabel": "Mottatt",
      "reasonColumnLabel": "Årsak",
      "itemNumberLabel": "Varenr. {number}",
      "variantLabel": "Variant {variant}",
      "emptyMessage": "Denne returen har ingen varelinjer."
    },
    "bcReturnExpectedCredit": {
      "heading": "Forventet kreditering",
      "excludingTaxLabel": "Forventet kreditering eksklusiv mva",
      "includingTaxLabel": "Forventet kreditering inklusiv mva",
      "disclaimer": "Beløpet er et estimat basert på returordren. Det endelige beløpet fastsettes på kreditnotaen."
    },
    "bcReturnNotFound": {
      "headingLabel": "Retur ikke funnet",
      "message": "Denne returen er ikke tilgjengelig. Returer som er ferdig behandlet, vises ikke lenger her."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Noe gikk galt",
      "errorMessage": "Vi kunne ikke laste inn denne returen. Prøv igjen."
    }
```

### `pl.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Powrót do zwrotów",
      "returnNumberHeading": "Zwrot #{number}",
      "requestedDateLabel": "Data zgłoszenia",
      "statusLabel": "Status"
    },
    "bcReturnLines": {
      "itemsHeading": "Produkty",
      "itemColumnLabel": "Pozycja",
      "unitColumnLabel": "Jednostka",
      "requestedQuantityColumnLabel": "Zgłoszono",
      "receivedQuantityColumnLabel": "Przyjęto",
      "reasonColumnLabel": "Powód",
      "itemNumberLabel": "Nr towaru {number}",
      "variantLabel": "Wariant {variant}",
      "emptyMessage": "Ten zwrot nie zawiera pozycji towarowych."
    },
    "bcReturnExpectedCredit": {
      "heading": "Przewidywana korekta",
      "excludingTaxLabel": "Przewidywana korekta bez podatku",
      "includingTaxLabel": "Przewidywana korekta z podatkiem",
      "disclaimer": "Ta kwota jest szacunkowa i opiera się na zamówieniu zwrotu. Ostateczna kwota zostanie ustalona na fakturze korygującej."
    },
    "bcReturnNotFound": {
      "headingLabel": "Nie znaleziono zwrotu",
      "message": "Ten zwrot jest niedostępny. W pełni przetworzone zwroty nie są już tutaj wyświetlane."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Coś poszło nie tak",
      "errorMessage": "Nie udało się załadować tego zwrotu. Spróbuj ponownie."
    }
```

### `sv.json`, Edit B block

```json
    "bcReturnDetailTemplate": {
      "backToReturnsLabel": "Tillbaka till returer",
      "returnNumberHeading": "Retur #{number}",
      "requestedDateLabel": "Begärd den",
      "statusLabel": "Status"
    },
    "bcReturnLines": {
      "itemsHeading": "Varor",
      "itemColumnLabel": "Artikel",
      "unitColumnLabel": "Enhet",
      "requestedQuantityColumnLabel": "Begärt",
      "receivedQuantityColumnLabel": "Mottaget",
      "reasonColumnLabel": "Orsak",
      "itemNumberLabel": "Artikelnr {number}",
      "variantLabel": "Variant {variant}",
      "emptyMessage": "Den här returen har inga artikelrader."
    },
    "bcReturnExpectedCredit": {
      "heading": "Förväntad kreditering",
      "excludingTaxLabel": "Förväntad kreditering exklusive moms",
      "includingTaxLabel": "Förväntad kreditering inklusive moms",
      "disclaimer": "Beloppet är en uppskattning baserad på returordern. Det slutliga beloppet fastställs på kreditfakturan."
    },
    "bcReturnNotFound": {
      "headingLabel": "Returen hittades inte",
      "message": "Den här returen är inte tillgänglig. Returer som har behandlats färdigt visas inte längre här."
    },
    "bcReturnDetailPage": {
      "errorHeading": "Något gick fel",
      "errorMessage": "Vi kunde inte läsa in den här returen. Försök igen."
    }
```

Check after editing (from the repo root). It must exit 0:
`node -e "for (const l of ['en','da','de','fr','it','no','pl','sv']) JSON.parse(require('fs').readFileSync('apps/storefront/messages/'+l+'.json','utf8'))"`

## Test Cases

### TC-1: `BcReturnLines`, happy path
- **Given:** two lines, one with a variant and reason, one without a description, variant or reason.
- **When:** the component renders.
- **Then:**
  - The headers are Item, Unit, Requested, Received and Reason.
  - Row 1 shows "Fjeld Vest", "Item no. FVIE-M-BLACK · Variant XL", 2, 1 and NORMAL.
  - Row 2 shows "Item no. F2" with no variant suffix, and "-" as the reason.

### TC-2: `BcReturnLines`, no prices (Q4)
- **Given:** the same lines.
- **When:** the component renders.
- **Then:** no text matching /price/i or /amount/i is rendered.

### TC-3: `BcReturnLines`, empty
- **Given:** `lines: []`.
- **When:** the component renders.
- **Then:** "This return has no item lines." is shown and there is no table.

### TC-4: `BcReturnExpectedCredit`, happy path
- **Given:** DKK, 1598.75 incl. tax and 1279 excl. tax.
- **When:** the component renders.
- **Then:** both amounts appear, formatted by `convertToLocale` in DKK, with the "expected" labels and the credit-note disclaimer.

### TC-5: `BcReturnExpectedCredit`, prices incl. VAT
- **Given:** `amountExcludingTax: null`.
- **When:** the component renders.
- **Then:** the excl.-tax row is absent and the incl.-tax amount is shown.

### TC-6: `BcReturnDetailTemplate`, integration
- **Given:** a full `BCReturnDetail`.
- **When:** the template renders.
- **Then:** "Return #31502910", the requested date, the status pill "Pending Approval", the lines section and the credit section are all rendered.

### TC-7: `BcReturnDetailTemplate`, back link wiring
- **Given:** country code `dk`.
- **When:** the template renders.
- **Then:** "Back to returns" links to `/dk/account/returns`.

### TC-8: Message catalogs, 8-locale key parity (existing test, must stay green)
- **Given:** Edits A and B are applied to all 8 locales.
- **When:** `message-catalogs.test.ts` runs.
- **Then:** every catalog parses, and its key paths equal those of `en.json`.

## Implementation Steps

1. Apply Edits A and B to all 8 catalogs, then run the JSON parse check.
2. Create the three components and the template exactly as specified.
3. Create the three test files exactly as specified.
4. Run `cd apps/storefront && pnpm test`. The new tests must pass, as must `message-catalogs.test.ts` and the full suite.
5. Run `pnpm build` (repo root) and `pnpm lint`. Neither may report new errors.
