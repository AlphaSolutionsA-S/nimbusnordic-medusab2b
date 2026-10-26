import type { CountryLanguageAssignments } from "../../../types/storefront-translation";
import {
  DEFAULT_COUNTRY_LOCALE,
  isCountryCode,
} from "../../../modules/storefront-translation/country-languages";

/** Link country when neither the request nor the company gives a country in a region (NIMBUS-162). */
export const DEFAULT_EMAIL_LINK_COUNTRY = "dk";

export interface EmailLanguageInput {
  /** Untrusted: taken only as an exact lower-case two-letter code. */
  requestCountry?: unknown;
  /** Free text from Business Central or company registration; trimmed and lower-cased. */
  companyCountry?: string | null;
  configuredCountries: string[];
  /** Null while the country-language configuration is not initialized. */
  assignments: CountryLanguageAssignments | null;
}

export interface EmailLanguage {
  locale: string;
  linkCountry: string;
}

/**
 * Email language and link country: the request country, else the company country, each only when it
 * is a country in a region; its assigned language, or English when unassigned. No usable country
 * gives English and the default link country.
 */
export function chooseEmailLanguage(input: EmailLanguageInput): EmailLanguage {
  const configured = new Set(input.configuredCountries);
  const company = input.companyCountry?.trim().toLowerCase();
  const country = [input.requestCountry, company].find(
    (candidate): candidate is string => isCountryCode(candidate) && configured.has(candidate)
  );
  if (!country) {
    return { locale: DEFAULT_COUNTRY_LOCALE, linkCountry: DEFAULT_EMAIL_LINK_COUNTRY };
  }
  const assignments = input.assignments;
  const locale =
    assignments && Object.prototype.hasOwnProperty.call(assignments, country)
      ? assignments[country]
      : DEFAULT_COUNTRY_LOCALE;
  return { locale, linkCountry: country };
}
