/**
 * Interprets the backend's country-language publication (`GET /store/country-languages`,
 * NIMBUS-176). Which country uses which language is decided in the backend; this file only
 * validates the published verdict and looks it up. The one local rule is the approved outage
 * fallback: the legacy map below, used only when a worker has never loaded a publication.
 */

/** Approved cold-outage fallback (NIMBUS-176); not the source of truth for any country. */
export const COUNTRY_LANGUAGE_MAP: Readonly<Record<string, string>> = {
  dk: "da",
  gb: "en",
  se: "sv",
  no: "no",
  pl: "pl",
  it: "it",
  fr: "fr",
  de: "de",
}

/** The eight legacy languages. Only the formatting and alternate-link helpers still use it. */
export const SUPPORTED_LOCALES = ["da", "en", "sv", "no", "pl", "it", "fr", "de"] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE = "en"

// Mirrors the backend bounds: 676 possible two-letter codes, locale tags of at most 64 characters.
// Together with the exact entry shape they bound the size of an accepted publication.
export const MAX_PUBLISHED_COUNTRIES = 26 * 26
export const MAX_LOCALE_LENGTH = 64

const COUNTRY_CODE = /^[a-z]{2}$/

export type CountryLanguageSource = "explicit" | "default"

export interface CountryLanguageEntry {
  country_code: string
  locale: string
  source: CountryLanguageSource
}

export interface CountryLanguagePublication {
  default_locale: string
  countries: readonly CountryLanguageEntry[]
}

/**
 * `available`: a publication read within the freshness window; `stale`: the last good publication
 * after a failed refresh; `legacy`: no publication yet in this process, the fallback map is used.
 */
export type CountryLanguageAvailability = "available" | "stale" | "legacy"

export interface CountryLanguageSnapshot extends CountryLanguagePublication {
  availability: CountryLanguageAvailability
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && COUNTRY_CODE.test(value)
}

/** A canonical BCP 47 tag as the backend stores it, so one language never has two spellings. */
export function isCanonicalLocale(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > MAX_LOCALE_LENGTH || /[\s/\\]/.test(value)) {
    return false
  }
  try {
    const canonical = Intl.getCanonicalLocales(value)
    return canonical.length === 1 && canonical[0] === value
  } catch {
    return false
  }
}

function isEntry(value: unknown): value is CountryLanguageEntry {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    Object.keys(entry).length === 3 &&
    isCountryCode(entry.country_code) &&
    isCanonicalLocale(entry.locale) &&
    (entry.source === "explicit" || entry.source === "default")
  )
}

/** Returns the publication when the response matches the contract exactly, otherwise null. */
export function parseCountryLanguagePublication(value: unknown): CountryLanguagePublication | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  const { countries } = candidate
  if (
    Object.keys(candidate).length !== 2 ||
    !isCanonicalLocale(candidate.default_locale) ||
    !Array.isArray(countries) ||
    countries.length > MAX_PUBLISHED_COUNTRIES ||
    !countries.every(isEntry)
  ) {
    return null
  }
  const codes = new Set(countries.map((entry) => entry.country_code))
  if (codes.size !== countries.length) {
    return null
  }
  return {
    default_locale: candidate.default_locale,
    countries: countries.map(({ country_code, locale, source }) => ({ country_code, locale, source })),
  }
}

export function legacyCountryLanguageSnapshot(): CountryLanguageSnapshot {
  return {
    default_locale: DEFAULT_LOCALE,
    countries: Object.entries(COUNTRY_LANGUAGE_MAP).map(([country_code, locale]) => ({
      country_code,
      locale,
      source: "explicit",
    })),
    availability: "legacy",
  }
}

export function findPublishedCountry(
  snapshot: CountryLanguagePublication,
  countryCode: unknown
): CountryLanguageEntry | undefined {
  if (typeof countryCode !== "string") {
    return undefined
  }
  const code = countryCode.toLowerCase()
  return snapshot.countries.find((entry) => entry.country_code === code)
}

/** The published language of a country; a missing or unpublished country gets the default. */
export function localeForCountry(snapshot: CountryLanguagePublication, countryCode: unknown): string {
  return findPublishedCountry(snapshot, countryCode)?.locale ?? snapshot.default_locale
}

/**
 * Legacy lookup for the metadata pages that do not yet read the request snapshot.
 * @deprecated read the request snapshot through `getCountryLanguageForCountry` instead.
 */
export function getLocaleForCountry(countryCode: string): string {
  return COUNTRY_LANGUAGE_MAP[countryCode.toLowerCase()] ?? DEFAULT_LOCALE
}
