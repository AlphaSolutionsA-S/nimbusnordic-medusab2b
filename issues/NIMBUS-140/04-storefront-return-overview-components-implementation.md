# Task 04: Return overview components (card, filters, overview) — Implementation Plan

**Status:** TODO
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 04
**Date:** 2026-09-15
**Branch:** feature/NIMBUS-140 (from develop)
**Depends on:** Task 03

---

## Project Environment

- **App root:** `apps/storefront`
- **Build command:** `pnpm build` (from repo root) or `cd apps/storefront && pnpm build`
- **Lint command:** `pnpm lint` (from repo root)
- **Test command:** `cd apps/storefront && pnpm test`
- **Test framework:** Jest + React Testing Library (`jest-environment-jsdom`)
- **Test location:** `apps/storefront/src/__tests__/modules/account/components/<component>/index.test.tsx`
- **Naming conventions:** kebab-case directories, PascalCase component/exported-const names, camelCase functions/variables. Double-quoted strings, no trailing semicolons.

## IMPORTANT: `next-intl` is mocked automatically — do not add per-test mocks for it

`apps/storefront/__mocks__/next-intl.tsx` and `apps/storefront/__mocks__/next-intl/server.ts` are applied automatically by Jest to every test in this app (no `jest.mock("next-intl")` call needed). They resolve `useTranslations`/`getTranslations` against the **real `messages/en.json`** catalog. This means:
- Component tests can assert literal English copy (e.g. `screen.getByText("Something went wrong")`) and it will only pass once the real key exists in `messages/en.json`.
- **Task 05 adds the `en.json` (and other locale) keys.** If you run this task's tests before Task 05's message-file edits land, the translation-dependent assertions will fail (the mock falls back to returning the raw key string, e.g. `"errorHeading"`, when a key is missing). Implement Task 05's message file edits together with or before running this task's tests, or accept the tests will not pass until Task 05 is merged. The manifest lists Task 04 as depending only on Task 03 because the *code* only needs Task 03's types — but test execution needs Task 05's translation keys to be present. If working sequentially, do Tasks 04 and 05 back-to-back before running either task's test suite standalone.

## Solution Design

Build three components that together render the return list, mirroring the existing `bc-order-card` / `bc-order-filters` / `bc-order-overview` family in `apps/storefront/src/modules/account/components/` field-for-field, adapted for `BCReturnListItem` (from Task 03) instead of `BCOrder`. The existing `resource-pagination` component (`apps/storefront/src/modules/account/components/resource-pagination/index.tsx`) is **generic and reused as-is** — no changes needed there.

Per SCOPE.md, each return row must show: return number, related order number, status, date requested, item count — plus a details link to the (future, NIMBUS-141) return detail route `/account/returns/{number}`.

**Known test-renderer limitation (do not fight it):** `BcReturnOverview` and `BcReturnCard` are both `async` Server Components. The existing `bc-order-overview` test file only tests the `error` and `empty` states of `BcOrderOverview` — it deliberately does **not** test the non-empty/list-rendering path, because React Testing Library's renderer cannot render an unresolved async component nested as a JSX child (see the comment in `apps/storefront/src/__tests__/app/bcorders-page.test.tsx`). Mirror this exactly: do not add a "renders a list of cards" test to `BcReturnOverview`'s test file. `BcReturnCard` itself can be tested directly because its own tests `await` it directly before rendering (same pattern as the existing `bc-order-card` test).

## Code Skeletons

### New File: `apps/storefront/src/modules/account/components/bc-return-card/index.tsx`

```typescript
import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCReturnListItem } from "@/types/bc-order"
import { Container } from "@medusajs/ui"
import { getTranslations } from "next-intl/server"

type BcReturnCardProps = {
  item: BCReturnListItem
}

const BcReturnCard = async ({ item }: BcReturnCardProps) => {
  const t = await getTranslations("Account.bcReturnCard")
  const documentDate = new Date(item.documentDate)

  return (
    <Container className="bg-white flex small:flex-row flex-col p-4 rounded-md small:justify-between small:items-center gap-y-2 items-start">
      <div className="flex gap-x-4 items-center pl-3">
        <div className="flex pr-2 text-small-regular items-center">
          <CalendarIcon className="inline-block mr-1" />
          <span data-testid="bc-return-date">
            {documentDate.toLocaleDateString("en-GB", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center text-small-regular">
          <DocumentIcon className="inline-block mr-1" />
          <span data-testid="bc-return-number">#{item.number}</span>
        </div>
      </div>

      <div className="flex gap-x-4 small:divide-x divide-gray-200 small:justify-normal justify-between w-full small:w-auto">
        <div className="flex items-center text-small-regular text-ui-fg-base">
          <span
            className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
            data-testid="bc-return-status"
          >
            {item.status}
          </span>
        </div>

        <div className="flex items-center pl-4">
          <span
            className="text-small-regular text-ui-fg-base"
            data-testid="bc-return-related-order"
          >
            {item.relatedOrderNumber
              ? t("relatedOrderLabel", { number: item.relatedOrderNumber })
              : "—"}
          </span>
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
    </Container>
  )
}

export default BcReturnCard
```

### New File: `apps/storefront/src/modules/account/components/bc-return-overview/index.tsx`

```typescript
import BcReturnCard from "@/modules/account/components/bc-return-card"
import ResourcePagination from "@/modules/account/components/resource-pagination"
import type { BCReturnListResponse } from "@/types/bc-order"
import { getTranslations } from "next-intl/server"

type BcReturnOverviewProps = {
  result: BCReturnListResponse | null
  error: boolean
  currentPage: number
  limit: number
}

const BcReturnOverview = async ({
  result,
  error,
  currentPage,
  limit,
}: BcReturnOverviewProps) => {
  const t = await getTranslations("Account.bcReturnOverview")

  if (error) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-returns-error"
      >
        <h2 className="text-large-semi">{t("errorHeading")}</h2>
        <p className="text-base-regular text-neutral-500">
          {t("errorMessage")}
        </p>
        <a
          href=""
          className="text-sm text-neutral-900 underline"
          data-testid="bc-returns-try-again"
        >
          {t("tryAgainLabel")}
        </a>
      </div>
    )
  }

  if (!result || result.returns.length === 0) {
    return (
      <div
        className="w-full flex flex-col items-center gap-y-4 py-8"
        data-testid="bc-returns-empty"
      >
        <h2 className="text-large-semi">{t("emptyHeading")}</h2>
        <p className="text-base-regular text-neutral-500">
          {t("emptyMessage")}
        </p>
      </div>
    )
  }

  const totalPages = Math.ceil(result.count / limit)

  return (
    <div className="flex flex-col gap-y-4 w-full" data-testid="bc-returns-list">
      {result.returns.map((item) => (
        <BcReturnCard key={item.id} item={item} />
      ))}
      {totalPages > 1 && (
        <ResourcePagination
          totalPages={totalPages}
          currentPage={currentPage}
          pageParam="page"
        />
      )}
    </div>
  )
}

export default BcReturnOverview
```

### New File: `apps/storefront/src/modules/account/components/bc-return-filters/index.tsx`

```typescript
"use client"

import Button from "@/modules/common/components/button"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

const BC_RETURN_STATUSES = [
  "Open",
  "Released",
  "Pending Approval",
  "Pending Prepayment",
] as const

type BcReturnFiltersProps = {
  currentStatus?: string
  currentDateFrom?: string
  currentDateTo?: string
  currentSearch?: string
}

const BcReturnFilters = ({
  currentStatus,
  currentDateFrom,
  currentDateTo,
  currentSearch,
}: BcReturnFiltersProps) => {
  const t = useTranslations("Account.bcReturnFilters")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [dateFrom, setDateFrom] = useState(currentDateFrom ?? "")
  const [dateTo, setDateTo] = useState(currentDateTo ?? "")

  useEffect(() => {
    setDateFrom(currentDateFrom ?? "")
  }, [currentDateFrom])

  useEffect(() => {
    setDateTo(currentDateTo ?? "")
  }, [currentDateTo])

  const pushParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    // Reset to page 1 whenever a filter changes
    params.delete("page")
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  const handleClear = () => {
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }

  return (
    <div
      className={`flex flex-wrap gap-3 items-end mb-2 ${isPending ? "opacity-50" : ""}`}
      data-testid="bc-return-filters"
    >
      {/* Status filter */}
      <div className="flex flex-col gap-y-1">
        <label
          htmlFor="bc-return-status-filter"
          className="text-xs text-neutral-500"
        >
          {t("statusLabel")}
        </label>
        <select
          id="bc-return-status-filter"
          className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={currentStatus ?? ""}
          onChange={(e) => pushParams({ status: e.target.value || undefined })}
        >
          <option value="">{t("allStatusesOption")}</option>
          {BC_RETURN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-y-1">
        <label
          htmlFor="bc-return-date-from-filter"
          className="text-xs text-neutral-500"
        >
          {t("fromLabel")}
        </label>
        <input
          id="bc-return-date-from-filter"
          type="date"
          className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={dateFrom}
          onChange={(e) => {
            const value = e.target.value
            setDateFrom(value)
            pushParams({ date_from: value || undefined })
          }}
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-y-1">
        <label
          htmlFor="bc-return-date-to-filter"
          className="text-xs text-neutral-500"
        >
          {t("toLabel")}
        </label>
        <input
          id="bc-return-date-to-filter"
          type="date"
          className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={dateTo}
          onChange={(e) => {
            const value = e.target.value
            setDateTo(value)
            pushParams({ date_to: value || undefined })
          }}
        />
      </div>

      {/* Search */}
      <div className="flex flex-col gap-y-1">
        <label
          htmlFor="bc-return-search-filter"
          className="text-xs text-neutral-500"
        >
          {t("searchLabel")}
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const value = (
              e.currentTarget.elements.namedItem("search") as HTMLInputElement
            ).value
            pushParams({ search: value || undefined })
          }}
        >
          <input
            id="bc-return-search-filter"
            name="search"
            type="text"
            defaultValue={currentSearch ?? ""}
            placeholder={t("searchPlaceholder")}
            className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
          />
        </form>
      </div>

      {/* Clear */}
      <Button
        variant="secondary"
        className="text-xs self-end"
        onClick={handleClear}
        type="button"
        data-testid="bc-returns-clear-filters"
      >
        {t("clearLabel")}
      </Button>
    </div>
  )
}

export default BcReturnFilters
```

### New File: `apps/storefront/src/__tests__/modules/account/components/bc-return-card/index.test.tsx`

```typescript
import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import BcReturnCard from "@/modules/account/components/bc-return-card"

const item = {
  id: "return-1",
  number: "RET-1",
  relatedOrderNumber: "SO-1000",
  documentDate: "2026-01-01T00:00:00.000Z",
  status: "Open",
  itemCount: 2,
} as any

describe("BcReturnCard", () => {
  it("renders the extracted 'Details' link label unchanged", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
  })

  // TC-1: happy path — the details link routes by the return number.
  it("links to the return detail page using the return number, not the internal id", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    const detailsLink = screen.getByTestId("bc-return-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/RET-1")
    )
    expect(detailsLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("/account/returns/return-1")
    )
  })

  // TC-2: edge case — a return number containing characters that need URL-encoding still produces a safe link.
  it("URL-encodes a return number that contains characters unsafe for a path segment", async () => {
    const encodedItem = { ...item, number: "RET/1 2" }
    const element = await BcReturnCard({ item: encodedItem })
    render(element)

    const detailsLink = screen.getByTestId("bc-return-details-link")
    expect(detailsLink).toHaveAttribute(
      "href",
      expect.stringContaining(encodeURIComponent("RET/1 2"))
    )
  })

  // TC-3: integration — all required list fields are rendered.
  it("renders return number, related order number, status, date and item count", async () => {
    const element = await BcReturnCard({ item })
    render(element)

    expect(screen.getByTestId("bc-return-number")).toHaveTextContent("RET-1")
    expect(screen.getByTestId("bc-return-related-order")).toHaveTextContent(
      "SO-1000"
    )
    expect(screen.getByTestId("bc-return-status")).toHaveTextContent("Open")
    expect(screen.getByTestId("bc-return-item-count")).toHaveTextContent("2")
  })

  // TC-4: edge case — a missing related order number falls back to an em dash instead of a blank "Order #".
  it("shows a fallback when there is no related order number", async () => {
    const itemWithoutOrder = { ...item, relatedOrderNumber: "" }
    const element = await BcReturnCard({ item: itemWithoutOrder })
    render(element)

    expect(screen.getByTestId("bc-return-related-order")).toHaveTextContent(
      "—"
    )
  })
})
```

### New File: `apps/storefront/src/__tests__/modules/account/components/bc-return-overview/index.test.tsx`

```typescript
import { render, screen } from "@testing-library/react"

import BcReturnOverview from "@/modules/account/components/bc-return-overview"

describe("BcReturnOverview", () => {
  it("renders the extracted error-state copy unchanged", async () => {
    const element = await BcReturnOverview({
      result: null,
      error: true,
      currentPage: 1,
      limit: 10,
    })
    render(element)

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(
      screen.getByText(
        "We were unable to load your returns. Please try again."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Try again")).toBeInTheDocument()
  })

  it("renders the extracted empty-state copy unchanged", async () => {
    const element = await BcReturnOverview({
      result: { returns: [], count: 0 } as any,
      error: false,
      currentPage: 1,
      limit: 10,
    })
    render(element)

    expect(screen.getByText("No returns found")).toBeInTheDocument()
    expect(
      screen.getByText("You haven't submitted any returns yet.")
    ).toBeInTheDocument()
  })
})
```

### New File: `apps/storefront/src/__tests__/modules/account/components/bc-return-filters/index.test.tsx`

```typescript
import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/returns"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

import BcReturnFilters from "@/modules/account/components/bc-return-filters"

describe("BcReturnFilters", () => {
  it("renders the extracted filter labels and buttons unchanged", () => {
    render(<BcReturnFilters />)

    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("All statuses")).toBeInTheDocument()
    expect(screen.getByText("From")).toBeInTheDocument()
    expect(screen.getByText("To")).toBeInTheDocument()
    expect(screen.getByText("Search")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Return number…")).toBeInTheDocument()
    expect(screen.getByText("Clear")).toBeInTheDocument()
  })

  // TC-1: integration — the status dropdown lists all four BC return statuses.
  it("lists all Business Central return statuses in the status filter", () => {
    render(<BcReturnFilters />)

    const statusSelect = screen.getByLabelText("Status")
    expect(statusSelect).toContainHTML("Open")
    expect(statusSelect).toContainHTML("Released")
    expect(statusSelect).toContainHTML("Pending Approval")
    expect(statusSelect).toContainHTML("Pending Prepayment")
  })
})
```

## Test Cases

### TC-1: `BcReturnCard` happy path — details link uses the return number
- **Given:** A `BCReturnListItem` with `number: "RET-1"`, `id: "return-1"`.
- **When:** The card is rendered.
- **Then:** The details link `href` contains `/account/returns/RET-1` and does not contain the internal id.

### TC-2: `BcReturnCard` edge case — unsafe characters in the return number are URL-encoded
- **Given:** `number: "RET/1 2"`.
- **When:** The card is rendered.
- **Then:** The details link `href` contains the URL-encoded form of that number.

### TC-3: `BcReturnCard` integration — all required fields render
- **Given:** An item with all five list fields populated.
- **When:** The card is rendered.
- **Then:** Return number, related order number, status, and item count each appear in their respective `data-testid` element.

### TC-4: `BcReturnCard` edge case — missing related order number
- **Given:** `relatedOrderNumber: ""`.
- **When:** The card is rendered.
- **Then:** The related-order element shows a `"—"` fallback instead of an empty/malformed label.

### TC-5: `BcReturnOverview` happy path — error state
- **Given:** `error: true`.
- **When:** The overview is rendered.
- **Then:** The extracted error heading/message/try-again copy renders (same copy pattern as `BcOrderOverview`, translated in the `Account.bcReturnOverview` namespace).

### TC-6: `BcReturnOverview` edge case — empty state
- **Given:** `result: { returns: [], count: 0 }`, `error: false`.
- **When:** The overview is rendered.
- **Then:** The extracted empty heading/message renders.

### TC-7: `BcReturnFilters` integration — status options match the BC enum
- **Given:** The filters component is rendered with no props.
- **When:** The status `<select>` is inspected.
- **Then:** It lists `Open`, `Released`, `Pending Approval`, and `Pending Prepayment`.

## Implementation Steps

1. Create `apps/storefront/src/modules/account/components/bc-return-card/index.tsx` exactly as specified.
2. Create `apps/storefront/src/modules/account/components/bc-return-overview/index.tsx` exactly as specified.
3. Create `apps/storefront/src/modules/account/components/bc-return-filters/index.tsx` exactly as specified.
4. Do **not** create a new pagination component — `resource-pagination` is reused as-is via import.
5. Create the three new test files exactly as specified.
6. This task's translation-dependent test assertions (e.g. `"Something went wrong"`, `"No returns found"`, `"Return number…"`, `"Status"`) will only pass once Task 05's message-file edits (adding `Account.bcReturnOverview`, `Account.bcReturnFilters`, `Account.bcReturnCard` keys to `messages/en.json`) are also in place. If implementing sequentially, apply Task 05's message-file edits before running this task's test suite.
7. Run `cd apps/storefront && pnpm test` and confirm all new tests pass.
8. Run `pnpm build` from the repo root and confirm no TypeScript errors.
9. Run `pnpm lint` from the repo root and confirm no new lint errors.
