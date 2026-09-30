import {
  COUNTRY_CODE_EXCEPTIONS,
  OFFICIAL_ISO_COUNTRY_CODES,
  isAllowedCountryCode,
  normalizeCountryCode,
} from "../country-code";

describe("country-code", () => {
  it("TC-1: holds exactly the 249 officially assigned ISO 3166-1 alpha-2 codes (pins Medusa's defaultCountries minus XK)", () => {
    expect(OFFICIAL_ISO_COUNTRY_CODES.size).toEqual(249);
    for (const code of ["DK", "SE", "NO", "DE", "GB", "FI", "PS", "SS", "AQ"]) {
      expect(OFFICIAL_ISO_COUNTRY_CODES.has(code)).toBe(true);
    }
    for (const code of ["XK", "UK", "EU", "XX", "AN", "YU"]) {
      expect(OFFICIAL_ISO_COUNTRY_CODES.has(code)).toBe(false);
    }
  });

  it("TC-2: accepts official codes in any case with surrounding space, tab, CR or LF", () => {
    for (const value of ["DK", "dk", "Dk", " SE ", "\tno\n", "\r\nGB\r\n"]) {
      expect(isAllowedCountryCode(value)).toBe(true);
    }
  });

  it("TC-3: rejects three-letter codes, names, unassigned and user-assigned codes, and empty values", () => {
    for (const value of ["DNK", "Denmark", "XX", "XK", "UK", "EU", "", "   ", "D K", "D1"]) {
      expect(isAllowedCountryCode(value)).toBe(false);
    }
  });

  it("TC-4: rejects non-ASCII input that Unicode upper-casing would turn into a valid code, and non-ASCII padding", () => {
    // "ß" -> "SS", "ıt" -> "IT", "ſe" -> "SE" under toUpperCase(); U+00A0 is outside the trimmed set.
    for (const value of ["ß", "ıt", "ſe", " DK"]) {
      expect(isAllowedCountryCode(value)).toBe(false);
    }
  });

  it("TC-5: the exceptions allowlist is empty by default, and a code added to it is accepted without changing the check", () => {
    expect(COUNTRY_CODE_EXCEPTIONS.size).toEqual(0);
    expect(isAllowedCountryCode("XK")).toBe(false);
    expect(isAllowedCountryCode("xk", new Set(["XK"]))).toBe(true);
    expect(isAllowedCountryCode("XKK", new Set(["XK"]))).toBe(false);
  });

  it("TC-6: normalizes to the trimmed upper-case code", () => {
    expect(normalizeCountryCode(" se ")).toEqual("SE");
    expect(normalizeCountryCode("\tdk\n")).toEqual("DK");
    expect(normalizeCountryCode("DK")).toEqual("DK");
  });
});
