import {
  COUNTRY_LANGUAGE_MAP,
  DEFAULT_LOCALE,
  getLocaleForCountry,
  SUPPORTED_LOCALES,
} from "@/lib/i18n/country-language-map"

describe("getLocaleForCountry", () => {
  it("resolves a known lowercase country code to its language", () => {
    expect(getLocaleForCountry("dk")).toBe("da")
  })

  it("resolves a known country code regardless of input casing", () => {
    expect(getLocaleForCountry("DE")).toBe("de")
  })

  it("falls back to the default locale for an unmapped country code", () => {
    expect(getLocaleForCountry("us")).toBe(DEFAULT_LOCALE)
  })

  it("maps every supported locale to at least one country", () => {
    const mappedLocales = new Set(Object.values(COUNTRY_LANGUAGE_MAP))
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(mappedLocales.has(locale)).toBe(true)
    })
  })
})
