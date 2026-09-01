// See product-page-metadata.test.ts for why next-intl/server is mocked this
// way: it resolves translations from the real message catalogs for a given
// locale, avoiding the untransformed ESM chain of the real package.
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

jest.mock("@/lib/data/categories", () => ({
  getCategoryByHandle: jest.fn(async () => ({
    name: "Test Category",
    description: "A category for testing",
  })),
  listCategories: jest.fn(async () => []),
}))

jest.mock("@/lib/data/regions", () => ({
  listRegions: jest.fn(async () => []),
}))

// The page module's default export pulls in the full category template tree
// (product previews, cart event bus, etc.), which reaches an untransformed
// ESM dependency this Jest setup isn't configured for. Only `generateMetadata`
// is under test here, so the template is stubbed out — same approach as
// `orders-page.test.tsx`'s `pending-customer-approvals` mock.
jest.mock("@/modules/categories/templates", () => ({
  __esModule: true,
  default: () => null,
}))

import { generateMetadata } from "@/app/[countryCode]/(main)/categories/[...category]/page"

describe("Category page generateMetadata", () => {
  it("uses the localized suffix for a non-English locale (TC-1, Task 02)", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ countryCode: "dk", category: ["test-category"] }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata?.title).toBe("Test Category | Medusa Store")
  })

  it("falls back to the default locale suffix for an unmapped country (TC-2, Task 02)", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ countryCode: "us", category: ["test-category"] }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata?.title).toBe("Test Category | Medusa Store")
  })

  it("keeps the existing canonical while adding hreflang alternates (TC-3, Task 01)", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ countryCode: "dk", category: ["test-category"] }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata?.alternates?.canonical).toBe("test-category")

    const languages = metadata?.alternates?.languages as Record<
      string,
      string
    >
    expect(Object.keys(languages)).toHaveLength(8)
    expect(languages.da).toContain("/dk/categories/test-category")
  })
})
