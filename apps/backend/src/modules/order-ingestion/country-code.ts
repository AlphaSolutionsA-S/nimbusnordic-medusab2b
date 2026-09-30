import { defaultCountries } from "@medusajs/framework/utils";

/*
  Medusa's country list (defaultCountries, the ISO 3166-1 data its region module uses) also
  contains XK (Kosovo), a user-assigned code that ISO has not officially assigned. Only officially
  assigned codes are valid by default (NIMBUS-171 D11), so it is removed here.
*/
const NOT_OFFICIALLY_ASSIGNED_CODES: ReadonlySet<string> = new Set(["XK"]);

/*
  Exceptions allowlist (NIMBUS-171 D11): the one place to accept a two-letter code that is not an
  officially assigned ISO 3166-1 alpha-2 code, such as "XK" (Kosovo), "UK" or "EU". Add upper-case
  codes only, and record the decision (issue key and reason) next to each entry. Business Central
  must also know the code before orders using it can be submitted there. Empty on purpose.
*/
export const COUNTRY_CODE_EXCEPTIONS: ReadonlySet<string> = new Set<string>([]);

export const OFFICIAL_ISO_COUNTRY_CODES: ReadonlySet<string> = new Set(
  defaultCountries
    .map((country) => country.alpha2.toUpperCase())
    .filter((code) => !NOT_OFFICIALLY_ASSIGNED_CODES.has(code))
);

const COUNTRY_CODE_SHAPE = /^[A-Za-z]{2}$/;

// Space, tab, CR and LF only: the same set the NIMBUS-145 APIM shape check allows.
const SURROUNDING_WHITESPACE = /^[ \t\n\r]+|[ \t\n\r]+$/g;

export function normalizeCountryCode(value: string): string {
  return value.replace(SURROUNDING_WHITESPACE, "").toUpperCase();
}

/*
  The shape is checked before upper-casing: Unicode case mapping would otherwise turn input such
  as "ß" into "SS" or "ıt" into "IT".
*/
export function isAllowedCountryCode(
  value: string,
  exceptions: ReadonlySet<string> = COUNTRY_CODE_EXCEPTIONS
): boolean {
  const trimmed = value.replace(SURROUNDING_WHITESPACE, "");

  if (!COUNTRY_CODE_SHAPE.test(trimmed)) {
    return false;
  }

  const code = trimmed.toUpperCase();

  return OFFICIAL_ISO_COUNTRY_CODES.has(code) || exceptions.has(code);
}
