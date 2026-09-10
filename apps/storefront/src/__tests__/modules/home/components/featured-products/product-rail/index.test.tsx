import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/products", () => ({
  getProductsById: jest.fn(async () => []),
}))

jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { emitCartAdd: jest.fn(), onCartAdd: jest.fn() },
}))

const collection = {
  id: "col-1",
  title: "Summer",
  handle: "summer",
  products: [],
} as unknown as HttpTypes.StoreCollection

const region = { id: "region-1" } as unknown as HttpTypes.StoreRegion

import ProductRail from "@/modules/home/components/featured-products/product-rail"

describe("ProductRail", () => {
  it("renders the extracted 'View all' label unchanged", async () => {
    const element = await ProductRail({ collection, region })
    render(element)

    expect(screen.getByText("View all")).toBeInTheDocument()
  })
})
