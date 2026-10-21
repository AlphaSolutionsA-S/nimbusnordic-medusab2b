import type { CountryLanguageAssignments } from "../../../types/storefront-translation";
import { isCountryCode } from "../../../modules/storefront-translation/country-languages";

/** The Region Query projection `countries.iso_2`, verified against real data for NIMBUS-176. */
export interface RegionCountriesRow {
  countries?: Array<{ iso_2?: string | null } | null> | null;
}

/** Country codes served by any region, sorted and unique; malformed codes are never configured. */
export function configuredCountryCodes(regions: RegionCountriesRow[]): string[] {
  const codes = regions.flatMap((region) =>
    (region.countries ?? []).map((country) => country?.iso_2).filter(isCountryCode)
  );
  return [...new Set(codes)].sort();
}

/**
 * Initial explicit assignments: the legacy language of each currently configured country. Other
 * configured countries get the English default by having no entry.
 */
export function bootstrapAssignments(
  legacy: CountryLanguageAssignments,
  configured: string[]
): CountryLanguageAssignments {
  return Object.fromEntries(
    configured
      .filter((code) => Object.prototype.hasOwnProperty.call(legacy, code))
      .map((code) => [code, legacy[code]])
  );
}

export interface ScopedAssignments {
  assignments: CountryLanguageAssignments;
  /** Country → the unavailable language it would have had; it uses the English default instead. */
  skipped: CountryLanguageAssignments;
}

/**
 * Deploy bootstrap rule: a country whose language is missing or inactive is left out (English
 * default) rather than blocking the whole bootstrap. English itself unavailable is not handled here:
 * the service still refuses, because there is no default to fall back to.
 */
export function skipUnavailableAssignments(
  assignments: CountryLanguageAssignments,
  unavailableLocales: readonly string[]
): ScopedAssignments {
  const unavailable = new Set(unavailableLocales);
  const entries = Object.entries(assignments);
  return {
    assignments: Object.fromEntries(entries.filter(([, locale]) => !unavailable.has(locale))),
    skipped: Object.fromEntries(entries.filter(([, locale]) => unavailable.has(locale))),
  };
}
