import { getRequestConfig } from "next-intl/server"

import { getLocaleForCountry } from "@/lib/i18n/country-language-map"

// This project doesn't use next-intl's own `[locale]` routing — the locale is
// derived from the existing `/{countryCode}/...` segment instead (see
// src/app/[countryCode]/layout.tsx, which caches the country code via
// `setRequestLocale` before any messages are loaded). `requestLocale` here
// therefore resolves to a country code, not a locale.
export default getRequestConfig(async ({ requestLocale }) => {
  const countryCode = await requestLocale
  const locale = getLocaleForCountry(countryCode ?? "")

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
