import type {
  CountryLanguageAssignments,
  CountryLanguageEntry,
} from "../../types/storefront-translation";
import { canonicalizeLocale } from "../../utils/translations/validation";

/** Language of every configured country without an explicit assignment (NIMBUS-176). */
export const DEFAULT_COUNTRY_LOCALE = "en";
/** Every possible two-letter code. */
export const MAX_COUNTRY_ASSIGNMENTS = 26 * 26;
export const MAX_CONFIGURATION_BYTES = 64 * 1024;

const COUNTRY_CODE = /^[a-z]{2}$/;

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && COUNTRY_CODE.test(value);
}

/** Only the canonical spelling is stored, so one language never appears under two keys. */
export function isCanonicalLocale(value: unknown): value is string {
  return typeof value === "string" && canonicalizeLocale(value) === value;
}

/** Sorted-key copy; the stored JSON is canonical so its size bound is deterministic. */
export function sortAssignments(assignments: CountryLanguageAssignments): CountryLanguageAssignments {
  return Object.fromEntries(
    Object.keys(assignments)
      .sort()
      .map((code) => [code, assignments[code]])
  );
}

export function serializedAssignments(assignments: CountryLanguageAssignments): string {
  return JSON.stringify(sortAssignments(assignments));
}

export function assignmentsProblem(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "Assignments must be an object of country codes to languages";
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_COUNTRY_ASSIGNMENTS) {
    return `Assignments can hold at most ${MAX_COUNTRY_ASSIGNMENTS} countries`;
  }
  for (const [code, locale] of entries) {
    if (!isCountryCode(code)) {
      return "Country codes must be two lowercase letters";
    }
    if (!isCanonicalLocale(locale)) {
      return `The language for "${code}" must be a canonical BCP 47 language tag`;
    }
  }
  if (Buffer.byteLength(serializedAssignments(value as CountryLanguageAssignments)) > MAX_CONFIGURATION_BYTES) {
    return "Assignments are too large";
  }
  return null;
}

/** Countries, retained ones included, whose explicit assignment names the language; sorted. */
export function countriesUsing(assignments: CountryLanguageAssignments, locale: string): string[] {
  return Object.keys(assignments)
    .filter((code) => assignments[code] === locale)
    .sort();
}

/** Effective language per configured country: its explicit entry, otherwise the default. */
export function effectiveCountryLanguages(
  assignments: CountryLanguageAssignments,
  configuredCountryCodes: string[]
): CountryLanguageEntry[] {
  return [...new Set(configuredCountryCodes)].sort().map((code) =>
    Object.prototype.hasOwnProperty.call(assignments, code)
      ? { country_code: code, locale: assignments[code], source: "explicit" }
      : { country_code: code, locale: DEFAULT_COUNTRY_LOCALE, source: "default" }
  );
}
