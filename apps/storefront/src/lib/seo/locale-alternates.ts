import { COUNTRY_LANGUAGE_MAP } from "@/lib/i18n/country-language-map"
import { getBaseURL } from "@/lib/util/env"

/**
 * Builds the `alternates.languages` map (Next.js `Metadata`) for a page path,
 * covering every country/region variant in `COUNTRY_LANGUAGE_MAP`. Language
 * stays 1:1 with country/region (see NIMBUS-159), so each country's URL is
 * keyed by its associated language.
 */
export function buildLocaleAlternates(
  pathWithoutCountryCode: string
): Record<string, string> {
  const baseUrl = getBaseURL()
  const normalizedPath = pathWithoutCountryCode.startsWith("/")
    ? pathWithoutCountryCode
    : `/${pathWithoutCountryCode}`

  return Object.entries(COUNTRY_LANGUAGE_MAP).reduce<Record<string, string>>(
    (acc, [countryCode, locale]) => {
      acc[locale] = `${baseUrl}/${countryCode}${normalizedPath}`
      return acc
    },
    {}
  )
}
