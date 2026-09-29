# Task 05: Return detail page route and link from the return confirmation — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 05
**Date:** 2026-09-29
**Branch:** feature/NIMBUS-141 (from develop)
**Depends on:** Task 04; NIMBUS-140 Task 05 (merged to develop)

> NIMBUS-140 Task 05 adds `/account/returns` (the overview) and the "Returns" nav entry. This
> task adds the `[number]` child route beneath it. NIMBUS-140 explicitly left it out.
> **Do not touch** the `TEMP (NIMBUS-138)` lines in `bc-order-return/index.tsx`, which are the
> hard-coded `"NORMAL"` reason, or any other part of that component apart from the
> confirmation block below. This task edits **no** JSON files, because Task 04 already added
> every key it uses.

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library
- **Test location:** `apps/storefront/src/__tests__/app/bcreturn-detail-page.test.tsx` (new file), and `apps/storefront/src/__tests__/modules/account/components/bc-order-return/index.test.tsx` (extend)
- **Naming conventions:** double quotes, no semicolons. `bc-order-return/index.tsx` and its test
  use **CRLF** line endings; keep them CRLF.

## Solution Design

### Page `/account/returns/[number]`

This mirrors `bcorders/[id]` (`page.tsx`, `loading.tsx`, `not-found.tsx`) with one deliberate
fix:

- The **`notFound()` call sits outside the `try/catch`**. `notFound()` works by throwing, so in
  the existing `bcorders/[id]/page.tsx` it is called inside the `try` and swallowed by the
  `catch`. A missing order therefore shows "Something went wrong" instead of the not-found page.
  This task does not change the order page; see PLAN.md, "Observations".
- **Flow:**
  - `retrieveBCReturn(number)` (Task 03) throws on a BC or network failure. The page then renders
    a friendly error state (`data-testid="bc-return-detail-error"`) and the account area keeps
    working.
  - When it returns `null` (the backend's 404 for foreign, unknown or processed returns),
    `notFound()` renders `not-found.tsx`, which does not disclose whether the return exists.
  - Otherwise the page renders `BcReturnDetailTemplate` (Task 04).
- `loading.tsx` is the same spinner as `bcorders/[id]/loading.tsx`.

### Link from NIMBUS-138's "return created" confirmation

NIMBUS-138's `BcOrderReturn` (`src/modules/account/components/bc-order-return/index.tsx`) renders
the confirmation block when `result` is set. Add a `LocalizedClientLink` to
`/account/returns/${encodeURIComponent(result.number)}`, labelled with
`Account.bcOrderReturn.viewReturnLabel` ("View return"), next to the existing "Back to order
details" button. `result.number` is the BC return order number that the create response
already returns, the same number the new page loads. There is no link from the order detail
page (Q8).

## Code Skeletons

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/[number]/page.tsx`

```tsx
import { retrieveBCReturn } from "@/lib/data/business-central"
import BcReturnDetailTemplate from "@/modules/account/templates/bc-return-detail-template"
import type { BCReturnDetail } from "@/types/bc-order"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ number: string }>
}

export default async function BCReturnDetailPage({ params }: Props) {
  const { number } = await params
  let bcReturn: BCReturnDetail | null

  try {
    bcReturn = await retrieveBCReturn(number)
  } catch {
    const t = await getTranslations("Account.bcReturnDetailPage")

    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-return-detail-error"
      >
        <h1 className="text-large-semi">{t("errorHeading")}</h1>
        <p className="text-base-regular text-neutral-500">{t("errorMessage")}</p>
      </div>
    )
  }

  // notFound() throws, so it must stay outside the try/catch above.
  if (!bcReturn) {
    notFound()
  }

  return <BcReturnDetailTemplate bcReturn={bcReturn} />
}
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/[number]/loading.tsx`

```tsx
import Spinner from "@/modules/common/icons/spinner"

export default function Loading() {
  return (
    <div className="flex items-center justify-center w-full h-full text-ui-fg-base">
      <Spinner size={36} />
    </div>
  )
}
```

### New File: `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/returns/[number]/not-found.tsx`

```tsx
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getTranslations } from "next-intl/server"

export default async function NotFound() {
  // Reuses the "Back to returns" label of the detail template.
  const tBcReturnDetailTemplate = await getTranslations(
    "Account.bcReturnDetailTemplate"
  )
  const t = await getTranslations("Account.bcReturnNotFound")

  return (
    <div
      className="w-full flex flex-col items-center gap-y-4 py-8"
      data-testid="bc-return-detail-not-found"
    >
      <h1 className="text-large-semi">{t("headingLabel")}</h1>
      <p className="text-base-regular text-neutral-500">{t("message")}</p>
      <LocalizedClientLink
        href="/account/returns"
        className="text-small-regular text-ui-fg-base underline"
      >
        {tBcReturnDetailTemplate("backToReturnsLabel")}
      </LocalizedClientLink>
    </div>
  )
}
```

### New File: `apps/storefront/src/__tests__/app/bcreturn-detail-page.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  retrieveBCReturn: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import { retrieveBCReturn } from "@/lib/data/business-central"
import { notFound } from "next/navigation"
import BCReturnDetailPage from "@/app/[countryCode]/(main)/account/@dashboard/returns/[number]/page"
import BcReturnNotFound from "@/app/[countryCode]/(main)/account/@dashboard/returns/[number]/not-found"

const bcReturn = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Open",
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
}

describe("BCReturnDetailPage", () => {
  // TC-1: happy path — the return is loaded by the route param and rendered.
  it("renders the return detail template for the requested number", async () => {
    ;(retrieveBCReturn as jest.Mock).mockResolvedValueOnce(bcReturn)

    const element = await BCReturnDetailPage({
      params: Promise.resolve({ number: "31502910" }),
    })
    render(element)

    expect(retrieveBCReturn).toHaveBeenCalledWith("31502910")
    expect(screen.getByTestId("bc-return-detail")).toBeInTheDocument()
    expect(screen.getByText("Return #31502910")).toBeInTheDocument()
  })

  // TC-2: security — foreign/unknown/processed (backend 404 → null) triggers notFound().
  it("calls notFound when the return is not available", async () => {
    ;(retrieveBCReturn as jest.Mock).mockResolvedValueOnce(null)

    await expect(
      BCReturnDetailPage({ params: Promise.resolve({ number: "31502999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  // TC-3: error condition — BC unavailable shows a friendly error state, not a crash.
  it("renders the error state when loading the return fails", async () => {
    ;(retrieveBCReturn as jest.Mock).mockRejectedValueOnce(new Error("boom"))

    const element = await BCReturnDetailPage({
      params: Promise.resolve({ number: "31502910" }),
    })
    render(element)

    expect(screen.getByTestId("bc-return-detail-error")).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText("We were unable to load this return. Please try again.")
    ).toBeInTheDocument()
    expect(notFound).not.toHaveBeenCalled()
  })
})

describe("BcReturnNotFound", () => {
  // TC-4: the not-found page is customer-safe and links back to the overview.
  it("renders a non-disclosing message with a link back to the returns overview", async () => {
    const element = await BcReturnNotFound()
    render(element)

    expect(screen.getByText("Return not found")).toBeInTheDocument()
    expect(
      screen.getByText(
        "This return is unavailable. Returns that have been fully processed are no longer shown here."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Back to returns")).toHaveAttribute(
      "href",
      "/dk/account/returns"
    )
  })
})
```

## Impacted Files

### `apps/storefront/src/modules/account/components/bc-order-return/index.tsx` (edit, CRLF)

**Edit 1: import.** Insert directly after the line
`import BcOrderLineFulfillment from "@/modules/account/components/bc-order-line-fulfillment"`:

```tsx
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
```

**Edit 2: the confirmation block.**

Old:
```tsx
        <Text>
          {t("returnCreatedMessage", {
            number: result.number,
            status: result.status,
          })}
        </Text>
        <div>
          <Button type="button" onClick={closeReturnFlow}>
            {t("backToOrderDetailsLabel")}
          </Button>
        </div>
```

New:
```tsx
        <Text>
          {t("returnCreatedMessage", {
            number: result.number,
            status: result.status,
          })}
        </Text>
        <div className="flex items-center gap-x-4">
          <LocalizedClientLink
            href={`/account/returns/${encodeURIComponent(result.number)}`}
            className="text-small-regular text-ui-fg-base underline"
            data-testid="bc-order-return-view-return-link"
          >
            {t("viewReturnLabel")}
          </LocalizedClientLink>
          <Button type="button" onClick={closeReturnFlow}>
            {t("backToOrderDetailsLabel")}
          </Button>
        </div>
```

### `apps/storefront/src/__tests__/modules/account/components/bc-order-return/index.test.tsx` (edit, CRLF)

**Edit 1: mocks and imports.** `LocalizedClientLink` calls `useParams`, so the file needs a
`next/navigation` mock.

Old:
```tsx
import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  createBCReturn: jest.fn(),
}))

import BcOrderReturn from "@/modules/account/components/bc-order-return"
```

New:
```tsx
import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("@/lib/data/business-central", () => ({
  createBCReturn: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "dk" })),
}))

import { createBCReturn } from "@/lib/data/business-central"
import BcOrderReturn from "@/modules/account/components/bc-order-return"
```

**Edit 2: two new tests.** Append them inside the `describe("BcOrderReturn", ...)` block, after
the last existing test (`"hides the return trigger when nothing has shipped"`) and before the
closing `})` of the block:

```tsx
  // TC-5: integration — the return confirmation links to the new return's detail page.
  it("links the return confirmation to the new return's detail page", async () => {
    ;(createBCReturn as jest.Mock).mockResolvedValueOnce({
      id: "31502913",
      number: "31502913",
      status: "Open",
      requestId: "RET-1",
      sourceOrderNo: "BC-1",
      lines: [],
    })

    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    fireEvent.click(screen.getByText("Request a return"))
    const [shippedInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(shippedInput, { target: { value: "1" } })
    const form = screen.getByText("Submit return request").closest("form") as HTMLFormElement
    fireEvent.submit(form)

    const link = await screen.findByTestId("bc-order-return-view-return-link")
    expect(link).toHaveTextContent("View return")
    expect(link).toHaveAttribute("href", "/dk/account/returns/31502913")
    expect(screen.getByText("Back to order details")).toBeInTheDocument()
  })

  // TC-6: edge case — the return number is URL-encoded in the link.
  it("URL-encodes the return number in the confirmation link", async () => {
    ;(createBCReturn as jest.Mock).mockResolvedValueOnce({
      id: "RO/1",
      number: "RO/1",
      status: "Open",
      requestId: "RET-2",
      sourceOrderNo: "BC-1",
      lines: [],
    })

    render(
      <BcOrderReturn order={order} reasons={[]}>
        <div>children</div>
      </BcOrderReturn>
    )

    fireEvent.click(screen.getByText("Request a return"))
    const [shippedInput] = screen.getAllByRole("spinbutton")
    fireEvent.change(shippedInput, { target: { value: "1" } })
    const form = screen.getByText("Submit return request").closest("form") as HTMLFormElement
    fireEvent.submit(form)

    const link = await screen.findByTestId("bc-order-return-view-return-link")
    expect(link).toHaveAttribute("href", "/dk/account/returns/RO%2F1")
  })
```

## Test Cases

### TC-1: Page, happy path
- **Given:** `retrieveBCReturn` resolves a return.
- **When:** the page runs with `{ number: "31502910" }`.
- **Then:** `retrieveBCReturn` is called with `"31502910"` and the detail template renders "Return #31502910".

### TC-2: Page, security (non-disclosing 404)
- **Given:** `retrieveBCReturn` resolves `null`.
- **When:** the page runs.
- **Then:** `notFound()` is called once, outside the `try/catch`, so the thrown `NEXT_NOT_FOUND` propagates instead of being turned into the error state.

### TC-3: Page, BC unavailable
- **Given:** `retrieveBCReturn` rejects.
- **When:** the page runs.
- **Then:** the error state shows "Something went wrong" and "We were unable to load this return. Please try again.", and `notFound()` is not called.

### TC-4: Not-found page
- **Given:** the `not-found.tsx` component.
- **When:** it renders.
- **Then:** it shows "Return not found" and the generic message, with "Back to returns" linking to `/dk/account/returns`.

### TC-5: Confirmation link, integration
- **Given:** the return form was submitted and `createBCReturn` resolves number `31502913`.
- **When:** the confirmation renders.
- **Then:** "View return" links to `/dk/account/returns/31502913`, and "Back to order details" is still shown.

### TC-6: Confirmation link, encoding
- **Given:** `createBCReturn` resolves number `RO/1`.
- **When:** the confirmation renders.
- **Then:** the link is `/dk/account/returns/RO%2F1`.

### TC-7: Manual sandbox walkthrough (TestDK, B2B customer with a BC customer number)
- **Given:** NIMBUS-140 and 141 are running locally against TestDK.
- **When / Then:**
  1. On `/account/returns`, choosing "Details" on a return opens `/account/returns/<number>`. The page shows the number, date, BC status, lines with requested and received quantities and the reason code, and the expected credit. Compare with the BC return order: for example, 31502910 is 1,279.00 excl. / 1,598.75 incl. DKK.
  2. Creating a return from a BC order and choosing "View return" opens the new return.
  3. A number that belongs to another customer, and an unknown number, both show "Return not found".
  4. A request without a customer session gets 401 from `/store/bc-returns/<number>` (Task 02, TC-6).
  5. Temporarily setting an invalid `BUSINESS_CENTRAL_COMPANY_ID` shows the error state and leaves the account navigation working.

## Implementation Steps

1. Create `page.tsx`, `loading.tsx` and `not-found.tsx` under `returns/[number]/` exactly as specified.
2. Apply Edits 1 and 2 to `bc-order-return/index.tsx`. Do not change anything else in that file.
3. Create `src/__tests__/app/bcreturn-detail-page.test.tsx` exactly as specified.
4. Apply Edits 1 and 2 to `bc-order-return/index.test.tsx`.
5. Run `cd apps/storefront && pnpm test`. All new and existing tests must pass, including `message-catalogs.test.ts`.
6. Run `pnpm build` (repo root) and `pnpm lint`. Neither may report new errors.
7. Perform the TC-7 sandbox walkthrough and record the results in `issues/NIMBUS-141/PROGRESS.md`.
