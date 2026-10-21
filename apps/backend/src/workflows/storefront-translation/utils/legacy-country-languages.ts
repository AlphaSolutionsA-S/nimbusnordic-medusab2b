import type { CountryLanguageAssignments } from "../../../types/storefront-translation";

/**
 * Country languages the storefront used before the configuration existed (its legacy
 * country-to-locale map). Copied rather than imported: the apps share no source. Countries
 * without an entry (and outside Region membership) fall back to the English default.
 */
export const LEGACY_COUNTRY_LANGUAGES: Readonly<CountryLanguageAssignments> = {
  dk: "da",
  gb: "en",
  se: "sv",
  no: "no",
  pl: "pl",
  it: "it",
  fr: "fr",
  de: "de",
};
