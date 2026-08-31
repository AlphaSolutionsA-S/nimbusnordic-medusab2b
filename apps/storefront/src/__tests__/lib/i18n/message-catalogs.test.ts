import { SUPPORTED_LOCALES } from "@/lib/i18n/country-language-map"

describe("message catalogs", () => {
  it.each(SUPPORTED_LOCALES)(
    'has a valid, parseable catalog for locale "%s"',
    (locale) => {
      const catalog = require(`../../../../messages/${locale}.json`)
      expect(catalog).toHaveProperty("Common.welcome")
    }
  )
})
