import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/regions", () => ({
  getRegion: jest.fn(async () => ({ id: "region-1" })),
}))

jest.mock("@/lib/data/products", () => ({
  listProducts: jest.fn(async () => ({
    response: {
      products: [
        {
          id: "prod-2",
          handle: "other-product",
          title: "Other Product",
          variants: [],
        },
      ],
    },
  })),
}))

// Own extraction area, covered by its own test — stubbed here since async
// Server Components can't be rendered directly by RTL when nested.
jest.mock("@/modules/products/components/product-preview", () => ({
  __esModule: true,
  default: () => <div data-testid="product-preview-stub" />,
}))

import RelatedProducts from "@/modules/products/components/related-products"

const product = { id: "prod-1" } as unknown as HttpTypes.StoreProduct

describe("RelatedProducts", () => {
  it("renders the extracted heading unchanged", async () => {
    const element = await RelatedProducts({ product, countryCode: "us" })
    render(element)

    expect(
      screen.getByText("Other customers also viewed")
    ).toBeInTheDocument()
  })
})
