# Task 03: Storefront — combined return list with state badge, filter and grouped receipts — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 03
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-172 (from develop)
**Depends on:** Task 01 (the backend list response shape and the `state` query param)

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `cd apps/storefront && pnpm build` (or `pnpm build` from the root)
- **Lint command:** `pnpm lint` (from the repo root)
- **Test command:** `cd apps/storefront && pnpm test`. You can also run one file, for example
  `pnpm test -- bc-return-card`.
- **Test framework:** Jest, React Testing Library and `jest-environment-jsdom`.
  - `__mocks__/next-intl.tsx` auto-mocks `next-intl` and `next-intl/server` against
    `messages/en.json`, with simple `{name}` substitution and no ICU plurals.
  - `src/__tests__/lib/i18n/message-catalogs.test.ts` enforces that all 8 locale catalogs have
    the same keys.
- **Test location:** `apps/storefront/src/__tests__/`, which mirrors `src/`.
- **Conventions:**
  - Storefront TypeScript uses double quotes and **no semicolons**.
  - Components live in `src/modules/account/components/<kebab-name>/index.tsx`.
  - Async server components use `getTranslations`; client components use `useTranslations`.
  - Custom routes are called through `sdk.client.fetch` in `src/lib/data/business-central.ts`
    (building-storefronts skill). Do not use plain `fetch`.
- **Locales (8):** `en, da, de, fr, it, no, pl, sv` in `apps/storefront/messages/*.json`.

## Solution Design

- **Types:** the storefront `BCReturnListItem` mirrors the Task 01 backend type
  (`state`, `source`, `receipts`). `BCReturnListParams.status` is replaced by `state`.
- **Data layer:** `listBCReturns` forwards `state` instead of `status`.
- **Filters:**
  - The "Status" select now offers All / Open / Processed, with the values `""`, `open` and
    `processed`, and writes `?state=`.
  - The old BC status options (`Open`/`Released`) are removed, because the backend no longer
    accepts `status`.
  - The date and search inputs are unchanged.
- **Page:** it reads `state` from `searchParams`. A value other than `open` or `processed` is
  dropped at this trust boundary, so the list does not go to its error state because of a
  backend 400.
- **Card:**
  - It gets a translated **state badge** (Open / Processed).
  - For open rows, the raw BC status pill (NIMBUS-140 behaviour) is shown **only when it adds
    information**, that is, when it is not `"Open"` (for example "Released" or
    "Pending Approval").
  - For `source: "return_order"`, the posted receipts are listed under the row:
    "Receipt #n · Received <date> · External ref <text>", where the external ref is hidden
    when it is empty.
  - For a stand-alone receipt row (`source: "posted_receipt"`), the row number is already the
    receipt number, so only its external ref is shown, when it is not empty.
  - The external ref is rendered as plain React text in its own element. Never inject it as
    HTML and never use it as a link or a number.
  - The details link stays `/account/returns/${encodeURIComponent(item.number)}` for every row.
    Task 02 resolves return order and receipt numbers.
- **Overview:** no change. It keys on `item.id`, which stays unique thanks to the Task 01 id
  prefixes.
- **Translations:**
  - a new namespace `Account.bcReturnState` (`open`, `processed`), added as the **last** key
    of `Account`;
  - three keys appended to `Account.bcReturnCard`.
  - Task 04 adds its keys after these.

## Code Skeletons

### Edit 1: `apps/storefront/src/types/bc-order.ts`

Insert these lines directly **before** `export type BCReturnListItem = {`:

```typescript
export type BCReturnState = "open" | "processed"

export type BCReturnSource = "return_order" | "posted_receipt"

export type BCPostedReturnReceiptSummary = {
  number: string
  receivedDate: string
  externalDocumentNumber: string
}
```

Replace `BCReturnListItem` and `BCReturnListParams` with the following:

```typescript
export type BCReturnListItem = {
  id: string
  number: string
  documentDate: string
  status: string
  state: BCReturnState
  source: BCReturnSource
  itemCount: number
  receipts: BCPostedReturnReceiptSummary[]
}

export type BCReturnListParams = {
  limit?: number
  offset?: number
  state?: BCReturnState
  date_from?: string
  date_to?: string
  search?: string
}
```

### Edit 2: `apps/storefront/src/lib/data/business-central.ts`

In `listBCReturns`, replace the line
`...(params.status ? { status: params.status } : {}),` with the following:

```typescript
      ...(params.state ? { state: params.state } : {}),
```

### Edit 3: `apps/storefront/src/modules/account/components/bc-return-filters/index.tsx`

1. Replace the two constants and their comments (`// Only statuses whose BC wire value...`,
   `BC_RETURN_STATUSES`, `// Visible labels only...`, `STATUS_LABEL_KEYS`) with the following:

```tsx
const BC_RETURN_STATES = ["open", "processed"] as const
```

2. Change the props type and destructuring from `currentStatus` to
   `currentState?: BCReturnState`. Add this import:
   `import type { BCReturnState } from "@/types/bc-order"`.
3. Replace `const tStatus = useTranslations("Account.bcStatus")` with
   `const tState = useTranslations("Account.bcReturnState")`.
4. Change the `<select>` as follows. The `id`, the label and the classes stay the same.

```tsx
        <select
          id="bc-return-status-filter"
          className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={currentState ?? ""}
          onChange={(e) => pushParams({ state: e.target.value || undefined })}
        >
          <option value="">{t("allStatusesOption")}</option>
          {BC_RETURN_STATES.map((s) => (
            <option key={s} value={s}>
              {tState(s)}
            </option>
          ))}
        </select>
```

Leave everything else in the file unchanged.

### Edit 4: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/page.tsx`

- In the `searchParams` type, replace `status?: string` with `state?: string`.
- Replace `const { status, date_from, date_to, search } = params` with the following:

```tsx
  const { date_from, date_to, search } = params
  // Only the two supported states reach the backend; anything else means "all".
  const state =
    params.state === "open" || params.state === "processed" ? params.state : undefined
```

- In the `listBCReturns({...})` call, replace `status,` with `state,`.
- On `<BcReturnFilters>`, replace `currentStatus={status}` with `currentState={state}`.

### Edit 5: `apps/storefront/src/modules/account/components/bc-return-card/index.tsx`

Replace the whole file with the following:

```tsx
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCReturnListItem } from "@/types/bc-order"
import { Container } from "@medusajs/ui"
import { getLocale, getTranslations } from "next-intl/server"

type BcReturnCardProps = {
  item: BCReturnListItem
}

const STATE_BADGE_CLASSES = {
  open: "bg-neutral-100 text-neutral-700",
  processed: "bg-green-100 text-green-800",
} as const

const formatBCDate = (value: string, locale: string) => {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(getFormattingLocale(locale), {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
}

const BcReturnCard = async ({ item }: BcReturnCardProps) => {
  const t = await getTranslations("Account.bcReturnCard")
  const tState = await getTranslations("Account.bcReturnState")
  const locale = await getLocale()
  // The state badge already says "Open"; the raw BC status is only added when it says more.
  const showBCStatus =
    item.state === "open" && item.status !== "" && item.status !== "Open"
  const standaloneReceipt =
    item.source === "posted_receipt" ? item.receipts[0] : undefined
  const groupedReceipts = item.source === "return_order" ? item.receipts : []

  return (
    <Container className="bg-white flex flex-col p-4 rounded-md gap-y-3">
      <div className="flex small:flex-row flex-col small:justify-between small:items-center gap-y-2 items-start">
        <div className="flex gap-x-4 items-center pl-3">
          <div className="flex pr-2 text-small-regular items-center">
            <CalendarIcon className="inline-block mr-1" />
            <span data-testid="bc-return-date">
              {formatBCDate(item.documentDate, locale)}
            </span>
          </div>

          <div className="flex items-center text-small-regular">
            <DocumentIcon className="inline-block mr-1" />
            <span data-testid="bc-return-number">#{item.number}</span>
          </div>
        </div>

        <div className="flex gap-x-4 small:divide-x divide-gray-200 small:justify-normal justify-between w-full small:w-auto">
          <div className="flex items-center gap-x-2 text-small-regular text-ui-fg-base">
            <span
              className={`px-2 text-xs font-medium rounded-full ${STATE_BADGE_CLASSES[item.state]}`}
              data-testid="bc-return-state"
            >
              {tState(item.state)}
            </span>
            {showBCStatus && (
              <span
                className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
                data-testid="bc-return-status"
              >
                {item.status}
              </span>
            )}
          </div>

          <div className="flex items-center pl-4">
            <span
              className="text-small-regular text-ui-fg-base"
              data-testid="bc-return-item-count"
            >
              {t("itemCountLabel", { count: item.itemCount })}
            </span>
          </div>

          <LocalizedClientLink
            href={`/account/returns/${encodeURIComponent(item.number)}`}
            className="flex items-center pl-4 text-small-regular text-ui-fg-base underline"
            data-testid="bc-return-details-link"
          >
            {t("detailsLabel")}
          </LocalizedClientLink>
        </div>
      </div>

      {standaloneReceipt?.externalDocumentNumber ? (
        <p className="pl-3 text-small-regular text-ui-fg-subtle">
          {t("externalRefLabel")}{" "}
          <span data-testid="bc-return-external-ref">
            {standaloneReceipt.externalDocumentNumber}
          </span>
        </p>
      ) : null}

      {groupedReceipts.length > 0 && (
        <ul
          className="pl-3 flex flex-col gap-y-1 text-small-regular text-ui-fg-subtle"
          data-testid="bc-return-receipts"
        >
          {groupedReceipts.map((receipt) => (
            <li key={receipt.number} data-testid="bc-return-receipt">
              <span data-testid="bc-return-receipt-number">
                {t("receiptLabel")} #{receipt.number}
              </span>
              <span>
                {" · "}
                {t("receivedLabel")}{" "}
                <span data-testid="bc-return-receipt-date">
                  {formatBCDate(receipt.receivedDate, locale)}
                </span>
              </span>
              {receipt.externalDocumentNumber ? (
                <span>
                  {" · "}
                  {t("externalRefLabel")}{" "}
                  <span data-testid="bc-return-receipt-external-ref">
                    {receipt.externalDocumentNumber}
                  </span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}

export default BcReturnCard
```

`formatBCDate` keeps the existing date behaviour: an invalid or empty date becomes `"-"`.

### Edit 6: translations (8 catalogs)

Use this one-off Node script so that the key order and formatting stay deterministic. Save it
in the session scratchpad, **not** in the repo, and run it from `apps/storefront`. It keeps
each file's line endings (the catalogs are CRLF in this Windows checkout) and its canonical
2-space JSON formatting. That formatting was verified: `JSON.stringify(parsed, null, 2)`
reproduces every catalog byte for byte after EOL normalisation.

```js
// add-nimbus-172-list-keys.js — run: node <scratchpad>/add-nimbus-172-list-keys.js (cwd apps/storefront)
const fs = require("fs")

const STRINGS = {
  en: { state: { open: "Open", processed: "Processed" }, card: { receiptLabel: "Receipt", receivedLabel: "Received", externalRefLabel: "External ref" } },
  da: { state: { open: "Åben", processed: "Behandlet" }, card: { receiptLabel: "Modtagelse", receivedLabel: "Modtaget", externalRefLabel: "Ekstern ref." } },
  de: { state: { open: "Offen", processed: "Bearbeitet" }, card: { receiptLabel: "Wareneingang", receivedLabel: "Eingegangen", externalRefLabel: "Externe Ref." } },
  fr: { state: { open: "Ouvert", processed: "Traité" }, card: { receiptLabel: "Réception", receivedLabel: "Reçu", externalRefLabel: "Réf. externe" } },
  it: { state: { open: "Aperto", processed: "Elaborato" }, card: { receiptLabel: "Ricevimento", receivedLabel: "Ricevuto", externalRefLabel: "Rif. esterno" } },
  no: { state: { open: "Åpen", processed: "Behandlet" }, card: { receiptLabel: "Mottak", receivedLabel: "Mottatt", externalRefLabel: "Ekstern ref." } },
  pl: { state: { open: "Otwarte", processed: "Przetworzone" }, card: { receiptLabel: "Przyjęcie", receivedLabel: "Przyjęto", externalRefLabel: "Ref. zewnętrzna" } },
  sv: { state: { open: "Öppen", processed: "Behandlad" }, card: { receiptLabel: "Mottagning", receivedLabel: "Mottagen", externalRefLabel: "Extern ref." } },
}

for (const [locale, strings] of Object.entries(STRINGS)) {
  const file = `messages/${locale}.json`
  const raw = fs.readFileSync(file, "utf8")
  const eol = raw.includes("\r\n") ? "\r\n" : "\n"
  const catalog = JSON.parse(raw)

  Object.assign(catalog.Account.bcReturnCard, strings.card)
  catalog.Account.bcReturnState = strings.state

  fs.writeFileSync(file, JSON.stringify(catalog, null, 2).replace(/\n/g, eol) + eol, "utf8")
}
```

After running it, `git diff --stat apps/storefront/messages` must show only added lines,
3 + 4 per file. If whole files show as changed, the EOL handling went wrong. Restore the file
with `git checkout -- <file>` and fix the script. Do **not** commit the script.

## Impacted Files

| File | Change |
|---|---|
| `apps/storefront/src/types/bc-order.ts` | New `BCReturnState`, `BCReturnSource` and `BCPostedReturnReceiptSummary`. `BCReturnListItem` is extended. `BCReturnListParams.status` becomes `state`. |
| `apps/storefront/src/lib/data/business-central.ts` | `listBCReturns(params: BCReturnListParams = {}): Promise<BCReturnListResponse>` forwards `state`. |
| `apps/storefront/src/modules/account/components/bc-return-filters/index.tsx` | Open/processed options; prop `currentState?: BCReturnState`; writes `?state=`. |
| `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/page.tsx` | Reads and validates `state`. |
| `apps/storefront/src/modules/account/components/bc-return-card/index.tsx` | State badge, conditional BC status, receipts and external ref. |
| `apps/storefront/messages/{en,da,de,fr,it,no,pl,sv}.json` | `Account.bcReturnCard.{receiptLabel,receivedLabel,externalRefLabel}` and `Account.bcReturnState.{open,processed}`. |
| Tests | See below. |

## Test Cases

Update or add these files:
- `src/__tests__/lib/data/business-central.test.ts`;
- `src/__tests__/modules/account/components/bc-return-filters/index.test.tsx`;
- `src/__tests__/modules/account/components/bc-return-card/index.test.tsx`;
- `src/__tests__/app/bcreturns-page.test.tsx`.

In the card test, extend the shared `item` fixture to:

```tsx
const item = {
  id: "ro-guid-1",
  number: "RET-1",
  documentDate: "2026-01-01T00:00:00.000Z",
  status: "Open",
  state: "open",
  source: "return_order",
  itemCount: 2,
  receipts: [],
} as BCReturnListItem
```

Replace the old `as any` with `as BCReturnListItem`, imported from `@/types/bc-order`. In the
existing "links ... not the internal id" test, change the `not.toHaveAttribute` value to
`"/account/returns/ro-guid-1"`.

### TC-1 (data layer): The `state` filter is forwarded
Update the existing TC-3.
- **Given:** `listBCReturns({ state: "processed", date_from: "2026-01-01", date_to: "2026-12-31", search: "RET-1" })`.
- **When:** it is called.
- **Then:**
  - `sdk.client.fetch` is called with
    `query: { limit: 20, offset: 0, state: "processed", date_from: "2026-01-01", date_to: "2026-12-31", search: "RET-1" }`;
  - there is no `status` key.

Rename the existing TC-2 title to "omits state, date_from, date_to and search ...". Its
assertion is unchanged.

### TC-2 (filters): The select offers All, Open and Processed
Replace the two existing status tests.
- **Given:** `render(<BcReturnFilters />)`.
- **When:** the "Status" select is inspected.
- **Then:**
  - its option values are `["", "open", "processed"]`;
  - the option with the name "Open" has `value="open"`, and the option with the name
    "Processed" has `value="processed"`.

### TC-3 (filters): Choosing a state pushes `?state=` and resets the page
- **Given:**
  - declare `const mockPush = jest.fn()` at module scope;
  - the `next/navigation` mock has `useRouter: jest.fn(() => ({ push: mockPush }))` and
    `useSearchParams: jest.fn(() => new URLSearchParams("page=3"))`. Override
    `useSearchParams` only in this test, with `mockReturnValueOnce` or a separate `describe`.
- **When:** `fireEvent.change(screen.getByLabelText("Status"), { target: { value: "processed" } })`.
- **Then:** `mockPush` is called with `"/account/returns?state=processed"` and
  `{ scroll: false }`.

### TC-4 (filters): The current state is preselected
- **Given:** `render(<BcReturnFilters currentState="open" />)`.
- **When:** the select is inspected.
- **Then:** `(screen.getByLabelText("Status") as HTMLSelectElement).value` is `"open"`.

### TC-5 (card): An open return order shows the "Open" state badge and hides a redundant "Open" BC status
Update the existing TC-3.
- **Given:** the `item` fixture, with `status: "Open"`.
- **When:** the card is rendered.
- **Then:**
  - `bc-return-state` has the text "Open";
  - `queryByTestId("bc-return-status")` is null;
  - the number, date and "Items: 2" are rendered as before.

### TC-6 (card): An open return order keeps an informative BC status
- **Given:** `{ ...item, status: "Released" }`.
- **When:** the card is rendered.
- **Then:** `bc-return-state` is "Open" and `bc-return-status` is "Released".

### TC-7 (card): A processed return order shows the "Processed" badge and its grouped receipts
- **Given:**
  `{ ...item, id: "return-order:31400001", number: "31400001", status: "", state: "processed", source: "return_order", itemCount: 1, receipts: [{ number: "30700005", receivedDate: "2026-08-10", externalDocumentNumber: "" }, { number: "30700007", receivedDate: "2026-08-15", externalDocumentNumber: "AX 209475" }] }`.
- **When:** the card is rendered.
- **Then:**
  - `bc-return-state` is "Processed" and `bc-return-status` is absent;
  - `getAllByTestId("bc-return-receipt")` has length 2;
  - the receipt numbers are "Receipt #30700005" and "Receipt #30700007";
  - `getAllByTestId("bc-return-receipt-date")[0]` is not empty;
  - `getAllByTestId("bc-return-receipt-external-ref")` has length 1, with the text
    "AX 209475". The external ref is hidden for the empty one;
  - the details link contains `/account/returns/31400001`.

### TC-8 (card): Receipts are listed under an open return order that is partly received
- **Given:**
  `{ ...item, receipts: [{ number: "30700010", receivedDate: "2026-09-25", externalDocumentNumber: "RET-3f2a9c1b" }] }`.
- **When:** the card is rendered.
- **Then:**
  - `bc-return-state` is "Open";
  - one `bc-return-receipt` is rendered, with the external ref "RET-3f2a9c1b";
  - `bc-return-number` is still "#RET-1". The external ref is never used as the number.

### TC-9 (card): A stand-alone receipt row shows its external ref inline and no receipts list
- **Given:**
  `{ ...item, id: "posted-receipt:30700003", number: "30700003", status: "", state: "processed", source: "posted_receipt", itemCount: 1, receipts: [{ number: "30700003", receivedDate: "2026-09-28", externalDocumentNumber: "AX 209475" }] }`.
- **When:** the card is rendered.
- **Then:**
  - `bc-return-external-ref` is "AX 209475";
  - `queryByTestId("bc-return-receipts")` is null;
  - the details link contains `/account/returns/30700003`.

### TC-10 (card): The external ref is rendered as plain text
- **Given:** a stand-alone receipt whose `externalDocumentNumber` is
  `"<img src=x onerror=alert(1)>"`.
- **When:** the card is rendered.
- **Then:**
  - `bc-return-external-ref` has that exact `textContent`;
  - `container.querySelector("img")` is null.

### TC-11 (page): A valid state is forwarded, and an invalid one is dropped
- **Given:** the existing page test mocks.
- **When:** `Returns({ searchParams: Promise.resolve({ state: "processed" }) })` is called, and
  then `Returns({ searchParams: Promise.resolve({ state: "Released" }) })`.
- **Then:**
  - `listBCReturns` is called first with `expect.objectContaining({ state: "processed" })`;
  - then with `expect.objectContaining({ state: undefined })`.

### TC-12: The catalogs stay in parity
- **Given:** all 8 catalogs after the script.
- **When:** `message-catalogs.test.ts` runs.
- **Then:** it passes.

## Implementation Steps

1. Make Edits 1 and 2: the types and the data layer.
2. Make Edit 3 (filters) and Edit 4 (page).
3. Make Edit 5: replace the card file.
4. Make Edit 6: run the translation script from `apps/storefront`, and check `git diff --stat`.
5. Update and add the tests (TC-1..TC-11).
6. Run `cd apps/storefront && pnpm test`. Everything must pass, including
   `message-catalogs.test.ts`. The detail-page tests are untouched by this task and must still
   pass.
7. Run `cd apps/storefront && pnpm build` and `pnpm lint` from the root. `BCReturnDetail` is not
   changed here, so the detail page compiles unchanged.
8. Update this file's **Status** to DONE, and `manifest.md`.
