import {
  COUNTRY_LANGUAGE_MAP,
  DEFAULT_LOCALE,
  findPublishedCountry,
  getLocaleForCountry,
  isCanonicalLocale,
  legacyCountryLanguageSnapshot,
  localeForCountry,
  SUPPORTED_LOCALES,
  type CountryLanguagePublication,
} from "@/lib/i18n/country-language-map"

const publication: CountryLanguagePublication = {
  default_locale: "en",
  countries: [
    { country_code: "dk", locale: "da", source: "explicit" },
    { country_code: "nl", locale: "nl", source: "explicit" },
    { country_code: "us", locale: "en", source: "default" },
  ],
}

describe("localeForCountry", () => {
  it("resolves a published ninth language", () => {
    expect(localeForCountry(publication, "nl")).toBe("nl")
  })

  it("resolves a published country regardless of input casing", () => {
    expect(localeForCountry(publication, "DK")).toBe("da")
  })

  it.each([["se"], [""], [undefined], [null], [42], ["dk/../x"]])(
    "gives the published default for a missing or unpublished country (%p)",
    (code) => {
      expect(localeForCountry({ ...publication, default_locale: "en" }, code)).toBe("en")
    }
  )
})

describe("findPublishedCountry", () => {
  it("finds only countries in the publication", () => {
    expect(findPublishedCountry(publication, "nl")).toEqual({ country_code: "nl", locale: "nl", source: "explicit" })
    expect(findPublishedCountry(publication, "de")).toBeUndefined()
    expect(findPublishedCountry(publication, ["nl"])).toBeUndefined()
  })
})

describe("isCanonicalLocale", () => {
  it.each(["en", "nl", "pt-BR", "zh-Hant", "sr-Latn-RS"])("accepts the canonical tag %s", (tag) => {
    expect(isCanonicalLocale(tag)).toBe(true)
  })

  it.each(["", "EN", "pt-br", "en_GB", "en-", "en GB", "../en", "x".repeat(65), 7])(
    "rejects %p",
    (tag) => {
      expect(isCanonicalLocale(tag)).toBe(false)
    }
  )
})

describe("legacy fallback", () => {
  it("keeps the approved legacy map as a full snapshot marked legacy", () => {
    const snapshot = legacyCountryLanguageSnapshot()
    expect(snapshot.availability).toBe("legacy")
    expect(snapshot.default_locale).toBe(DEFAULT_LOCALE)
    expect(localeForCountry(snapshot, "dk")).toBe("da")
    expect(localeForCountry(snapshot, "se")).toBe("sv")
    expect(localeForCountry(snapshot, "us")).toBe(DEFAULT_LOCALE)
  })

  it("still maps every legacy locale to at least one country", () => {
    const mappedLocales = new Set(Object.values(COUNTRY_LANGUAGE_MAP))
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(mappedLocales.has(locale)).toBe(true)
    })
  })

  it("keeps the legacy lookup for consumers not yet on the request snapshot", () => {
    expect(getLocaleForCountry("DK")).toBe("da")
    expect(getLocaleForCountry("us")).toBe(DEFAULT_LOCALE)
  })
})
