"use client"

import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { ChangeEvent } from "react"

import { refreshUiTranslationsForCountry } from "@/lib/data/ui-translations-refresh"
import { getLocaleForCountry } from "@/lib/i18n/country-language-map"
import NativeSelect from "@/modules/common/components/native-select"

export type RegionSwitcherOption = {
  countryCode: string
  countryName: string
}

type RegionSwitcherProps = {
  options: RegionSwitcherOption[]
}

export function RegionSwitcher({ options }: RegionSwitcherProps) {
  const t = useTranslations("Layout.regionSwitcher")
  const { countryCode } = useParams<{ countryCode: string }>()

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const newCountryCode = event.target.value

    if (newCountryCode && newCountryCode !== countryCode) {
      // Drop the cached texts of the new language first, so the next page load reads the newest
      // ones from the backend. A failure only means cached texts are shown; the switch still happens.
      await refreshUiTranslationsForCountry(newCountryCode).catch((error: unknown) => {
        console.warn("[ui-translations] refresh before language switch failed", error)
      })
      window.location.href = `/${newCountryCode}`
    }
  }

  return (
    <NativeSelect
      aria-label={t("label")}
      data-testid="region-switcher"
      value={countryCode}
      onChange={handleChange}
      className="min-w-0 max-w-[10rem] small:max-w-none"
    >
      {options.map((option) => (
        <option key={option.countryCode} value={option.countryCode}>
          {option.countryName} ({getLocaleForCountry(option.countryCode)})
        </option>
      ))}
    </NativeSelect>
  )
}
