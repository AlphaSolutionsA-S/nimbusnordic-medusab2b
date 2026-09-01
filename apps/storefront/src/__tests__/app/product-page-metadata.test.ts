// Mirrors the mocking approach in `country-code-layout.test.tsx`: the real
// `next-intl/server` pulls in an ESM chain this Jest setup isn't configured
// to transform, so it's replaced with a minimal stand-in that resolves
// translations from the real message catalogs for a given locale.
type Messages = Record<string, Record<string, string>>

jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(
    async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const messages = require(`../../../messages/${locale}.json`) as Messages
      const dict = messages[namespace] ?? {}
      return (key: string) => dict[key] ?? key
    }
  ),
}))

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

// The page module's default export pulls in the full product template tree
// (cart event bus, add-to-cart, etc.), which reaches an untransformed ESM
// dependency this Jest setup isn't configured for. Only `generateMetadata` is
// under test here, so the template is stubbed out — same approach as
// `orders-page.test.tsx`'s `pending-customer-approvals` mock.
jest.mock("@/modules/products/templates", () => ({
  __esModule: true,
  default: () => null,
}))

import { generateMetadata } from "@/app/[countryCode]/(main)/products/[handle]/page"

describe("Product page generateMetadata", () => {
  it("uses the localized suffix for a non-English locale (TC-1, Task 02)", async () => {
    const metadata = await generateMetadata({
      params: { countryCode: "dk", handle: "test-product" },
    })

    expect(metadata.title).toBe("Test Product | Medusa Store")
  })

  it("falls back to the default locale suffix for an unmapped country (TC-2, Task 02)", async () => {
    const metadata = await generateMetadata({
      params: { countryCode: "us", handle: "test-product" },
    })

    expect(metadata.title).toBe("Test Product | Medusa Store")
  })

  it("keeps the product content itself identical across locales (TC-3, Task 02)", async () => {
    const dkMetadata = await generateMetadata({
      params: { countryCode: "dk", handle: "test-product" },
    })
    const frMetadata = await generateMetadata({
      params: { countryCode: "fr", handle: "test-product" },
    })

    expect(dkMetadata.description).toBe("Test Product")
    expect(frMetadata.description).toBe("Test Product")
    expect(dkMetadata.description).toBe(frMetadata.description)
  })

  it("includes hreflang alternates for all 8 locales (TC-2, Task 01)", async () => {
    const metadata = await generateMetadata({
      params: { countryCode: "dk", handle: "test-product" },
    })

    const languages = metadata.alternates?.languages as Record<
      string,
      string
    >
    expect(Object.keys(languages)).toHaveLength(8)
    expect(languages.da).toContain("/dk/products/test-product")
  })
})
