import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/regions", () => ({
  getRegion: jest.fn(async () => ({ id: "region-1" })),
}))

jest.mock("@/lib/data/products", () => ({
  listProductsWithSort: jest.fn(async () => ({
    response: { products: [], count: 0 },
  })),
}))

jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { emitCartAdd: jest.fn(), onCartAdd: jest.fn() },
}))

import PaginatedProducts from "@/modules/store/templates/paginated-products"

describe("PaginatedProducts", () => {
  it("renders the extracted empty-state message unchanged", async () => {
    const element = await PaginatedProducts({ page: 1, countryCode: "us" })
    render(element)

    expect(
      screen.getByText("No products found for this category.")
    ).toBeInTheDocument()
  })
})
