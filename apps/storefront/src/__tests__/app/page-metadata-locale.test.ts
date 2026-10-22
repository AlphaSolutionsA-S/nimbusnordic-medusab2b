type Catalog = Record<string, unknown>

jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(
    async (arg: string | { locale: string; namespace: string }) => {
      // Catalog pages pass the request locale explicitly; echo it so the title shows which one.
      if (typeof arg !== "string") {
        return (key: string) => `[${arg.locale}] ${arg.namespace}.${key}`
      }
      const catalog = require("../../../messages/da.json") as Catalog
      const dict = arg
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Catalog)?.[part],
          catalog
        ) as Catalog
      return (key: string) => {
        const value = key
          .split(".")
          .reduce<unknown>((acc, part) => (acc as Catalog)?.[part], dict)
        return typeof value === "string" ? value : key
      }
    }
  ),
}))
jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(async () => null),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(async () => null),
}))
jest.mock("@/modules/cart/templates", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/lib/context/cart-context", () => ({ CartProvider: () => null }))

// The request's country-language publication, as the layout and request config see it: a ninth
// language (nl) and two countries sharing English. No country in it comes from the legacy map.
jest.mock("@/lib/data/country-languages", () => {
  const { localeForCountry } = jest.requireActual(
    "@/lib/i18n/country-language-map"
  )
  const snapshot = {
    default_locale: "en",
    availability: "available",
    countries: [
      { country_code: "dk", locale: "da", source: "explicit" },
      { country_code: "gb", locale: "en", source: "default" },
      { country_code: "ie", locale: "en", source: "default" },
      { country_code: "nl", locale: "nl", source: "explicit" },
    ],
  }
  return {
    getCountryLanguageSnapshot: jest.fn(async () => snapshot),
    getCountryLanguageForCountry: jest.fn(async (code: string) => ({
      locale: localeForCountry(snapshot, code),
      availability: snapshot.availability,
    })),
  }
})
jest.mock("@/lib/data/regions", () => ({
  getRegion: jest.fn(async (countryCode: string) => ({
    id: `region_${countryCode}`,
  })),
  listRegions: jest.fn(async () => []),
}))
jest.mock("@/lib/data/products", () => ({
  getProductByHandle: jest.fn(async () => ({
    title: "Test Product",
    thumbnail: null,
  })),
}))
jest.mock("@/lib/data/collections", () => ({
  getCollectionByHandle: jest.fn(async () => ({ title: "Test Collection" })),
  listCollections: jest.fn(async () => ({ collections: [] })),
}))
jest.mock("@/lib/data/categories", () => ({
  getCategoryByHandle: jest.fn(async () => ({
    name: "Test Category",
    description: "A category",
  })),
  listCategories: jest.fn(async () => []),
}))
jest.mock("@/modules/products/templates", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/collections/templates", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/categories/templates", () => ({
  __esModule: true,
  default: () => null,
}))

import { generateMetadata as cartMetadata } from "@/app/[countryCode]/(main)/cart/page"
import { generateMetadata as mainNotFoundMetadata } from "@/app/[countryCode]/(main)/not-found"
import { generateMetadata as productMetadata } from "@/app/[countryCode]/(main)/products/[handle]/page"
import { generateMetadata as collectionMetadata } from "@/app/[countryCode]/(main)/collections/[handle]/page"
import { generateMetadata as categoryMetadata } from "@/app/[countryCode]/(main)/categories/[...category]/page"

describe("generateMetadata follows the active locale", () => {
  it("translates the cart page and not-found metadata into Danish (TC-3)", async () => {
    expect(await cartMetadata()).toEqual({
      title: "Kurv",
      description: "Se din kurv.",
    })
    expect(await mainNotFoundMetadata()).toEqual({
      title: "Siden blev ikke fundet",
      description: "Siden, du forsøgte at tilgå, findes ikke.",
    })
  })
})

describe("catalog page metadata uses the request's country-language publication", () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.com"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
  })

  function alternatesFor(path: string): Record<string, string> {
    return {
      "da-DK": `https://example.com/dk${path}`,
      "en-GB": `https://example.com/gb${path}`,
      "en-IE": `https://example.com/ie${path}`,
      "nl-NL": `https://example.com/nl${path}`,
    }
  }

  it("titles a product page in the country's published ninth language with every alternate", async () => {
    const metadata = await productMetadata({
      params: { countryCode: "nl", handle: "test-product" },
    })

    expect(metadata.title).toBe("Test Product [nl] MetaDescription.storeSuffix")
    expect(metadata.alternates?.languages).toEqual(
      alternatesFor("/products/test-product")
    )
  })

  it("titles a collection page in the country's published language with every alternate", async () => {
    const metadata = await collectionMetadata({
      params: Promise.resolve({ countryCode: "nl", handle: "test-collection" }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata.title).toBe(
      "Test Collection [nl] MetaDescription.storeSuffix"
    )
    expect(metadata.alternates?.languages).toEqual(
      alternatesFor("/collections/test-collection")
    )
  })

  it("titles a category page in the country's published language and keeps its canonical", async () => {
    const metadata = await categoryMetadata({
      params: Promise.resolve({
        countryCode: "nl",
        category: ["shoes", "boots"],
      }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata?.title).toBe(
      "Test Category [nl] MetaDescription.storeSuffix"
    )
    expect(metadata?.alternates?.canonical).toBe("shoes/boots")
    expect(metadata?.alternates?.languages).toEqual(
      alternatesFor("/categories/shoes/boots")
    )
  })

  it("keeps both English-country URLs and gives an unpublished country the default language", async () => {
    const ireland = await productMetadata({
      params: { countryCode: "ie", handle: "test-product" },
    })
    const unpublished = await productMetadata({
      params: { countryCode: "se", handle: "test-product" },
    })

    expect(ireland.title).toBe("Test Product [en] MetaDescription.storeSuffix")
    expect(unpublished.title).toBe(
      "Test Product [en] MetaDescription.storeSuffix"
    )
    // A country missing from the publication (removed from its region) gets no alternate.
    expect(unpublished.alternates?.languages).toEqual(
      alternatesFor("/products/test-product")
    )
  })
})
