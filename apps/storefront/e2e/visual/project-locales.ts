/**
 * The countries the Playwright projects run in, with the browser locale of each. Shared by
 * `playwright.config.ts` and the country-language fixture, which must never change these countries'
 * languages while the project tests run in parallel.
 */
export const PROJECT_LOCALES = [
  { countryCode: 'dk', locale: 'da-DK' },
  { countryCode: 'gb', locale: 'en-GB' },
  { countryCode: 'se', locale: 'sv-SE' },
  { countryCode: 'no', locale: 'nb-NO' },
  { countryCode: 'pl', locale: 'pl-PL' },
  { countryCode: 'it', locale: 'it-IT' },
  { countryCode: 'fr', locale: 'fr-FR' },
  { countryCode: 'de', locale: 'de-DE' },
] as const;

export const PROJECT_COUNTRY_CODES: readonly string[] = PROJECT_LOCALES.map(({ countryCode }) => countryCode);
