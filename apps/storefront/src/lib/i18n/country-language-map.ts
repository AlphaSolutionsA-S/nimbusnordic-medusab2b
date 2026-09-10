/**
 * Single source of truth mapping a country (ISO 3166-1 alpha-2, lowercase) to its
 * storefront language. Country and language stay coupled 1:1 — see NIMBUS-159.
 * Extend this map when a new country/region is added; no other file should hardcode
 * this mapping.
 */

export const SUPPORTED_LOCALES = [
  "da",
  "en",
  "sv",
  "no",
  "pl",
  "it",
  "fr",
  "de",
] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export const COUNTRY_LANGUAGE_MAP: Readonly<Record<string, Locale>> = {
  dk: "da",
  gb: "en",
  se: "sv",
  no: "no",
  pl: "pl",
  it: "it",
  fr: "fr",
  de: "de",
}

export function getLocaleForCountry(countryCode: string): Locale {
  return COUNTRY_LANGUAGE_MAP[countryCode.toLowerCase()] ?? DEFAULT_LOCALE
}
