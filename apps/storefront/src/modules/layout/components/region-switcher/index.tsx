"use client"

import { useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { ChangeEvent } from "react"

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

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newCountryCode = event.target.value

    if (newCountryCode && newCountryCode !== countryCode) {
      window.location.href = `/${newCountryCode}`
    }
  }

  return (
    <NativeSelect
      aria-label={t("label")}
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
