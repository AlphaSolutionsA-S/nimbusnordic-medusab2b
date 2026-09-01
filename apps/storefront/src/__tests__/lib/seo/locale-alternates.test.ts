import { COUNTRY_LANGUAGE_MAP } from "@/lib/i18n/country-language-map"
import { buildLocaleAlternates } from "@/lib/seo/locale-alternates"

describe("buildLocaleAlternates", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
  })

  it("generates exactly one URL per language in COUNTRY_LANGUAGE_MAP (TC-1)", () => {
    const alternates = buildLocaleAlternates("/products/some-handle")

    const countryEntries = Object.entries(COUNTRY_LANGUAGE_MAP)
    expect(Object.keys(alternates)).toHaveLength(countryEntries.length)

    for (const [countryCode, locale] of countryEntries) {
      expect(alternates[locale]).toBe(
        `https://example.com/${countryCode}/products/some-handle`
      )
    }
  })

  it("normalizes a path missing a leading slash", () => {
    const withSlash = buildLocaleAlternates("/categories/foo")
    const withoutSlash = buildLocaleAlternates("categories/foo")

    expect(withoutSlash).toEqual(withSlash)
  })
})
