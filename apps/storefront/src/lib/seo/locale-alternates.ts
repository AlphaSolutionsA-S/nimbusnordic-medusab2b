import type { CountryLanguagePublication } from "@/lib/i18n/country-language-map"
import { getBaseURL } from "@/lib/util/env"

/**
 * The hreflang key for a country's URL: the language (with script and variants) plus the URL
 * country as region. A region already in the language tag is replaced, and extensions are dropped,
 * so countries that share a language each keep their own key. Null for a tag Intl cannot parse.
 */
function hreflangKey(locale: string, countryCode: string): string | null {
  let parsed: Intl.Locale
  try {
    parsed = new Intl.Locale(locale)
  } catch {
    return null
  }
  // `baseName` is language[-script][-region][-variants], already without extensions.
  const subtags = parsed.baseName.split("-")
  const variants = subtags.slice(
    1 + (parsed.script ? 1 : 0) + (parsed.region ? 1 : 0)
  )
  return [
    parsed.language,
    parsed.script,
    countryCode.toUpperCase(),
    ...variants,
  ]
    .filter(Boolean)
    .join("-")
}

/**
 * Builds the `alternates.languages` map (Next.js `Metadata`) for a page path: one URL per country
 * in the request's country-language publication, which holds configured countries only.
 */
export function buildLocaleAlternates(
  publication: CountryLanguagePublication,
  pathWithoutCountryCode: string
): Record<string, string> {
  const baseUrl = getBaseURL()
  const normalizedPath = pathWithoutCountryCode.startsWith("/")
    ? pathWithoutCountryCode
    : `/${pathWithoutCountryCode}`

  const alternates: Record<string, string> = {}
  for (const { country_code, locale } of publication.countries) {
    const key = hreflangKey(locale, country_code)
    if (key) {
      alternates[key] = `${baseUrl}/${country_code}${normalizedPath}`
    }
  }
  return alternates
}
