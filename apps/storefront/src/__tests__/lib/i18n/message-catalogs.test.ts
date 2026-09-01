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

// TC-2 (NIMBUS-165 Task 05): every locale catalog must expose the exact same
// set of key paths as the English catalog. Only values may differ once
// NIMBUS-167 translates them — a missing or extra key path in any locale
// indicates a catalog that fell out of sync during extraction.
function collectKeyPaths(
  node: unknown,
  prefix = "",
  paths: string[] = []
): string[] {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      collectKeyPaths(value, prefix ? `${prefix}.${key}` : key, paths)
    }
  } else {
    paths.push(prefix)
  }
  return paths
}

describe("message catalog key-structure parity", () => {
  const enCatalog = require("../../../../messages/en.json")
  const enKeyPaths = collectKeyPaths(enCatalog).sort()

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))(
    'locale "%s" has the same key paths as "en"',
    (locale) => {
      const catalog = require(`../../../../messages/${locale}.json`)
      const localeKeyPaths = collectKeyPaths(catalog).sort()

      expect(localeKeyPaths).toEqual(enKeyPaths)
    }
  )
})
