import type { CountryLanguagePublication } from "@/lib/i18n/country-language-map"
import { buildLocaleAlternates } from "@/lib/seo/locale-alternates"

function publication(entries: [string, string][]): CountryLanguagePublication {
  return {
    default_locale: "en",
    countries: entries.map(([country_code, locale]) => ({
      country_code,
      locale,
      source: "explicit",
    })),
  }
}

describe("buildLocaleAlternates", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
  })

  it("keys each configured country by its language and the URL country", () => {
    expect(
      buildLocaleAlternates(
        publication([
          ["dk", "da"],
          ["nl", "nl"],
          ["no", "no"],
        ]),
        "/products/some-handle"
      )
    ).toEqual({
      "da-DK": "https://example.com/dk/products/some-handle",
      "nl-NL": "https://example.com/nl/products/some-handle",
      "no-NO": "https://example.com/no/products/some-handle",
    })
  })

  it("keeps a URL for every country that shares a language", () => {
    expect(
      buildLocaleAlternates(
        publication([
          ["gb", "en"],
          ["ie", "en"],
          ["us", "en"],
        ]),
        "/store"
      )
    ).toEqual({
      "en-GB": "https://example.com/gb/store",
      "en-IE": "https://example.com/ie/store",
      "en-US": "https://example.com/us/store",
    })
  })

  it("replaces a language's own region with the URL country instead of adding a second one", () => {
    expect(
      buildLocaleAlternates(
        publication([
          ["pt", "pt-BR"],
          ["br", "pt-BR"],
        ]),
        "/store"
      )
    ).toEqual({
      "pt-PT": "https://example.com/pt/store",
      "pt-BR": "https://example.com/br/store",
    })
  })

  it("keeps the script and variants, but no extensions", () => {
    expect(
      buildLocaleAlternates(
        publication([
          ["tw", "zh-Hant"],
          ["rs", "sr-Latn-RS"],
          ["ch", "de-CH-1996"],
          ["fr", "fr-u-ca-gregory"],
          ["it", "it-x-internal"],
        ]),
        "/store"
      )
    ).toEqual({
      "zh-Hant-TW": "https://example.com/tw/store",
      "sr-Latn-RS": "https://example.com/rs/store",
      "de-CH-1996": "https://example.com/ch/store",
      "fr-FR": "https://example.com/fr/store",
      "it-IT": "https://example.com/it/store",
    })
  })

  it("lists only the countries in the publication", () => {
    const before = buildLocaleAlternates(
      publication([
        ["dk", "da"],
        ["se", "sv"],
      ]),
      "/store"
    )
    const after = buildLocaleAlternates(publication([["dk", "da"]]), "/store")

    expect(Object.keys(before)).toEqual(["da-DK", "sv-SE"])
    expect(after).toEqual({ "da-DK": "https://example.com/dk/store" })
  })

  it("gives no alternates for an empty publication", () => {
    expect(buildLocaleAlternates(publication([]), "/store")).toEqual({})
  })

  it("normalizes a path missing a leading slash", () => {
    const countries = publication([["dk", "da"]])
    expect(buildLocaleAlternates(countries, "categories/foo")).toEqual(
      buildLocaleAlternates(countries, "/categories/foo")
    )
  })
})
