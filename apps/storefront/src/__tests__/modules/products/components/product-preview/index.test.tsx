import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { emitCartAdd: jest.fn(), onCartAdd: jest.fn() },
}))

import ProductPreview from "@/modules/products/components/product-preview"

const product = {
  id: "prod-1",
  handle: "test-product",
  title: "Test Product",
  thumbnail: null,
  images: [],
  variants: [{ inventory_quantity: 12 }],
} as unknown as HttpTypes.StoreProduct

const region = { id: "region-1" } as unknown as HttpTypes.StoreRegion

describe("ProductPreview", () => {
  it("renders the extracted labels unchanged", async () => {
    const element = await ProductPreview({ product, region })
    render(element)

    expect(screen.getByText("BRAND")).toBeInTheDocument()
    expect(screen.getByText("Excl. VAT")).toBeInTheDocument()
    expect(screen.getByText("12 left")).toBeInTheDocument()
  })
})
