"use client"

import { ChevronUpDown } from "@medusajs/icons"
import { useTranslations } from "next-intl"

export type SortOptions = "price_asc" | "price_desc" | "created_at"

type SortProductsProps = {
  sortBy: SortOptions
  setQueryParams: (name: string, value: SortOptions) => void
  "data-testid"?: string
}

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
}: SortProductsProps) => {
  const t = useTranslations("Catalog.sortProducts")

  const sortOptions = [
    {
      value: "created_at",
      label: t("latestArrivalsLabel"),
    },
    {
      value: "price_asc",
      label: t("priceLowToHighLabel"),
    },
    {
      value: "price_desc",
      label: t("priceHighToLowLabel"),
    },
  ]

  const handleChange = (value: SortOptions) => {
    setQueryParams("sortBy", value)
  }

  return (
    <div className="flex items-center gap-2 text-sm p-2 justify-between">
      <span className="text-neutral-500">{t("sortByLabel")}</span>
      <div className="relative">
        <select
          className="w-full pr-8 overflow-hidden focus:outline-none appearance-none"
          title={t("sortByTooltip")}
          value={sortBy}
          onChange={(e) => handleChange(e.target.value as SortOptions)}
          data-testid={dataTestId}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronUpDown className="w-4 h-4 text-neutral-500" />
        </div>
      </div>
    </div>
  )
}

export default SortProducts
