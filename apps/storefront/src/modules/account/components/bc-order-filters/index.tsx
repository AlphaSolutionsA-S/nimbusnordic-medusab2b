"use client"

import Button from "@/modules/common/components/button"
import type { BCOrderStatus } from "@/types/bc-order"
import { useTranslations } from "next-intl"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

const BC_ORDER_STATUSES: BCOrderStatus[] = [
  "Open",
  "Draft",
]

type BcOrderFiltersProps = {
  currentStatus?: string
  currentDateFrom?: string
  currentDateTo?: string
  currentSearch?: string
}

const BcOrderFilters = ({
  currentStatus,
  currentDateFrom,
  currentDateTo,
  currentSearch,
}: BcOrderFiltersProps) => {
  const t = useTranslations("Account.bcOrderFilters")
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
      data-testid="bc-order-filters"
    >
      {/* Status filter */}
      <div className="flex flex-col gap-y-1">
        <label
          htmlFor="bc-status-filter"
          className="text-xs text-neutral-500"
        >
          {t("statusLabel")}
        </label>
        <select
          id="bc-status-filter"
          className="text-sm border border-neutral-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={currentStatus ?? ""}
          onChange={(e) => pushParams({ status: e.target.value || undefined })}
        >
          <option value="">{t("allStatusesOption")}</option>
          {BC_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-y-1">
        <label
          htmlFor="bc-date-from-filter"
          className="text-xs text-neutral-500"
        >
          {t("fromLabel")}
        </label>
        <input
          id="bc-date-from-filter"
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
          htmlFor="bc-date-to-filter"
          className="text-xs text-neutral-500"
        >
          {t("toLabel")}
        </label>
        <input
          id="bc-date-to-filter"
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
          htmlFor="bc-search-filter"
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
            id="bc-search-filter"
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
        data-testid="bc-orders-clear-filters"
      >
        {t("clearLabel")}
      </Button>
    </div>
  )
}

export default BcOrderFilters
