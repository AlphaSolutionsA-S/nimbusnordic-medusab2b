# Task 04: Storefront — return detail for processed returns and posted receipts — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-172 (from develop)
**Depends on:** Task 02 (the backend detail response shape) and Task 03 (the storefront list types
`BCReturnState`, `BCReturnSource` and `BCPostedReturnReceiptSummary`, the `Account.bcReturnState`
namespace, and the catalog order)

---

## Project Environment

The environment is the same as in Task 03:
- **Test command:** `cd apps/storefront && pnpm test`.
- **Build command:** `cd apps/storefront && pnpm build`.
- **Lint command:** `pnpm lint` (from the root).
- **Mocks:** the `next-intl` auto-mock reads `messages/en.json`.
- **Parity:** 8-locale key parity is enforced.
- **Code style:** double quotes and no semicolons.
- **Components:** synchronous components use `useTranslations`/`useLocale`, which is the
  NIMBUS-141 pattern that lets RTL render the template directly.

## Solution Design

The storefront `BCReturnDetail` mirrors Task 02: it adds `state`, `source` and
`receipts: BCPostedReturnReceipt[]`, and `expectedCredit` becomes nullable.

`BcReturnDetailTemplate` (NIMBUS-141) is extended as follows:

- **Heading:**
  - For `source: "posted_receipt"`, the heading is "Return receipt #{number}".
  - Otherwise, it stays "Return #{number}".
- **Header list:**
  - "Requested on" (the return order date) is shown only for **open** returns. A processed
    return no longer has a return order, and its receipts carry their own received dates.
  - "Status" shows the translated **state badge** (`bc-return-state`).
  - For open returns, the raw BC status pill (`bc-return-status`) is also shown, under the same
    rule as the list card: only when the status is not empty and is not "Open".
- **Sections:**
  - Open returns: `BcReturnLines` (unchanged), then `BcReturnExpectedCredit` when
    `expectedCredit !== null`.
  - Every return with receipts, open or processed: a new `BcReturnReceipts` section.
- **New component `BcReturnReceipts`:** one block per receipt (oldest first, in the order the
  backend sends them), containing:
  - the heading "Receipt #{number}";
  - "Received on" with the formatted `receivedDate`, or `-`;
  - "External ref" with its value, shown only when the value is not empty and rendered as
    plain text;
  - a lines table with the columns Item, Unit, Quantity and Reason:
    - the item cell shows the description, falling back to the item number, with
      "Item no. X · Variant Y" underneath;
    - the column labels and the item number and variant labels are reused from
      `Account.bcReturnLines`;
    - an empty-lines message is shown when there are no lines.
  - No prices are shown (NIMBUS-141 decision).
- **Not-found copy:** `Account.bcReturnNotFound.message` currently says that processed returns
  are no longer shown. After this story that is false, so the message is replaced in all 8
  locales with a neutral, non-disclosing text.

## Code Skeletons

### Edit 1: `apps/storefront/src/types/bc-order.ts`

Insert these lines directly **before** `export type BCReturnDetailLine = {`:

```typescript
export type BCPostedReturnReceiptLine = {
  lineNumber: number
  itemNumber: string
  variantCode: string
  description: string
  quantity: number
  unitOfMeasureCode: string
  returnReasonCode: string
}

export type BCPostedReturnReceipt = BCPostedReturnReceiptSummary & {
  lines: BCPostedReturnReceiptLine[]
}
```

Replace `BCReturnDetail` with the following:

```typescript
export type BCReturnDetail = {
  id: string
  number: string
  documentDate: string
  status: string
  state: BCReturnState
  source: BCReturnSource
  lines: BCReturnDetailLine[]
  expectedCredit: BCReturnExpectedCredit | null
  receipts: BCPostedReturnReceipt[]
}
```

`retrieveBCReturn` in `lib/data/business-central.ts` needs **no** change. It is already typed
with `BCReturnDetail`.

### New File: `apps/storefront/src/modules/account/components/bc-return-receipts/index.tsx`

```tsx
import { Heading } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import type { BCPostedReturnReceipt } from "@/types/bc-order"

type BcReturnReceiptsProps = {
  receipts: BCPostedReturnReceipt[]
}

const BcReturnReceipts = ({ receipts }: BcReturnReceiptsProps) => {
  const t = useTranslations("Account.bcReturnReceipts")
  // Column and item labels are shared with the return order lines table (NIMBUS-141).
  const tLines = useTranslations("Account.bcReturnLines")
  const locale = useLocale()

  return (
    <div className="flex flex-col gap-y-6" data-testid="bc-return-receipts">
      <Heading level="h2">{t("heading")}</Heading>
      {receipts.map((receipt) => {
        const receivedDate = new Date(receipt.receivedDate)

        return (
          <section
            key={receipt.number}
            className="flex flex-col gap-y-3"
            data-testid="bc-return-receipt"
          >
            <Heading level="h3" data-testid="bc-return-receipt-number">
              {t("receiptNumberHeading", { number: receipt.number })}
            </Heading>
            <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
              <div>
                <dt className="text-ui-fg-subtle">{t("receivedDateLabel")}</dt>
                <dd className="text-ui-fg-base" data-testid="bc-return-receipt-date">
                  {Number.isNaN(receivedDate.getTime())
                    ? "-"
                    : receivedDate.toLocaleDateString(getFormattingLocale(locale))}
                </dd>
              </div>
              {receipt.externalDocumentNumber ? (
                <div>
                  <dt className="text-ui-fg-subtle">{t("externalRefLabel")}</dt>
                  <dd
                    className="text-ui-fg-base"
                    data-testid="bc-return-receipt-external-ref"
                  >
                    {receipt.externalDocumentNumber}
                  </dd>
                </div>
              ) : null}
            </dl>

            {receipt.lines.length === 0 ? (
              <p
                className="text-base-regular text-ui-fg-subtle"
                data-testid="bc-return-receipt-lines-empty"
              >
                {t("emptyLinesMessage")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-small-regular">
                  <thead className="border-b border-ui-border-base text-ui-fg-subtle">
                    <tr>
                      <th className="pb-2 pr-4 font-normal">{tLines("itemColumnLabel")}</th>
                      <th className="pb-2 pr-4 font-normal">{tLines("unitColumnLabel")}</th>
                      <th className="pb-2 pr-4 font-normal">{t("quantityColumnLabel")}</th>
                      <th className="pb-2 font-normal">{tLines("reasonColumnLabel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.lines.map((line) => (
                      <tr
                        key={line.lineNumber}
                        className="border-b border-ui-border-base"
                        data-testid="bc-return-receipt-line"
                      >
                        {/* IMPLEMENT: copy the item <td> from bc-return-lines/index.tsx verbatim
                            (description || itemNumber, then the "Item no. · Variant" sub-line
                            with data-testid="bc-return-line-item-number"), using tLines for its
                            labels. Then add:
                            <td className="py-3 pr-4 text-ui-fg-base">{line.unitOfMeasureCode}</td>
                            <td className="py-3 pr-4 text-ui-fg-base" data-testid="bc-return-receipt-line-quantity">{line.quantity}</td>
                            <td className="py-3 text-ui-fg-base" data-testid="bc-return-receipt-line-reason">{line.returnReasonCode || "-"}</td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default BcReturnReceipts
```

### Edit 2: `apps/storefront/src/modules/account/templates/bc-return-detail-template.tsx`

Replace the whole file with the following:

```tsx
import { Container, Heading } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import BcReturnExpectedCredit from "@/modules/account/components/bc-return-expected-credit"
import BcReturnLines from "@/modules/account/components/bc-return-lines"
import BcReturnReceipts from "@/modules/account/components/bc-return-receipts"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import type { BCReturnDetail } from "@/types/bc-order"

type BcReturnDetailTemplateProps = {
  bcReturn: BCReturnDetail
}

const STATE_BADGE_CLASSES = {
  open: "bg-neutral-100 text-neutral-700",
  processed: "bg-green-100 text-green-800",
} as const

const BcReturnDetailTemplate = ({ bcReturn }: BcReturnDetailTemplateProps) => {
  const t = useTranslations("Account.bcReturnDetailTemplate")
  const tState = useTranslations("Account.bcReturnState")
  const locale = useLocale()
  const documentDate = new Date(bcReturn.documentDate)
  const isOpen = bcReturn.state === "open"
  // Same rule as the list card: the state badge already says "Open".
  const showBCStatus = isOpen && bcReturn.status !== "" && bcReturn.status !== "Open"

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
          {bcReturn.source === "posted_receipt"
            ? t("receiptNumberHeading", { number: bcReturn.number })
            : t("returnNumberHeading", { number: bcReturn.number })}
        </Heading>
        <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
          {isOpen && (
            <div>
              <dt className="text-ui-fg-subtle">{t("requestedDateLabel")}</dt>
              <dd className="text-ui-fg-base" data-testid="bc-return-document-date">
                {Number.isNaN(documentDate.getTime())
                  ? "-"
                  : documentDate.toLocaleDateString(getFormattingLocale(locale))}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-ui-fg-subtle">{t("statusLabel")}</dt>
            <dd className="flex gap-x-2">
              <span
                className={`px-2 text-xs font-medium rounded-full ${STATE_BADGE_CLASSES[bcReturn.state]}`}
                data-testid="bc-return-state"
              >
                {tState(bcReturn.state)}
              </span>
              {showBCStatus && (
                <span
                  className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
                  data-testid="bc-return-status"
                >
                  {bcReturn.status}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Container>

      {isOpen && (
        <Container>
          <BcReturnLines lines={bcReturn.lines} />
        </Container>
      )}

      {isOpen && bcReturn.expectedCredit && (
        <Container>
          <BcReturnExpectedCredit expectedCredit={bcReturn.expectedCredit} />
        </Container>
      )}

      {bcReturn.receipts.length > 0 && (
        <Container>
          <BcReturnReceipts receipts={bcReturn.receipts} />
        </Container>
      )}
    </div>
  )
}

export default BcReturnDetailTemplate
```

The following are unchanged: `returns/[number]/page.tsx`, `not-found.tsx` (the copy changes
only in the catalogs), `bc-return-lines` and `bc-return-expected-credit`.

### Edit 3: translations (8 catalogs)

Run this one-off Node script from `apps/storefront`, the same way as in Task 03. Keep it in the
session scratchpad and do not commit it.

```js
// add-nimbus-172-detail-keys.js — run: node <scratchpad>/add-nimbus-172-detail-keys.js (cwd apps/storefront)
const fs = require("fs")

const STRINGS = {
  en: {
    receiptNumberHeading: "Return receipt #{number}",
    notFound: "This return is unavailable. Check the return number and try again.",
    receipts: { heading: "Receipts", receiptNumberHeading: "Receipt #{number}", receivedDateLabel: "Received on", externalRefLabel: "External ref", quantityColumnLabel: "Quantity", emptyLinesMessage: "This receipt has no item lines." },
  },
  da: {
    receiptNumberHeading: "Returmodtagelse #{number}",
    notFound: "Denne returnering er ikke tilgængelig. Kontrollér returnummeret, og prøv igen.",
    receipts: { heading: "Modtagelser", receiptNumberHeading: "Modtagelse #{number}", receivedDateLabel: "Modtaget den", externalRefLabel: "Ekstern ref.", quantityColumnLabel: "Antal", emptyLinesMessage: "Denne modtagelse har ingen varelinjer." },
  },
  de: {
    receiptNumberHeading: "Rücksendeeingang #{number}",
    notFound: "Diese Rücksendung ist nicht verfügbar. Prüfen Sie die Rücksendenummer und versuchen Sie es erneut.",
    receipts: { heading: "Wareneingänge", receiptNumberHeading: "Wareneingang #{number}", receivedDateLabel: "Eingegangen am", externalRefLabel: "Externe Ref.", quantityColumnLabel: "Menge", emptyLinesMessage: "Dieser Wareneingang enthält keine Artikelpositionen." },
  },
  fr: {
    receiptNumberHeading: "Réception de retour #{number}",
    notFound: "Ce retour n'est pas disponible. Vérifiez le numéro de retour et réessayez.",
    receipts: { heading: "Réceptions", receiptNumberHeading: "Réception #{number}", receivedDateLabel: "Reçu le", externalRefLabel: "Réf. externe", quantityColumnLabel: "Quantité", emptyLinesMessage: "Cette réception ne contient aucune ligne d'article." },
  },
  it: {
    receiptNumberHeading: "Ricevimento reso #{number}",
    notFound: "Questo reso non è disponibile. Controlla il numero del reso e riprova.",
    receipts: { heading: "Ricevimenti", receiptNumberHeading: "Ricevimento #{number}", receivedDateLabel: "Ricevuto il", externalRefLabel: "Rif. esterno", quantityColumnLabel: "Quantità", emptyLinesMessage: "Questo ricevimento non contiene righe articolo." },
  },
  no: {
    receiptNumberHeading: "Returmottak #{number}",
    notFound: "Denne returen er ikke tilgjengelig. Kontroller returnummeret og prøv igjen.",
    receipts: { heading: "Mottak", receiptNumberHeading: "Mottak #{number}", receivedDateLabel: "Mottatt den", externalRefLabel: "Ekstern ref.", quantityColumnLabel: "Antall", emptyLinesMessage: "Dette mottaket har ingen varelinjer." },
  },
  pl: {
    receiptNumberHeading: "Przyjęcie zwrotu #{number}",
    notFound: "Ten zwrot jest niedostępny. Sprawdź numer zwrotu i spróbuj ponownie.",
    receipts: { heading: "Przyjęcia", receiptNumberHeading: "Przyjęcie #{number}", receivedDateLabel: "Data przyjęcia", externalRefLabel: "Ref. zewnętrzna", quantityColumnLabel: "Ilość", emptyLinesMessage: "To przyjęcie nie zawiera pozycji towarowych." },
  },
  sv: {
    receiptNumberHeading: "Returmottagning #{number}",
    notFound: "Den här returen är inte tillgänglig. Kontrollera returnumret och försök igen.",
    receipts: { heading: "Mottagningar", receiptNumberHeading: "Mottagning #{number}", receivedDateLabel: "Mottagen den", externalRefLabel: "Extern ref.", quantityColumnLabel: "Antal", emptyLinesMessage: "Den här mottagningen har inga artikelrader." },
  },
}

for (const [locale, strings] of Object.entries(STRINGS)) {
  const file = `messages/${locale}.json`
  const raw = fs.readFileSync(file, "utf8")
  const eol = raw.includes("\r\n") ? "\r\n" : "\n"
  const catalog = JSON.parse(raw)

  catalog.Account.bcReturnDetailTemplate.receiptNumberHeading = strings.receiptNumberHeading
  catalog.Account.bcReturnNotFound.message = strings.notFound
  catalog.Account.bcReturnReceipts = strings.receipts

  fs.writeFileSync(file, JSON.stringify(catalog, null, 2).replace(/\n/g, eol) + eol, "utf8")
}
```

Afterwards, `git diff apps/storefront/messages` must show, per file:
- 1 added line in `bcReturnDetailTemplate`;
- 1 changed `message` line in `bcReturnNotFound`;
- the new `bcReturnReceipts` block after `bcReturnState`.

## Impacted Files

| File | Change |
|---|---|
| `apps/storefront/src/types/bc-order.ts` | New `BCPostedReturnReceiptLine` and `BCPostedReturnReceipt`. `BCReturnDetail` gets `state`, `source` and `receipts`, and `expectedCredit` becomes nullable. |
| `apps/storefront/src/modules/account/components/bc-return-receipts/index.tsx` | **New.** `BcReturnReceipts({ receipts }: { receipts: BCPostedReturnReceipt[] })`. |
| `apps/storefront/src/modules/account/templates/bc-return-detail-template.tsx` | Heading, state badge, conditional sections and the receipts section. |
| `apps/storefront/messages/{8 locales}.json` | `bcReturnDetailTemplate.receiptNumberHeading`, `bcReturnNotFound.message` and the `bcReturnReceipts` namespace. |
| `apps/storefront/src/__tests__/modules/account/components/bc-return-receipts/index.test.tsx` | **New.** |
| `apps/storefront/src/__tests__/modules/account/templates/bc-return-detail-template.test.tsx` | Fixture fields and new cases. |
| `apps/storefront/src/__tests__/app/bcreturn-detail-page.test.tsx` | Fixture fields and the new not-found copy. |

## Test Cases

**Fixture changes:**
- In `bc-return-detail-template.test.tsx`, add `state: "open"`, `source: "return_order"` and
  `receipts: []` to the `bcReturn` fixture.
- In `bcreturn-detail-page.test.tsx`, add the same three fields to its `bcReturn` fixture.

Use this receipt fixture in the new tests:

```tsx
const receipt: BCPostedReturnReceipt = {
  number: "30700011",
  receivedDate: "2026-09-28",
  externalDocumentNumber: "RET-3f2a9c1b",
  lines: [
    {
      lineNumber: 30000,
      itemNumber: "FVIE-M-BLACK",
      variantCode: "XL",
      description: "Fjeld Vest",
      quantity: 1,
      unitOfMeasureCode: "PCS",
      returnReasonCode: "NORMAL",
    },
  ],
}
```

### TC-1 (receipts component): It renders the receipt header and its lines
- **Given:** `render(<BcReturnReceipts receipts={[receipt]} />)`.
- **When:** it is rendered.
- **Then:**
  - the heading "Receipts" is shown;
  - `bc-return-receipt-number` is "Receipt #30700011";
  - `bc-return-receipt-date` is `new Date("2026-09-28").toLocaleDateString("en-GB")`;
  - `bc-return-receipt-external-ref` is "RET-3f2a9c1b";
  - one `bc-return-receipt-line` is rendered, containing:
    - "Fjeld Vest";
    - "Item no. FVIE-M-BLACK · Variant XL";
    - "PCS";
    - a `bc-return-receipt-line-quantity` of "1";
    - a `bc-return-receipt-line-reason` of "NORMAL";
  - the column headers are "Item", "Unit", "Quantity" and "Reason".

### TC-2 (receipts component): The external ref is hidden when empty, and the empty-lines message is shown
- **Given:** `{ ...receipt, externalDocumentNumber: "", lines: [] }`.
- **When:** it is rendered.
- **Then:**
  - `queryByTestId("bc-return-receipt-external-ref")` is null;
  - `bc-return-receipt-lines-empty` is "This receipt has no item lines.".

### TC-3 (receipts component): Several receipts keep their order, and the external ref is plain text
- **Given:** a second receipt `30700012` with
  `externalDocumentNumber: "<b>AX 209475</b>"`, passed as `[receipt, second]`.
- **When:** it is rendered.
- **Then:**
  - `getAllByTestId("bc-return-receipt-number")` has the texts
    `["Receipt #30700011", "Receipt #30700012"]`;
  - the second external ref `textContent` is `"<b>AX 209475</b>"`;
  - `container.querySelector("b")` is null.

### TC-4 (template): An open return with partial receipts shows the order sections and receipts
- **Given:** `{ ...bcReturn, receipts: [receipt] }`, where `bcReturn` has
  `status: "Pending Approval"` and `state: "open"`.
- **When:** the template is rendered.
- **Then:**
  - "Return #31502910" is shown;
  - `bc-return-document-date` is present;
  - `bc-return-state` is "Open" and `bc-return-status` is "Pending Approval";
  - `bc-return-lines`, `bc-return-expected-credit` and `bc-return-receipts` are all present.

The existing TC-1 keeps passing as it is, because its status is "Pending Approval".

### TC-5 (template): A processed return order shows only the receipts
- **Given:**
  `{ ...bcReturn, id: "return-order:31502910", status: "", state: "processed", source: "return_order", lines: [], expectedCredit: null, documentDate: "2026-09-28", receipts: [receipt] }`.
- **When:** the template is rendered.
- **Then:**
  - "Return #31502910" is shown;
  - `bc-return-state` is "Processed";
  - `queryByTestId("bc-return-status")` is null;
  - `queryByTestId("bc-return-document-date")` is null;
  - `queryByTestId("bc-return-lines")` and `queryByTestId("bc-return-expected-credit")` are null;
  - `bc-return-receipts` is present.

### TC-6 (template): A stand-alone receipt uses the receipt heading
- **Given:** the TC-5 object, with `source: "posted_receipt"`, `number: "30700003"` and
  `id: "posted-receipt:30700003"`.
- **When:** the template is rendered.
- **Then:** "Return receipt #30700003" is shown, and "Return #30700003" is not.

### TC-7 (template): An open return whose BC status is "Open" shows only the state badge
- **Given:** `{ ...bcReturn, status: "Open" }`.
- **When:** the template is rendered.
- **Then:**
  - `bc-return-state` is "Open";
  - `queryByTestId("bc-return-status")` is null;
  - `queryByTestId("bc-return-receipts")` is null, because `receipts` is empty.

### TC-8 (detail page): A processed return is rendered through the page
- **Given:** `retrieveBCReturn` resolves to the TC-5 object.
- **When:** `BCReturnDetailPage({ params: Promise.resolve({ number: "31502910" }) })` is
  rendered.
- **Then:** `bc-return-detail` and `bc-return-receipts` are present, and `notFound` is not
  called.

### TC-9 (not-found page): The not-found page uses the new neutral copy
Update the existing TC-4.
- **Given:** `BcReturnNotFound()`.
- **When:** it is rendered.
- **Then:**
  - it shows "This return is unavailable. Check the return number and try again.";
  - it no longer says "fully processed";
  - the "Back to returns" link is unchanged.

### TC-10: The catalogs stay in parity
- **Given:** all 8 catalogs after the script.
- **When:** `message-catalogs.test.ts` runs.
- **Then:** it passes.

## Implementation Steps

1. Make Edit 1 (types). Only the template and the page use `BCReturnDetail`.
2. Create `bc-return-receipts/index.tsx`, filling in the `// IMPLEMENT` cells from
   `bc-return-lines`.
3. Make Edit 2: replace the template file.
4. Make Edit 3: run the translation script and check the diff.
5. Update and add the tests (TC-1..TC-9).
6. Run `cd apps/storefront && pnpm test`. All tests must pass, including the Task 03 tests and
   catalog parity.
7. Run `cd apps/storefront && pnpm build` and `pnpm lint` from the root.
8. **Sandbox walkthrough (TestDK).** The implementor does this manually and records the result
   in PROGRESS.md:
   - `/account/returns` lists open and processed returns together, newest activity first.
   - The Open/Processed filter works.
   - A partly received open return shows its receipts under it.
   - A processed return opens its detail with its receipts and items.
   - A stand-alone receipt (empty `Return_Order_No`) opens by its receipt number.
   - "External ref" shows `AX ...` or `RET-...` values as text and is hidden when empty.
   - A foreign or unknown number shows "Return not found".
   - Confirm that BC accepts the `Document_No eq 'a' or Document_No eq 'b'` filter on
     `PostedReturnReceiptReturnRcptLines`. If it rejects the filter, stop and report: see the
     risk in PLAN.md.
9. Update this file's **Status** to DONE, and `manifest.md`.
