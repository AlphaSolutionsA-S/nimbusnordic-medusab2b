import {
  COUNTRY_LANGUAGE_MAP,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from "./country-language-map"

// Intl formats Norwegian (Bokmål) under the "nb" language subtag; the
// storefront's locale code for Norway is "no".
const INTL_LANGUAGE_OVERRIDES: Partial<Record<Locale, string>> = {
  no: "nb",
}

function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Maps a next-intl locale (da, en, ...) to the full BCP 47 tag used for
 * number/date formatting (da-DK, en-GB, ...). The region comes from
 * COUNTRY_LANGUAGE_MAP so that map stays the single source of truth.
 * Unknown locales fall back to DEFAULT_LOCALE.
 */
export function getFormattingLocale(locale: string): string {
  const resolved: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  const country = Object.keys(COUNTRY_LANGUAGE_MAP).find(
    (code) => COUNTRY_LANGUAGE_MAP[code] === resolved
  )
  const language = INTL_LANGUAGE_OVERRIDES[resolved] ?? resolved
  return country ? `${language}-${country.toUpperCase()}` : language
}
