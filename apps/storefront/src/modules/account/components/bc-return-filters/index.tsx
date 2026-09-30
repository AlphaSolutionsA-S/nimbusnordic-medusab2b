"use client"

import Button from "@/modules/common/components/button"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

// Only statuses whose BC wire value has no XML-encoded space (see Task 01).
const BC_RETURN_STATUSES = ["Open", "Released"] as const

// Visible labels only — option values stay as the BC API filter values.
const STATUS_LABEL_KEYS = { Open: "open", Released: "released" } as const

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
  const tStatus = useTranslations("Account.bcStatus")
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
              {tStatus(STATUS_LABEL_KEYS[s])}
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
